---
slug: temporal/durable-workflows
title: Долговечные Workflow
description: Разберитесь, как Temporal выполняет replay детерминированного кода Workflow на TypeScript, чтобы сохранить прогресс при перезапусках Worker.
---

Приложение для отчётов из предыдущего урока выглядит как обычная цепочка вызовов функций, но его Workflow не зависит от того, останется ли в живых один процесс Node.js. Temporal может восстановить состояние этого Workflow на другом Worker, потому что долговечное состояние записывает Temporal Service.

В этом уроке мы сделаем этот механизм видимым: добавим короткое долговечное ожидание, остановим Worker, а затем позволим тому же выполнению завершиться после его перезапуска.

## Отличайте определение от выполнения

`Workflow Definition` — это функция на TypeScript, которая описывает процесс подготовки отчёта:

```ts
export async function executiveReportWorkflow(
  reportDate: string,
): Promise<string> {
  // Durable orchestration belongs here.
}
```

Запуск этой функции создаёт `Workflow Execution` — один долговечный экземпляр со своими входными данными, состоянием и Event History. Имя функции `executiveReportWorkflow` служит Workflow Type. Из одного определения можно создать множество выполнений — так же, как из одного класса создаётся множество объектов.

У каждого выполнения есть два полезных идентификатора:

- `Workflow ID` — идентичность, видимая приложению; её задаёт Client. В проекте с отчётами он начинается с даты отчёта, и по нему можно найти выполнение или обратиться к нему.
- `Run ID` — идентификатор одного запуска, который назначает сервер. Цепочка, созданная, например, операцией Continue-As-New, может сохранять свой Workflow ID и при этом получать новый Run ID.

В рамках этого урока считайте Workflow ID долговечной бизнес-идентичностью, а Run ID — идентичностью текущего запуска. Внутри одного Namespace эта пара однозначно указывает на тот запуск, который вы видите в Temporal Web UI.

## Проследите путь от Command к Event History

Код Workflow меняет долговечное состояние через операции SDK. Дойдя до такой операции, Worker формирует `Command` для Temporal Service. Service выполняет Command и добавляет получившиеся `Events` в `Event History` этого выполнения.

Например:

```text
Workflow code                       Command                Recorded Events
await sleep('20 seconds')       ->  StartTimer         ->  TimerStarted, TimerFired
await deliverExecutiveReport()  ->  ScheduleActivity   ->  Activity task events
return result                   ->  CompleteWorkflow   ->  WorkflowExecutionCompleted
```

Локальные вычисления, присваивания и ветвления не порождают отдельных Event. История фиксирует долговечные границы и их исходы, а не снимки каждой переменной JavaScript.

Когда у Worker больше нет выполнения в памяти, он получает историю и запускает Workflow Definition заново с самого начала. Во время такого `replay` SDK сравнивает Command, которые порождает код, с записанными Event. Записанные результаты разрешают соответствующие ожидания, и так восстанавливаются локальные переменные и ход выполнения. Когда replay доходит до конца известной истории, Worker может выдавать новые Command и продолжать выполнение.

Благодаря replay перезапуск процесса не означает, что бизнес-процесс начинается заново. И по той же причине к коду Workflow предъявляются более строгие требования, чем к обычному прикладному коду.

## Сохраняйте детерминизм кода Workflow

При replay с той же историей Workflow Definition должен порождать ту же последовательность Command. Обычный поток управления TypeScript для этого годится, но ветвление по незаписанному ответу сети, по окружению процесса или по действительно случайному значению может породить другую следующую Command и вызвать ошибку недетерминизма.

TypeScript SDK выполняет код Workflow в песочнице и обеспечивает безопасное при replay поведение для нескольких привычных API:

- `Date.now()` и `new Date()` возвращают детерминированное время Workflow — время последней завершённой Workflow Task. Время идёт вперёд при ожидании операций Temporal.
- `Math.random()` использует детерминированный источник случайности и при replay выдаёт ту же последовательность.
- `setTimeout()` и `clearTimeout()` заменены детерминированными версиями, хотя SDK рекомендует `sleep()`, потому что он лучше работает с отменой.
- `uuid4()` из `@temporalio/workflow` генерирует детерминированные UUID. `crypto.randomUUID()` в песочнице недоступен.
- `log` из `@temporalio/workflow` учитывает replay и подавляет повторные сообщения журнала во время replay.

Песочница не предоставляет API Node.js и DOM. Импортировать пакеты безопасно, только если исполняемый ими код не обращается к этим API. `WeakRef` и `FinalizationRegistry` тоже недоступны, потому что момент сборки мусора недетерминирован.

И самое главное: не выполняйте внешний ввод-вывод прямо в коде Workflow. Драйверы баз данных, `fetch`, обращения к файловой системе, чтение значений, зависящих от окружения, и подобные операции наблюдают состояние за пределами Event History. Вынесите такую работу в Activity и вызывайте её через типизированный прокси. Результаты Activity записываются, поэтому при replay можно взять сохранённый результат, а не повторять внешний вызов. В следующем уроке эта граница разобрана подробно.

Детерминизм важен и при изменении кода. Если добавить, удалить или переставить операции, порождающие Command, новый код уже идущего выполнения может разойтись с его существующей историей. Поэтому развёртываниям в продакшене нужна стратегия версионирования Workflow: не обращайтесь с уже выполняющимся Workflow Definition как с обработчиком запросов без состояния, который можно править как угодно.

## Добавьте долговечное окно доставки

Замените содержимое `src/workflows.ts` этой накопительной версией:

```ts
import { log, proxyActivities, sleep } from '@temporalio/workflow';

import type * as activities from './activities';

const { deliverExecutiveReport } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

export async function executiveReportWorkflow(
  reportDate: string,
): Promise<string> {
  log.info('Report accepted', { reportDate });

  await sleep('20 seconds');

  log.info('Delivery window opened', { reportDate });
  return await deliverExecutiveReport(reportDate);
}
```

Это ожидание — часть оркестрации Workflow, а не таймер внутри процесса. Temporal записывает `TimerStarted`, и позже Service может записать `TimerFired`, даже если ни один Worker не запущен. Спящее выполнение не занимает поток Worker.

Activity остаётся точно такой же, как в предыдущем уроке. Этот эксперимент посвящён восстановлению состояния Workflow, а не поведению Activity при сбоях.

## Перезапустите Worker посреди выполнения

Не останавливайте сервис разработки Temporal. Запустите Worker и дождитесь, пока он сообщит, что опрашивает очередь:

```sh
npm run start.watch
```

В другом терминале запустите Workflow отчёта:

```sh
npm run workflow
```

Client выводит Workflow ID и ждёт результата. Не дожидаясь, пока пройдут 20 секунд, вернитесь в терминал Worker и нажмите <kbd>Control</kbd>+<kbd>C</kbd>. Подождите, пока 20-секундное окно истечёт, и снова запустите Worker:

```sh
npm run start.watch
```

Ожидающий Client теперь должен вывести тот же результат доставки, что и раньше. Откройте [Temporal Web UI](http://localhost:8233), выберите этот Workflow ID и изучите его Event History. Вы увидите события запуска и срабатывания таймера перед событиями завершения Activity и Workflow.

Перезапущенный Worker не восстанавливал снимок кучи JavaScript. Он выполнил replay определения по сохранённой истории, воспроизвёл Command таймера, получил записанный исход таймера и перешёл к следующей Command. Логгер, учитывающий replay, не выводит `Report accepted` второй раз только потому, что код снова прошёл это место во время replay.

Даже если закрыть и терминал Client, Workflow продолжит работу. Client запрашивает выполнение и наблюдает за ним, но не хранит состояние Workflow. Позже выполнение можно найти по его Workflow ID в Web UI.

## Повторите контракт долговечности

- Workflow Definition — это код; Workflow Execution — один долговечный запуск этого кода.
- Command запрашивают долговечные действия, а Service записывает их исходы как Event.
- Replay восстанавливает локальное состояние Workflow, сопоставляя детерминированные Command с Event History.
- Долговечные ожидания переживают простой Worker и не занимают его поток.
- Код Workflow оркестрирует с помощью API, безопасных при replay; внешний ввод-вывод относится к Activity.

## Официальные ресурсы

- [Основы Workflow и поведение песочницы TypeScript](https://docs.temporal.io/develop/typescript/workflows/basics)
- [Workflow Execution, Command и replay](https://docs.temporal.io/workflow-execution)
- [Event и Event History](https://docs.temporal.io/workflow-execution/event)
- [Долговечные таймеры в TypeScript SDK](https://docs.temporal.io/develop/typescript/workflows/timers)
- [Справочник API Workflow для TypeScript](https://typescript.temporal.io/api/namespaces/workflow)
