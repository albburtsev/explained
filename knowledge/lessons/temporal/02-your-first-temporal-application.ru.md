---
slug: temporal/your-first-temporal-application
title: Первое приложение на Temporal
description: Запустите Hello World на TypeScript для Temporal, разберитесь в его компонентах и превратите его в минимальное приложение для отчётов руководству.
---

Проект, созданный во время установки, уже содержит готовое приложение на Temporal. Прежде чем что-то менять, запустите его один раз и найдите в нём место каждого примитива Temporal.

Находясь в каталоге `temporal-bi-report`, посмотрите на сгенерированные файлы:

```text
src/
├── activities.ts
├── client.ts
├── worker.ts
└── workflows.ts
```

Пример намеренно минимален: Client запускает Workflow `example`, Workflow вызывает Activity `greet`, а Activity возвращает приветствие.

## Запустите Hello World

Вам понадобятся три окна терминала. В первом по-прежнему работает локальный Temporal Service, запущенный при установке. Во втором запустите сгенерированный Worker и оставьте его работать:

```sh
npm run start.watch
```

Worker собирает бандл Workflow и начинает опрашивать Task Queue `hello-world`. В третьем терминале запустите Workflow Execution через сгенерированный Client:

```sh
npm run workflow
```

Client выводит Workflow ID, а за ним результат:

```text
Started workflow workflow-<unique-id>
Hello, Temporal!
```

Этот единственный результат прошёл через все важные границы приложения на Temporal.

## Разберите устройство приложения

У каждого компонента своя обязанность:

- `Temporal Service` хранит состояние выполнений, координирует задачи и предоставляет данные о выполнениях. Код ваших Workflow и Activity он не исполняет.
- `Client` отправляет команды в Service. Здесь `src/client.ts` запускает Workflow Execution и ждёт его результата.
- `Workflow` описывает долговечную бизнес-последовательность. Сгенерированный Workflow `example` просит Temporal выполнить одну Activity.
- `Activity` выполняет действие, которое может завершиться сбоем, — чаще всего это обращение к API, базе данных или другой внешней системе. Сгенерированная Activity `greet` всего лишь собирает строку.
- `Worker` — это ваш процесс. Он загружает определения Workflow и Activity, опрашивает очередь в поисках задач, исполняет ваш код и сообщает результаты в Service.
- `Task Queue` — имя маршрута между Service и совместимыми Worker. И Client, и Worker используют `hello-world`, поэтому задачи попадают к нужному коду.

Успешный запуск проходит такой путь:

```text
Client ──start──▶ Temporal Service ──Workflow task──▶ hello-world Task Queue
                                                            │
                                                            ▼
                                                         Worker
                                                            │
Workflow result ◀── Temporal Service ◀── Activity result ◀───┘
```

Ваш код в очереди не хранится. Задачи туда кладёт Service, а Worker опрашивает очередь, когда у него есть свободные ресурсы. Если Worker остановлен, Client всё равно может попросить Service запустить Workflow, но `handle.result()` будет ждать: продвигать выполнение некому.

## Превратите пример в приложение для отчётов

Теперь сохраним ту же архитектуру, но перенесём её в предметную область, которая пройдёт через весь курс. Первая версия лишь имитирует доставку, чтобы всё выполнение оставалось локальным. В следующих уроках она распадётся на отдельные Activity для получения метрик, формирования отчёта и доставки.

Замените содержимое `src/activities.ts` на:

```ts
export async function deliverExecutiveReport(
  reportDate: string,
): Promise<string> {
  const report = `Executive BI report for ${reportDate}`;

  return `${report} delivered to the leadership inbox`;
}
```

Activity — это обычная функция на TypeScript. Temporal вызывает её через задачу, а не прямым вызовом из кода Workflow.

Замените содержимое `src/workflows.ts` на:

```ts
import { proxyActivities } from '@temporalio/workflow';

import type * as activities from './activities';

const { deliverExecutiveReport } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

export async function executiveReportWorkflow(
  reportDate: string,
): Promise<string> {
  return await deliverExecutiveReport(reportDate);
}
```

В этих нескольких строках оркестрация заканчивается и начинается настоящая работа.

`proxyActivities` возвращает объект, который выглядит как ваш модуль Activity: по одной функции на каждую Activity, с тем же именем и теми же аргументами. Эти типы ему даёт аргумент типа `typeof activities` — они скопированы из модуля, импортированного строкой выше. Фигурные скобки затем извлекают из объекта одну из этих функций — `deliverExecutiveReport`.

:::details[Подробнее: песочница, путь вызова туда и обратно и таймаут]

Обратите внимание, что импорт записан как `import type`. Код Workflow не может импортировать реализацию Activity, потому что они выполняются в разных местах. Ваш Workflow работает внутри песочницы Workflow в Worker. Temporal может запустить этот код заново с самого начала, чтобы восстановить состояние выполнения, поэтому он не должен обращаться к сети, файловой системе или любой другой внешней системе. При компиляции TypeScript удаляет строку `import type`, так что код Activity в бандл Workflow не попадает. Остаются только типы — этого достаточно для автодополнения и для ошибки компиляции, если аргументы не совпадают.

Поэтому вызов `deliverExecutiveReport(reportDate)` не запускает функцию, которую вы написали в `src/activities.ts`. Он просит Service поставить `Activity Task` в Task Queue и сразу же возвращает Promise. Service записывает это планирование в Event History. Затем Worker, опрашивающий `executive-report`, забирает задачу и выполняет настоящую функцию в обычном процессе Node.js, а Service тоже записывает результат в историю. Дождавшись Promise, вы получаете этот сохранённый результат. Именно поэтому результат долговечен: его хранит Service, а не только память процесса, который может упасть.

Объект с параметрами обязателен. SDK требует `startToCloseTimeout` или `scheduleToCloseTimeout` и завершается ошибкой, если не задан ни один из них. Здесь `startToCloseTimeout: '1 minute'` ограничивает одну попытку: если Worker начал выполнять Activity и за минуту не сообщил результат, эта попытка отбрасывается, а не зависает навсегда. В одном из следующих уроков вы настроите эти параметры и связанные с ними повторные попытки.

:::

В `src/worker.ts` оставьте сгенерированный код подключения и регистрации, но смените Task Queue для Worker:

```ts
const worker = await Worker.create({
  connection,
  namespace: 'default',
  taskQueue: 'executive-report',
  workflowsPath: require.resolve('./workflows'),
  activities,
});
```

Наконец, замените содержимое `src/client.ts` на:

```ts
import { Client, Connection } from '@temporalio/client';
import { loadClientConnectConfig } from '@temporalio/envconfig';
import { nanoid } from 'nanoid';

import { executiveReportWorkflow } from './workflows';

async function run() {
  const config = loadClientConnectConfig();
  const connection = await Connection.connect(config.connectionOptions);
  const client = new Client({ connection });
  const reportDate = new Date().toISOString().slice(0, 10);

  const handle = await client.workflow.start(executiveReportWorkflow, {
    taskQueue: 'executive-report',
    args: [reportDate],
    workflowId: `executive-report-${reportDate}-${nanoid()}`,
  });

  console.log(`Started workflow ${handle.workflowId}`);
  console.log(await handle.result());
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Функция Workflow задаёт Workflow Type, а `workflowId` идентифицирует конкретное выполнение. Дата делает ID узнаваемым в операционных инструментах, а случайный суффикс не даёт повторным учебным запускам смешиваться.

Имя Task Queue в Client должно в точности совпадать с именем в Worker: это их договорённость о маршрутизации. Несовпадение обычно не приводит к отклонению запроса на запуск — выполнение просто повисает в ожидании на очереди, которую не опрашивает ни один совместимый Worker.

## Запустите Workflow отчёта и изучите его

Worker, запущенный через `start.watch`, перезапускается при изменении исходных файлов. Дождитесь, пока он снова сообщит, что работает, и перейдите в терминал Client:

```sh
npm run workflow
```

Последняя строка должна выглядеть примерно так:

```text
Executive BI report for 2026-08-22 delivered to the leadership inbox
```

Откройте [Temporal Web UI](http://localhost:8233), выберите Namespace `default` и найдите выполнение, чей Workflow ID начинается с `executive-report-`. В его подробностях должно быть видно:

- статус завершения;
- Workflow Type `executiveReportWorkflow`;
- Task Queue `executive-report`;
- Event History с запуском Workflow, планированием и завершением Activity и завершением Workflow.

Event History — это долговечная запись Service о том, что произошло. Пока используйте её лишь как доказательство того, что Client, Service, очередь, Worker, Workflow и Activity участвовали в одном и том же выполнении. Следующие уроки объяснят, как код Workflow и выполнение Activity опираются на эту запись, чтобы переживать сбои.

## Официальные ресурсы

- [Быстрый старт Temporal на TypeScript](https://docs.temporal.io/develop/typescript/set-up-your-local-typescript)
- [Официальный пример Hello World на TypeScript](https://github.com/temporalio/samples-typescript/tree/main/hello-world)
- [Task Queue](https://docs.temporal.io/task-queue)
- [Worker в Temporal](https://docs.temporal.io/workers)
