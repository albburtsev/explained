---
slug: temporal/workflow-messages
title: Сообщения Workflow
description: Используйте типизированные Query, Signal и Update, чтобы наблюдать за работающим Workflow в Temporal и управлять им.
---

Workflow для отчёта руководству уже переживает сбои, но по-прежнему проходит от начала до конца без какого-либо участия извне. Настоящий отчёт должен показывать свой прогресс, позволять аналитику менять список получателей и надёжно дожидаться одобрения.

Для этих разных договорённостей в Temporal есть три типа сообщений:

| Сообщение | Может читать состояние | Может менять состояние | Возвращает значение вызывающей стороне | Записывается в Event History |
| --- | --- | --- | --- | --- |
| Query | Да | Нет | Да | Нет |
| Signal | Да | Да | Нет | Да |
| Update | Да | Да | Да | Записываются принятые и завершённые Update |

Query служит для наблюдения. Signal — это долговечная асинхронная команда: вызов в Client возвращается, когда Temporal Service принял сигнал, а не когда его обработал код Workflow. Update — это отслеживаемый запрос: он доходит до Worker, может быть отклонён валидатором и позволяет вызывающей стороне дождаться результата.

## Определите типизированные контракты сообщений

Определения сообщений размещаются на уровне модуля, чтобы код Workflow и код Client могли импортировать одни и те же типизированные объекты. Замените `src/workflows.ts` этой итоговой версией:

```ts
import {
  condition,
  defineQuery,
  defineSignal,
  defineUpdate,
  log,
  proxyActivities,
  setHandler,
  sleep,
} from '@temporalio/workflow';

import type * as activities from './activities';

type QuickActivities = Pick<
  typeof activities,
  'fetchMetrics' | 'deliverReport'
>;

type RenderingActivities = Pick<
  typeof activities,
  'renderExecutiveReport'
>;

const { fetchMetrics, deliverReport } = proxyActivities<QuickActivities>({
  startToCloseTimeout: '10 seconds',
  scheduleToCloseTimeout: '1 minute',
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumInterval: '5 seconds',
    maximumAttempts: 4,
  },
});

const { renderExecutiveReport } = proxyActivities<RenderingActivities>({
  startToCloseTimeout: '1 minute',
  scheduleToCloseTimeout: '2 minutes',
  heartbeatTimeout: '5 seconds',
  retry: {
    maximumAttempts: 3,
  },
});

export type ReportPhase =
  | 'preparing'
  | 'awaiting-approval'
  | 'delivering';

export interface ReportStatus {
  phase: ReportPhase;
  recipients: string[];
  approvedBy?: string;
}

export interface ApproveReportInput {
  approvedBy: string;
}

export interface ChangeRecipientsInput {
  recipients: string[];
}

export interface ChangeRecipientsResult {
  previousRecipients: string[];
  currentRecipients: string[];
}

export const getReportStatus =
  defineQuery<ReportStatus>('getReportStatus');
export const approveReport =
  defineSignal<[ApproveReportInput]>('approveReport');
export const changeRecipients = defineUpdate<
  ChangeRecipientsResult,
  [ChangeRecipientsInput]
>('changeRecipients');

export async function executiveReportWorkflow(
  reportDate: string,
): Promise<string> {
  let phase: ReportPhase = 'preparing';
  let recipients = ['leadership@example.com'];
  let approvedBy: string | undefined;

  setHandler(getReportStatus, () => ({
    phase,
    recipients: [...recipients],
    approvedBy,
  }));

  setHandler(approveReport, ({ approvedBy: name }: ApproveReportInput) => {
    if (name.trim().length > 0) {
      approvedBy = name.trim();
    }
  });

  setHandler(
    changeRecipients,
    ({ recipients: nextRecipients }: ChangeRecipientsInput) => {
      const previousRecipients = [...recipients];
      recipients = [...nextRecipients];

      return {
        previousRecipients,
        currentRecipients: [...recipients],
      };
    },
    {
      validator: ({ recipients: nextRecipients }: ChangeRecipientsInput) => {
        if (approvedBy !== undefined) {
          throw new Error('Recipients cannot change after approval');
        }

        if (
          nextRecipients.length === 0 ||
          nextRecipients.some((recipient) => !recipient.includes('@')) ||
          new Set(nextRecipients).size !== nextRecipients.length
        ) {
          throw new Error(
            'Recipients must be a non-empty list of unique email addresses',
          );
        }
      },
    },
  );

  log.info('Report accepted', { reportDate });
  await sleep('20 seconds');

  const metrics = await fetchMetrics(reportDate);
  const report = await renderExecutiveReport(metrics);

  phase = 'awaiting-approval';
  await condition(() => approvedBy !== undefined);

  phase = 'delivering';
  const idempotencyKey = `executive-report:${reportDate}`;

  return await deliverReport(report, recipients, idempotencyKey);
}
```

`defineQuery`, `defineSignal` и `defineUpdate` описывают имена сообщений и их сигнатуры в TypeScript, но никакого поведения не устанавливают. `setHandler` связывает каждое определение с состоянием данного Workflow Execution.

Регистрируйте обработчики до первого `await`. Тогда Query станет доступен сразу после запуска Workflow, а каждый обработчик замкнёт уже инициализированное состояние. Signal и Update, отправленные очень рано, могут быть буферизованы до регистрации своих обработчиков, а вот Query без доступного обработчика завершается ошибкой.

Обработчики выше намеренно синхронны. Обработчики Signal и Update могут быть и асинхронными, но тогда они выполняются параллельно с основным Workflow и требуют внимания к порядку событий и к завершению Workflow. В этом примере внешняя работа остаётся в основной последовательности.

## Ждите, не занимая Worker

После рендеринга Workflow устанавливает фазу и ждёт:

```ts
await condition(() => approvedBy !== undefined);
```

`condition` приостанавливает продвижение Workflow до тех пор, пока состояние Workflow не сделает предикат истинным. Он не опрашивает, не занимает поток Worker и не вводит таймаут, если вы его не передадите. Обработчик `approveReport` изменяет `approvedBy`; SDK заново вычисляет заблокированные условия, и доставка может продолжиться.

Одобрение может прийти, пока отчёт ещё готовится. Поскольку обработчик установлен первым, Signal обновляет долговечное состояние Workflow, и к тому моменту, когда исполнение доберётся до условия, оно уже будет выполнено. Так исчезает временно́е окно между «готов к одобрению» и «ждёт одобрения».

Signal игнорирует пустое имя одобряющего, но не может сообщить об этом решении отправителю. Если вызывающей стороне нужен результат проверки или иной результат, используйте Update.

## Передайте получателей в доставку

Теперь Workflow передаёт в Activity одобренный список получателей. В `src/activities.ts` замените только `deliverReport`:

```ts
export async function deliverReport(
  report: ExecutiveReport,
  recipients: string[],
  idempotencyKey: string,
): Promise<string> {
  // A real provider or durable outbox must atomically deduplicate this key.
  console.log('Delivering report', {
    idempotencyKey,
    recipients,
    body: report.body,
  });

  return `Report for ${report.reportDate} delivered to ${recipients.join(', ')}`;
}
```

Валидатор Update отклоняет пустой список, простые некорректные значения, дубликаты и изменения после одобрения. Отклонённый Update не меняет состояние Workflow и не попадает в Event History как принятый. Если проверка пройдена, обработчик заменяет список и возвращает и прежнее, и текущее значение.

Проверка `includes('@')` годится лишь для локального примера. Настоящая проверка адресов и авторизация относятся к границе приложения; валидатор Workflow должен следить за соблюдением детерминированных бизнес-правил, которые защищают его состояние.

## Отправьте все три сообщения из Client

Client взаимодействует с одним исполнением через `WorkflowHandle`. Handle, который возвращает `client.workflow.start`, уже нацелен на новое исполнение. Замените `src/client.ts` на:

```ts
import { Client, Connection } from '@temporalio/client';
import { loadClientConnectConfig } from '@temporalio/envconfig';
import { nanoid } from 'nanoid';

import {
  approveReport,
  changeRecipients,
  executiveReportWorkflow,
  getReportStatus,
} from './workflows';

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

  console.log('Started', handle.workflowId);
  console.log('Initial status', await handle.query(getReportStatus));

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
  console.log('Recipients changed', changed);

  await handle.signal(approveReport, { approvedBy: 'Maya' });
  console.log('Approval accepted by the Service');

  console.log(await handle.result());
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

`handle.query` ждёт, пока Worker вычислит обработчик, предназначенный только для чтения, и возвращает текущий снимок состояния. Query не добавляет в Event History ни одного Event.

`handle.executeUpdate` ждёт, пока Worker проверит и завершит Update, а затем возвращает `ChangeRecipientsResult`. Если валидатор выбрасывает исключение, вызов завершается с ошибкой, а список получателей остаётся прежним.

`handle.signal` возвращается, как только Service принял Signal. Он не ждёт выполнения обработчика, поэтому строка в логе означает «надёжно принят», а не «логика одобрения завершена». Последующее ожидание `handle.result()` позволяет проследить Workflow до доставки и завершения.

Если другой процесс уже знает Workflow ID, он может заново подключиться к тому же исполнению, не запуская новое:

```ts
const handle = client.workflow.getHandle(workflowId);
const status = await handle.query(getReportStatus);

await handle.signal(approveReport, { approvedBy: 'Maya' });
```

Handle — это адрес на стороне Client, по которому отправляют команды, а не владелец состояния Workflow. Закрытие Client не останавливает исполнение.

## Запустите взаимодействие

Не останавливайте локальный Temporal Service. Запустите Worker:

```sh
npm run start.watch
```

В другом терминале запустите Client:

```sh
npm run workflow
```

В выводе должны появиться начальное состояние, результат Update, подтверждение приёма Signal и, наконец, доставка:

```text
Started executive-report-2026-08-22-<unique-id>
Initial status { phase: 'preparing', recipients: [ 'leadership@example.com' ] }
Recipients changed {
  previousRecipients: [ 'leadership@example.com' ],
  currentRecipients: [ 'ceo@example.com', 'finance@example.com' ]
}
Approval accepted by the Service
Report for 2026-08-22 delivered to ceo@example.com, finance@example.com
```

Откройте исполнение в Temporal Web UI. Event History содержит принятый и завершённый Update, а также событие Signal, но не Query. Возможно, вы не увидите, как исполнение задерживается в фазе `awaiting-approval`, потому что этот Client отправляет одобрение сразу. Чтобы понаблюдать за этой фазой, закомментируйте вызов Signal, запустите Workflow, запросите его состояние из другого Client по Workflow ID, а затем отправьте одобрение.

## Выбирайте контракт осознанно

- Используйте Query для текущего представления только для чтения, которому не нужно становиться частью Event History.
- Используйте Signal, когда важен надёжный приём, но отправителю не нужен результат обработчика.
- Используйте Update, когда Worker должен проверить или выполнить изменение состояния и вернуть результат или ошибку.
- Регистрируйте обработчики рано и выражайте долговечное ожидание состояния Workflow через `condition`.
- Входные данные и результаты сообщений должны быть сериализуемыми — так же, как аргументы Workflow и Activity.

## Официальные ресурсы

- [Workflow message passing in the TypeScript SDK](https://docs.temporal.io/develop/typescript/workflows/message-passing)
- [TypeScript Workflow API](https://typescript.temporal.io/api/namespaces/workflow)
- [Official TypeScript message-passing sample](https://github.com/temporalio/samples-typescript/tree/main/message-passing/introduction)
- [Queries, Signals, and Updates](https://docs.temporal.io/encyclopedia/workflow-message-passing)
