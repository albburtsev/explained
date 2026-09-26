---
slug: temporal/testing-temporal-applications
title: Тестирование приложений на Temporal
description: Протестируйте Workflow на TypeScript с подставными Activity, проверками сообщений и перемоткой долговечного времени.
---

Workflow для отчёта руководству теперь координирует внешнюю работу и ждёт одобрения аналитика. Если вызвать функцию Workflow напрямую, большая часть важного поведения останется непроверенной: планирование Activity, обработчики сообщений, долговечные таймеры, сериализация и взаимодействие через Client.

Поэтому практичный тест Workflow запускает настоящий бандл Workflow в Worker, подключённом к тестовому серверу Temporal. Внешние Activity тест заменяет быстрыми реализациями в памяти, но оркестрацию Workflow проверяет через те же API Client, которыми пользуется приложение.

## Ограничьте ожидание одобрения

В предыдущем уроке Workflow ждёт одобрения бесконечно. Задайте этому бизнес-ожиданию явный предел, чтобы можно было проверить оба исхода. В `src/workflows.ts` расширьте `ReportPhase`:

```ts
export type ReportPhase =
  | 'preparing'
  | 'awaiting-approval'
  | 'delivering'
  | 'approval-expired';
```

Затем замените неограниченное условие одобрения и строки сразу после него на:

```ts
phase = 'awaiting-approval';
const approved = await condition(
  () => approvedBy !== undefined,
  '24 hours',
);

if (!approved) {
  phase = 'approval-expired';
  return `Report for ${reportDate} expired without approval`;
}

phase = 'delivering';
const idempotencyKey = `executive-report:${reportDate}`;

return await deliverReport(report, recipients, idempotencyKey);
```

Форма `condition` с двумя аргументами возвращает `true`, если предикат стал истинным до срабатывания долговечного таймера, и `false` по таймауту. Таймер принадлежит состоянию Workflow, поэтому переживает перезапуски Worker. Запоздалое одобрение не оживит это исполнение после того, как оно вернуло результат; если приложению нужна ещё одна попытка, оно должно запустить новый Workflow.

## Соберите тестовую обвязку для Workflow

Текущий шаблон Hello World уже включает Mocha, `@temporalio/testing` и такую команду для тестов:

```sh
npm test
```

Создайте `src/mocha/workflows.test.ts`:

```ts
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';

import type * as activities from '../activities';
import {
  approveReport,
  changeRecipients,
  executiveReportWorkflow,
  getReportStatus,
} from '../workflows';

describe('executiveReportWorkflow', function () {
  let env!: TestWorkflowEnvironment;

  before(async function () {
    this.timeout(60_000);
    env = await TestWorkflowEnvironment.createTimeSkipping();
  });

  after(async () => {
    await env?.teardown();
  });

  async function createWorker(deliveries: string[]) {
    const taskQueue = `executive-report-test-${randomUUID()}`;
    const fakeActivities: typeof activities = {
      async fetchMetrics(reportDate) {
        return {
          reportDate,
          activeAccounts: 1_284,
          monthlyRevenue: 247_500,
        };
      },
      async renderExecutiveReport(metrics) {
        return {
          reportDate: metrics.reportDate,
          body: `Executive report for ${metrics.reportDate}`,
        };
      },
      async deliverReport(report, recipients, idempotencyKey) {
        deliveries.push(idempotencyKey);
        return `Report for ${report.reportDate} delivered to ${recipients.join(', ')}`;
      },
    };

    const worker = await Worker.create({
      connection: env.nativeConnection,
      namespace: env.namespace,
      taskQueue,
      workflowsPath: require.resolve('../workflows'),
      activities: fakeActivities,
    });

    return { taskQueue, worker };
  }

  it('changes recipients, records approval, and delivers once', async () => {
    const deliveries: string[] = [];
    const { taskQueue, worker } = await createWorker(deliveries);

    const result = await worker.runUntil(async () => {
      const handle = await env.client.workflow.start(
        executiveReportWorkflow,
        {
          taskQueue,
          workflowId: `approved-report-${randomUUID()}`,
          args: ['2026-08-22'],
        },
      );

      assert.deepEqual(await handle.query(getReportStatus), {
        phase: 'preparing',
        recipients: ['leadership@example.com'],
      });

      const changed = await handle.executeUpdate(changeRecipients, {
        args: [
          {
            recipients: [
              'ceo@example.com',
              'finance@example.com',
            ],
          },
        ],
      });

      assert.deepEqual(changed.currentRecipients, [
        'ceo@example.com',
        'finance@example.com',
      ]);

      await handle.signal(approveReport, { approvedBy: 'Maya' });

      const approvedStatus = await handle.query(getReportStatus);
      assert.equal(approvedStatus.approvedBy, 'Maya');
      assert.deepEqual(approvedStatus.recipients, [
        'ceo@example.com',
        'finance@example.com',
      ]);

      return await handle.result();
    });

    assert.equal(
      result,
      'Report for 2026-08-22 delivered to ceo@example.com, finance@example.com',
    );
    assert.deepEqual(deliveries, [
      'executive-report:2026-08-22',
    ]);
  });

  it('expires approval without delivering', async () => {
    const deliveries: string[] = [];
    const { taskQueue, worker } = await createWorker(deliveries);

    const result = await worker.runUntil(
      env.client.workflow.execute(executiveReportWorkflow, {
        taskQueue,
        workflowId: `expired-report-${randomUUID()}`,
        args: ['2026-08-23'],
      }),
    );

    assert.equal(
      result,
      'Report for 2026-08-23 expired without approval',
    );
    assert.deepEqual(deliveries, []);
  });
});
```

`TestWorkflowEnvironment.createTimeSkipping()` запускает изолированный тестовый сервис и предоставляет два соединения: `env.client` для взаимодействия из теста и `env.nativeConnection` для Worker. `Worker.runUntil` опрашивает уникальную Task Queue, пока переданная операция не завершится, а затем останавливает Worker. `env.teardown()` закрывает тестовый сервис после прогона набора тестов.

Подставные Activity сохраняют сигнатуры боевых функций благодаря `typeof activities`. Они делают тест детерминированным, обходят намеренный сбой первой попытки в `fetchMetrics` и фиксируют доставку как наблюдение теста. Настоящие реализации Activity и внешние системы в тесте не участвуют.

## Проверьте сообщения и время

Тест пути с одобрением запускает исполнение, а не просто ждёт `workflow.execute`. Так у теста появляется типизированный handle, пока Workflow открыт, и он может:

1. Запросить через Query начальное состояние.
2. Выполнить Update получателей и проверить его результат.
3. Отправить Signal с одобрением и запросить через Query состояние, изменённое обработчиком.
4. Дождаться итогового результата и убедиться, что доставка произошла ровно один раз.

Тест пути с таймаутом намеренно не отправляет одобрения. Ожидание `env.client.workflow.execute` включает автоматический time skipping: пока не выполняется ни одна Activity, тестовый сервис перематывает начальный 20-секундный таймер и 24-часовой таймаут условия, не дожидаясь реального времени. Последняя проверка заодно доказывает, что Activity доставки так и не была запланирована.

Время глобально в пределах одного `TestWorkflowEnvironment`. По умолчанию Mocha выполняет эти тесты последовательно. Если в наборе включено параллельное выполнение, оставьте тесты, управляющие временем, последовательными или дайте каждому собственное окружение.

Запустите набор тестов из каталога проекта:

```sh
npm test
```

Первое создание окружения с time skipping может занять больше времени, потому что `@temporalio/testing` скачивает свой тестовый сервер. Последующие исполнения Workflow всё равно завершаются за секунды, а не тянутся всю бизнес-длительность.

## Выберите наименьшую полезную границу теста

Используйте три взаимодополняющих вида тестов:

- **Интеграционные тесты Workflow** должны составлять основную часть покрытия оркестрации. Запускайте настоящий бандл Workflow с Worker и подставными Activity, а затем проверяйте результаты, сообщения, таймеры и то, какие побочные эффекты были запрошены.
- **Модульные тесты Activity** должны вызывать обычную логику Activity напрямую. Если Activity читает `activityInfo`, отправляет heartbeat или проверяет состояние отмены, запускайте её в `MockActivityEnvironment`; внешний API или базу данных подменяйте отдельно.
- **Интеграционные проверки с настоящим Service** должны прогонять небольшой счастливый путь на локальном сервисе для разработки с настоящими Worker и Activity. Они ловят ошибки подключения, регистрации, Task Queue и сериализации, но работают медленнее и не должны заменять точечные тесты.

Такое разделение сохраняет тесты оркестрации быстрыми и при этом покрывает внешние операции и связывание приложения там, где этим задачам и место.

## Официальные ресурсы

- [Testing Temporal TypeScript applications](https://docs.temporal.io/develop/typescript/best-practices/testing-suite)
- [`TestWorkflowEnvironment` API](https://typescript.temporal.io/api/classes/testing.TestWorkflowEnvironment)
- [`Worker.runUntil` API](https://typescript.temporal.io/api/classes/worker.Worker#rununtil)
- [Workflow `condition` API](https://typescript.temporal.io/api/namespaces/workflow#condition)
- [Official TypeScript samples](https://github.com/temporalio/samples-typescript)
