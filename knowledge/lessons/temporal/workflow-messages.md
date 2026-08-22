---
slug: temporal/workflow-messages
title: Workflow Messages
description: Use typed Queries, Signals, and Updates to inspect and control a running Temporal Workflow.
tags:
  - temporal
  - typescript
  - workflow-messages
---

The executive-report Workflow can survive failures, but it still runs from start to finish without outside input. A real report should expose its progress, let an analyst change the delivery list, and wait durably for approval.

Temporal provides three message types for these different contracts:

| Message | May read state | May change state | Returns a Workflow result | Recorded in Event History |
| --- | --- | --- | --- | --- |
| Query | Yes | No | Yes | No |
| Signal | Yes | Yes | No | Yes |
| Update | Yes | Yes | Yes | Accepted and completed Updates are recorded |

A Query is for observation. A Signal is a durable asynchronous command: the Client call returns when the Temporal Service accepts it, not when Workflow code handles it. An Update is a tracked request that reaches a Worker, may be rejected by a validator, and lets the caller wait for a result.

## Define typed message contracts

Message definitions belong at module scope so Workflow and Client code can import the same typed objects. Replace `src/workflows.ts` with this cumulative version:

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

`defineQuery`, `defineSignal`, and `defineUpdate` describe message names and TypeScript signatures; they do not install behavior. `setHandler` connects each definition to the state of this Workflow Execution.

Register handlers before the first `await`. That makes the Query available as soon as the Workflow starts and ensures every handler closes over initialized state. Signals and Updates sent very early can be buffered until their handlers are registered, but Queries fail when no handler is available.

The handlers above are deliberately synchronous. Signal and Update handlers may be asynchronous, but then they run concurrently with the main Workflow and require care around ordering and Workflow completion. Keep external work in the main sequence for this example.

## Wait without holding a Worker

After rendering, the Workflow sets its phase and waits on:

```ts
await condition(() => approvedBy !== undefined);
```

`condition` suspends Workflow progress until Workflow state makes the predicate true. It does not poll, occupy a Worker thread, or impose a timeout unless you pass one. The `approveReport` handler changes `approvedBy`; the SDK reevaluates blocked conditions, and delivery can continue.

Approval can arrive while the report is still being prepared. Because the handler was installed first, the Signal updates durable Workflow state, and the later condition is already satisfied when execution reaches it. This avoids a timing window between “ready for approval” and “waiting for approval.”

The Signal ignores a blank approver name, but it cannot return that decision to its sender. Use an Update when the caller must receive validation or a result.

## Pass recipients to delivery

The Workflow now sends the approved recipient list to the Activity. In `src/activities.ts`, replace only `deliverReport` with:

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

The Update validator rejects an empty list, simple malformed values, duplicates, and changes after approval. A rejected Update does not mutate Workflow state and is not accepted into Event History. If validation succeeds, the handler replaces the list and returns both the previous and current values.

The `includes('@')` check is intentionally only enough for a local example. Production address validation and authorization belong at the application boundary; the Workflow validator should enforce the deterministic business rules that protect its state.

## Send all three messages from a Client

A Client interacts with one execution through a `WorkflowHandle`. The handle returned by `client.workflow.start` already targets the new execution. Replace `src/client.ts` with:

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

`handle.query` waits for the Worker to evaluate the read-only handler and returns its current snapshot. The Query adds no Event to Event History.

`handle.executeUpdate` waits for the Worker to validate and complete the Update, then returns `ChangeRecipientsResult`. If the validator throws, the call rejects and the recipient list remains unchanged.

`handle.signal` returns after the Service accepts the Signal. It does not wait for the handler to run, so the log line means “durably accepted,” not “approval logic completed.” Waiting on `handle.result()` then observes the Workflow through delivery and completion.

If another process already knows the Workflow ID, it can reconnect to the same execution instead of starting a new one:

```ts
const handle = client.workflow.getHandle(workflowId);
const status = await handle.query(getReportStatus);

await handle.signal(approveReport, { approvedBy: 'Maya' });
```

The handle is a Client-side address and command surface, not the owner of Workflow state. Closing the Client does not stop the execution.

## Run the interaction

Keep the local Temporal Service running. Start the Worker:

```sh
npm run start.watch
```

In another terminal, run the Client:

```sh
npm run workflow
```

The output should show the initial state, the Update result, Signal acceptance, and eventual delivery:

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

In Temporal Web UI, open the execution. The Event History contains the accepted and completed Update plus the Signal event, but not the Query. The execution may not visibly remain in `awaiting-approval` because this Client sends approval immediately. To observe that phase, comment out the Signal call, run the Workflow, query it from another Client using its Workflow ID, and then send approval.

## Choose the contract deliberately

- Use a Query for a current read-only view that does not need to become part of Event History.
- Use a Signal when durable acceptance matters but the sender does not need a handler result.
- Use an Update when the Worker must validate or perform a state change and return a result or error.
- Register handlers early and use `condition` to express durable waits on Workflow state.
- Keep message inputs and results serializable, just like Workflow and Activity arguments.

## Official resources

- [Workflow message passing in the TypeScript SDK](https://docs.temporal.io/develop/typescript/workflows/message-passing)
- [TypeScript Workflow API](https://typescript.temporal.io/api/namespaces/workflow)
- [Official TypeScript message-passing sample](https://github.com/temporalio/samples-typescript/tree/main/message-passing/introduction)
- [Queries, Signals, and Updates](https://docs.temporal.io/encyclopedia/workflow-message-passing)
