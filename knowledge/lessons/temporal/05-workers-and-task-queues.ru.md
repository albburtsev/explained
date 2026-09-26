---
slug: temporal/workers-and-task-queues
title: Worker и Task Queue
description: Разберитесь, как Worker в Temporal регистрирует код, опрашивает Task Queue, делит работу с другими Worker и завершается, не владея долговечным состоянием Workflow.
---

Приложение для отчётов уже умеет надёжно оркестрировать Workflow и повторять Activity, однако сам TypeScript-код не исполняют ни Client, ни Temporal Service. Его исполняет ваш Worker Process.

В этом уроке мы проследим путь одного отчёта через задачи его Workflow и Activity, а затем на уже знакомой Task Queue `executive-report` посмотрим, что происходит, когда работают ноль, один и два Worker Process.

## Отделите программу Worker от процесса

`Worker Program` — это статическая точка входа на TypeScript, которая настраивает Worker. Запуск этой программы порождает `Worker Process`: работающий процесс Node.js, который подключается к Temporal Service, опрашивает Task Queue, исполняет зарегистрированный код и возвращает результаты.

Итоговый `src/worker.ts` должен выглядеть так:

```ts
import { NativeConnection, Worker } from '@temporalio/worker';

import * as activities from './activities';

async function run() {
  const connection = await NativeConnection.connect({
    address: 'localhost:7233',
  });

  try {
    const worker = await Worker.create({
      connection,
      namespace: 'default',
      taskQueue: 'executive-report',
      workflowsPath: require.resolve('./workflows'),
      activities,
    });

    await worker.run();
  } finally {
    await connection.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

`Worker.create()` готовит два вида прикладного кода по-разному:

- `workflowsPath` указывает на модуль, экспортируемые Workflow Definition которого собираются в бандл для изолированной среды исполнения Workflow в Temporal. Из этого бандла Worker может загрузить `executiveReportWorkflow` и выполнить его replay.
- `activities` — это соответствие между именами Activity Type и обычными функциями Node.js, которые их реализуют. Здесь регистрируются `fetchMetrics`, `renderExecutiveReport` и `deliverReport`.

Регистрация сообщает этому Worker, какие типы задач он способен выполнять. Код при этом не загружается в Service. Каждый Worker Process, опрашивающий эту очередь, должен запускать код, совместимый с задачами, которые он может получить.

`worker.run()` запускает опрос и остаётся в ожидании, пока Worker работает. Сгенерированный процесс также реагирует на сигналы завершения. Когда вы нажимаете <kbd>Control</kbd>+<kbd>C</kbd>, SDK перестаёт принимать новую работу и проходит всю последовательность остановки; только после этого `worker.run()` завершается, а блок `finally` закрывает соединение.

## Проследите два типа задач

`executive-report` — одно имя для маршрутизации, но Workflow Task и Activity Task — разные вещи. Поскольку этот Worker регистрирует код обоих видов, SDK опрашивает под этим именем оба типа задач.

Один проход через приложение выглядит так:

```text
Client
  │ start Workflow
  ▼
Temporal Service
  │ Workflow Task: advance executiveReportWorkflow
  ▼
Workflow poller ──▶ run bundled Workflow code ──▶ ScheduleActivity Command
  ▲                                                     │
  │                                                     ▼
Temporal Service ◀──────── record Commands and Events ──┘
  │ Activity Task: run fetchMetrics
  ▼
Activity poller ──▶ call the Node.js Activity ──▶ return result or failure
  │
  ▼
Temporal Service ──▶ record outcome and schedule the next Workflow Task
```

`Workflow Task` просит Worker продвинуть Workflow Execution вперёд. Worker выполняет replay детерминированного кода Workflow или возобновляет его, доводит до места, где нужно ждать, и возвращает Command — например, запланировать Activity или запустить таймер. Пока Workflow ждёт, Worker не держит его открытым в отдельном потоке.

`Activity Task` просит Worker вызвать одну зарегистрированную реализацию Activity. Этот код работает в обычной среде Node.js и может выполнять внешний ввод-вывод. Его результат, сбой, таймаут или heartbeat через Event History становятся входными данными для дальнейшего продвижения Workflow.

Эта граница между задачами объясняет, почему `await fetchMetrics(reportDate)` — не прямой вызов функции. Один Workflow Task порождает Command, Service создаёт Activity Task, а следующий Workflow Task уже видит, чем закончилась Activity.

## Храните долговечное состояние в Service

Worker может кешировать Workflow Execution в памяти, чтобы следующий Workflow Task возобновился быстрее. Но этот кеш — лишь оптимизация, а не долговечный источник истины. Event History и таймеры сохраняет Temporal Service; он может отдать следующую задачу другому совместимому Worker, и тот восстановит состояние Workflow через replay.

Локальная память Activity тоже не долговечна. Результат Activity становится долговечным, когда Service его записывает, а принятые данные heartbeat помогают повторной попытке продолжить с места остановки. Но произвольные переменные в Worker Process исчезают вместе с процессом.

Граница ответственности, таким образом, проходит так:

| Компонент | Чем владеет |
| --- | --- |
| Temporal Service | Event History, координация исполнения, таймеры и задачи в очереди |
| Worker Process | Среда исполнения Workflow, зарегистрированные реализации, вычислительная ёмкость и временные кеши |
| Client | Запросы и handle, с помощью которых запускают исполнения и взаимодействуют с ними |

Ни Worker, ни Client не обязаны оставаться в живых во время долговечного ожидания. Совместимый Worker нужен лишь тогда, когда появилась задача, для продвижения которой требуется прикладной код.

## Понаблюдайте за очередью без поллеров

Сначала остановите все Worker отчётов клавишами <kbd>Control</kbd>+<kbd>C</kbd>, но локальный Temporal Service оставьте запущенным. В другом терминале запустите Workflow отчёта:

```sh
npm run workflow
```

Client выводит Workflow ID и переходит в ожидание. Запрос на запуск выполнен успешно: Service сохранил новое исполнение и запланировал его первый Workflow Task. Продвижение остановилось, потому что `executive-report` никто не опрашивает; запасного варианта, при котором Service сам исполнял бы код Workflow, не существует.

Изучите логическую Task Queue из другого терминала:

```sh
temporal task-queue describe --task-queue executive-report
```

Команда показывает сведения об очередях Workflow и Activity, включая недавних поллеров и приблизительную статистику накопившихся задач. Записи о поллерах могут ещё какое-то время оставаться видимыми после остановки Worker, потому что Service сообщает о недавней активности опроса. Сверяйте время последнего обращения с тем, что действительно запущено в ваших терминалах, и не принимайте этот список за реестр живых процессов.

Теперь снова запустите один Worker:

```sh
npm run start.watch
```

Он забирает ожидающий Workflow Task и продвигает то же самое исполнение. После долговечного таймера и повторной попытки Activity из прошлых уроков исходный Client получает результат отчёта. Ни перезапускать Workflow, ни заново создавать его входные данные не пришлось.

## Разделите очередь между двумя Worker

Оставьте первый Worker работать и откройте ещё один терминал в том же проекте. Запустите второй, идентичный Worker Process:

```sh
npm run start.watch
```

Снова выполните команду проверки:

```sh
temporal task-queue describe --task-queue executive-report
```

Теперь в сведениях о поллерах должны появиться две идентичности Worker. Идентичность по умолчанию в TypeScript SDK включает ID процесса и имя хоста, поэтому два локальных процесса можно различить, ничего не меняя в приложении.

Service сопоставляет каждую доступную задачу ровно с одним совместимым поллером и не рассылает её обоим процессам сразу. Разные задачи одного Workflow Execution могут выполняться на разных Worker. Если Workflow Task переходит к другому процессу, детерминированный replay восстанавливает его состояние. Если попытка Activity проваливается из-за исчезновения её Worker, то момент, когда сможет начаться следующая попытка, определяют таймаут Activity и Retry Policy из предыдущего урока.

Остановите любой из Worker клавишами <kbd>Control</kbd>+<kbd>C</kbd> и снова запустите Client:

```sh
npm run workflow
```

Оставшийся Worker доводит отчёт до конца, потому что регистрирует те же типы Workflow и Activity и опрашивает ту же очередь. В этом и состоит базовая модель горизонтального масштабирования: чтобы добавить вычислительную ёмкость, запускайте больше совместимых Worker Process, а убирайте их через штатный жизненный цикл остановки Worker. Task Queue отвязывает число процессов от идентичности Workflow и его долговечного состояния.

Эксперимент не гарантирует, что небольшое число задач разделится поровну. Опрос зависит от свободной ёмкости, поэтому один Worker может забрать несколько задач, даже когда исправны оба. Важно другое: у каждой задачи ровно один исполнитель, оба Worker способны принимать работу, а потеря одного процесса не стирает прогресс Workflow.

## Подведите итог: граница исполнения

- Worker Process опрашивает очередь в поисках задач и исполняет зарегистрированный прикладной код; Temporal Service этот код никогда не исполняет.
- Workflow Task продвигают детерминированную оркестрацию, а Activity Task вызывают обычные функции Node.js.
- Одно имя Task Queue направляет раздельные типы задач Workflow и Activity к совместимым поллерам.
- Долговечной Event History владеет Service; кеши Worker и память процесса заменимы.
- Если поллеров нет, задачи ждут. Если совместимых поллеров несколько, задачи распределяются в зависимости от свободной ёмкости.
- Штатная остановка не даёт Worker брать новую работу и позволяет другому совместимому Worker продолжить дальнейшее продвижение.

## Официальные ресурсы

- [Temporal Workers](https://docs.temporal.io/workers)
- [Task Queues](https://docs.temporal.io/task-queue)
- [How SDKs work with the Temporal Service](https://docs.temporal.io/encyclopedia/architecture/temporal-sdks)
- [TypeScript `Worker` API](https://typescript.temporal.io/api/classes/worker.Worker)
- [TypeScript `WorkerOptions` API](https://typescript.temporal.io/api/interfaces/worker.WorkerOptions)
- [Temporal CLI `task-queue` command](https://docs.temporal.io/cli/command-reference/task-queue)
