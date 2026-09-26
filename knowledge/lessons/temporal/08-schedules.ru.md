---
slug: temporal/schedules
title: Schedule
description: Запускайте Workflow отчёта по ежедневному календарю, не допускайте пересекающихся запусков и управляйте жизненным циклом Schedule.
---

Workflow отчёта теперь долговечен, интерактивен и покрыт тестами, но каждое его исполнение по-прежнему начинается с прямого вызова из Client. `Schedule` переносит регулярные моменты запуска в Temporal Service. Service сам вычисляет правила расписания и запускает новый Workflow Execution в каждый подходящий момент, даже если Client, создавший расписание, давно не работает.

Для новой регулярной автоматизации используйте Schedule. Temporal поддерживает и более старую опцию запуска Workflow `cronSchedule`, но рекомендует Schedule: у них есть собственная идентичность, и их можно описывать, запускать вручную, приостанавливать, обновлять и удалять независимо от Workflow Execution, которые они порождают.

## Разделите время Schedule и время Workflow

Прежние Client и тесты передают дату отчёта явно:

```ts
args: ['2026-08-22'],
```

Долгоживущий Schedule не должен запомнить дату своего создания и каждый день отправлять одно и то же значение. Сделайте существующий параметр Workflow необязательным и вычисляйте дату внутри каждого исполнения, если вызывающая сторона её не передала. В `src/workflows.ts` измените начало `executiveReportWorkflow` так:

```ts
export async function executiveReportWorkflow(
  requestedReportDate?: string,
): Promise<string> {
  const reportDate =
    requestedReportDate ?? new Date().toISOString().slice(0, 10);

  let phase: ReportPhase = 'preparing';
  let recipients = ['leadership@example.com'];
  let approvedBy: string | undefined;

  // Keep the existing handlers and report pipeline below.
```

Все последующие обращения к `reportDate` оставьте без изменений. Прямые запуски и тесты по-прежнему передают строку и поэтому ведут себя в точности как раньше. Schedule не будет передавать аргумент, так что каждое новое исполнение вычислит свою дату само.

Внутри кода Workflow на TypeScript `new Date()` и `Date.now()` используют детерминированное время Workflow. При replay Temporal подставляет то же самое значение, поэтому вычисление запасной даты внутри Workflow не нарушает детерминизм. ISO-выражение намеренно даёт дату в формате `YYYY-MM-DD` по UTC. Schedule ниже срабатывает в 09:00 по лондонскому времени — в этот час календарные даты в Лондоне и по UTC всегда совпадают.

Не вычисляйте запасную дату в скрипте, создающем Schedule. Этот скрипт выполняется один раз, тогда как функция Workflow выполняется заново для каждого Workflow Execution, запущенного Schedule.

## Создайте ежедневный Schedule

Добавьте `src/schedule.ts`:

```ts
import {
  Client,
  Connection,
  ScheduleOverlapPolicy,
} from '@temporalio/client';
import { loadClientConnectConfig } from '@temporalio/envconfig';

import { executiveReportWorkflow } from './workflows';

const scheduleId = 'executive-report-daily-schedule';

async function run() {
  const command = process.argv[2];
  const config = loadClientConnectConfig();
  const connection = await Connection.connect(config.connectionOptions);
  const client = new Client({ connection });

  try {
    if (command === 'create') {
      const handle = await client.schedule.create({
        scheduleId,
        spec: {
          calendars: [
            {
              comment: 'Every day at 09:00 London time',
              hour: 9,
              minute: 0,
            },
          ],
          timezone: 'Europe/London',
        },
        action: {
          type: 'startWorkflow',
          workflowType: executiveReportWorkflow,
          taskQueue: 'executive-report',
          args: [],
          workflowId: 'executive-report-daily',
        },
        policies: {
          overlap: ScheduleOverlapPolicy.SKIP,
        },
      });

      console.log(`Created ${handle.scheduleId}`);
      return;
    }

    const handle = client.schedule.getHandle(scheduleId);

    switch (command) {
      case 'describe': {
        const description = await handle.describe();

        console.log({
          scheduleId: description.scheduleId,
          paused: description.state.paused,
          overlap: description.policies.overlap,
          nextActionTimes: description.info.nextActionTimes,
          runningActions: description.info.runningActions,
          recentActions: description.info.recentActions,
        });
        break;
      }
      case 'trigger':
        await handle.trigger(ScheduleOverlapPolicy.SKIP);
        console.log(`Triggered ${handle.scheduleId}`);
        break;
      case 'pause':
        await handle.pause('Paused during the course exercise');
        console.log(`Paused ${handle.scheduleId}`);
        break;
      case 'unpause':
        await handle.unpause('Resumed during the course exercise');
        console.log(`Unpaused ${handle.scheduleId}`);
        break;
      case 'delete':
        await handle.delete();
        console.log(`Deleted ${handle.scheduleId}`);
        break;
      default:
        throw new Error(
          'Use create, describe, trigger, pause, unpause, or delete',
        );
    }
  } finally {
    await connection.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

`Schedule ID` идентифицирует долговечный ресурс расписания. По этому значению получают handle Schedule и управляют настройками времени. Schedule — это не Workflow Execution, и сам он код отчёта не исполняет.

Действие (action) описывает, что запускать в каждый подходящий момент:

- `workflowType` выбирает `executiveReportWorkflow`.
- `taskQueue` направляет каждый получившийся Workflow Task к уже работающему Worker отчётов.
- `args: []` просит каждое исполнение вычислить свою дату из детерминированного времени Workflow.
- `workflowId` задаёт читаемую основу `executive-report-daily`; Temporal добавляет к ней метку времени действия, поэтому у каждого запуска свои Workflow ID, Run ID и Event History.

`calendars` описывает совпадения по настенному времени для этой задачи понятнее, чем строка cron. Незаданные поля календаря принимают значения по умолчанию: час и минута выбирают 09:00, а день, месяц и год остаются без ограничений. `timezone` — это имя часового пояса IANA, которое интерпретирует Temporal Service. Без него Schedule использует UTC. Местные часовые пояса подвержены переходам на летнее время и обратно, поэтому избегайте часов, которые такой переход может повторить или пропустить.

## Не допускайте пересекающихся ожиданий одобрения

Один отчёт может оставаться открытым до 24 часов, пока ждёт одобрения. Если следующий ежедневный запуск наступает раньше, чем закрылось предыдущее исполнение, `ScheduleOverlapPolicy.SKIP` велит Service не запускать новое действие. Эта политика не отменяет и не завершает принудительно текущий отчёт и не ставит ещё один в очередь.

Политика указана явно, хотя `SKIP` и так используется сервером по умолчанию. Здесь она фиксирует бизнес-решение: одобрения одновременно может ждать не больше одного отчёта, запущенного Schedule. Другой процесс, запускающий `executiveReportWorkflow` напрямую, в учёт пересечений этого Schedule не входит.

Ручной запуск тоже передаёт `ScheduleOverlapPolicy.SKIP`. Благодаря этому на тренировочное действие распространяется то же правило безопасности: запуск, пока открыт отчёт, начатый Schedule, пропускается и не создаёт параллельный запрос на одобрение.

## Пройдите весь жизненный цикл

Не останавливайте локальный Temporal Service и Worker отчётов. Из каталога проекта создайте Schedule:

```sh
npx ts-node src/schedule.ts create
```

Повторное создание Schedule с тем же Schedule ID завершится ошибкой, потому что ресурс уже существует. Вместо этого получите его текущее состояние:

```sh
npx ts-node src/schedule.ts describe
```

В описании есть будущие моменты действий, а также идентификаторы недавних и выполняющихся сейчас Workflow. Здесь становятся видны два уровня идентичности: один Schedule ID со временем указывает на несколько Workflow Execution.

Запустите действие прямо сейчас, не дожидаясь 09:00:

```sh
npx ts-node src/schedule.ts trigger
```

Откройте Temporal Web UI и найдите новое исполнение, чей Workflow ID начинается с `executive-report-daily-`. Когда Activity завершатся, оно должно дойти до фазы `awaiting-approval`. Одобрить его можно по схеме с Signal из Client, описанной в уроке о сообщениях Workflow.

Приостановите Schedule и изучите его состояние:

```sh
npx ts-node src/schedule.ts pause
npx ts-node src/schedule.ts describe
```

Приостановка останавливает будущие запланированные действия. Уже запущенное исполнение она не приостанавливает, не отменяет и не завершает принудительно. Возобновите будущие действия командой:

```sh
npx ts-node src/schedule.ts unpause
```

Наконец, удалите тренировочный Schedule, чтобы завтра он не запустил ещё один отчёт:

```sh
npx ts-node src/schedule.ts delete
```

Удаление Schedule убирает его будущие настройки времени, но не удаляет и не завершает Workflow Execution, которые он уже запустил. После удаления `describe` завершается ошибкой, потому что такого Schedule ID больше нет.

## Подведите итог: граница расписания

- Schedule — долговечный ресурс Service с собственным Schedule ID и жизненным циклом.
- Каждый подходящий момент запускает отдельный Workflow Execution со своей Event History.
- Календарь и часовой пояс IANA выражают ежедневное правило по настенному времени.
- Task Queue действия должна опрашиваться Worker, который регистрирует выбранный Workflow Type.
- `SKIP` не допускает второго действия Schedule, пока открыт отчёт, ранее запущенный Schedule.
- Приостановка влияет на будущие действия; удаление убирает Schedule, но оставляет уже запущенные исполнения нетронутыми.

## Официальные ресурсы

- [Schedules in the TypeScript SDK](https://docs.temporal.io/develop/typescript/workflows/schedules)
- [TypeScript `ScheduleClient` API](https://typescript.temporal.io/api/classes/client.ScheduleClient)
- [TypeScript Schedule types and overlap policies](https://typescript.temporal.io/api/namespaces/client#scheduleoverlappolicy)
- [Official TypeScript Schedules sample](https://github.com/temporalio/samples-typescript/tree/main/schedules)
- [Temporal Schedule concepts](https://docs.temporal.io/schedule)
