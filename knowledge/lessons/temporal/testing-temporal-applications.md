---
slug: temporal/testing-temporal-applications
title: Testing Temporal Applications
description: Test a TypeScript Workflow with fake Activities, message assertions, and fast-forwarded durable time.
tags:
  - temporal
  - typescript
  - testing
---

The executive-report Workflow now coordinates external work and waits for an analyst's approval. Calling the Workflow function directly would miss most of the behavior that matters: Activity scheduling, message handlers, durable timers, serialization, and interaction through a Client.

A practical Workflow test instead runs the real Workflow bundle in a Worker connected to Temporal's test server. The test replaces external Activities with fast in-memory implementations, but exercises Workflow orchestration through the same Client APIs used by the application.

## Bound the approval wait

The previous lesson waits indefinitely for approval. Give that business wait an explicit limit so that both outcomes are testable. In `src/workflows.ts`, extend `ReportPhase`:

```ts
export type ReportPhase =
  | 'preparing'
  | 'awaiting-approval'
  | 'delivering'
  | 'approval-expired';
```

Then replace the unbounded approval condition and the lines immediately after it with:

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

The two-argument form of `condition` returns `true` when the predicate becomes true before the durable timer expires and `false` on timeout. The timer belongs to Workflow state, so it survives Worker restarts. A late approval cannot revive this execution after it has returned; an application that needs a new attempt should start a new Workflow according to its business identity rules.

## Build a Workflow test harness

The current Hello World scaffold already includes Mocha, `@temporalio/testing`, and this test command:

```sh
npm test
```

Create `src/mocha/workflows.test.ts`:

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

`TestWorkflowEnvironment.createTimeSkipping()` starts an isolated test service and exposes two connections: `env.client` for test interactions and `env.nativeConnection` for the Worker. `Worker.runUntil` polls the unique Task Queue until the supplied operation completes, then shuts the Worker down. `env.teardown()` closes the test service after the suite.

The fake Activities preserve the production function signatures through `typeof activities`. They make the test deterministic, avoid the intentional first-attempt failure in `fetchMetrics`, and record delivery as a test observation. The real Activity implementations and external systems are not involved.

## Exercise messages and time

The approval-path test starts an execution instead of merely awaiting `workflow.execute`. That gives the test a typed handle while the Workflow is open, allowing it to:

1. Query the initial state.
2. Execute the recipient Update and assert its result.
3. Signal approval and Query the state that the handler changed.
4. Await the final result and verify that delivery happened exactly once.

The timeout-path test deliberately sends no approval. Awaiting `env.client.workflow.execute` enables automatic time skipping: when no Activity is running, the test service advances through the initial 20-second timer and the 24-hour condition timeout without waiting for wall-clock time. The final assertion also proves that the delivery Activity was never scheduled.

Time is global within one `TestWorkflowEnvironment`. Mocha runs these tests serially by default; if a suite enables parallel execution, give tests that manually control time separate environments or keep that group serial.

Run the suite from the project directory:

```sh
npm test
```

The first creation of the time-skipping environment can take longer because `@temporalio/testing` downloads its test server. Subsequent Workflow executions still complete in seconds rather than waiting through the business duration.

## Choose the smallest useful test boundary

Use three complementary test shapes:

- **Workflow integration tests** should form most orchestration coverage. Run the real Workflow bundle with a Worker and fake Activities, then assert results, messages, timers, and which side effects were requested.
- **Activity unit tests** should call ordinary Activity logic directly. When an Activity reads `activityInfo`, heartbeats, or cancellation state, run it with `MockActivityEnvironment`; mock the external API or database separately.
- **Real-Service integration checks** should run a small happy path against the local development Service with the real Worker and Activities. They catch connection, registration, Task Queue, and serialization mistakes, but are slower and should not replace focused tests.

This separation keeps durable orchestration tests fast while still testing external operations and application wiring at the boundaries where those concerns belong.

## Official resources

- [Testing Temporal TypeScript applications](https://docs.temporal.io/develop/typescript/best-practices/testing-suite)
- [`TestWorkflowEnvironment` API](https://typescript.temporal.io/api/classes/testing.TestWorkflowEnvironment)
- [`Worker.runUntil` API](https://typescript.temporal.io/api/classes/worker.Worker#rununtil)
- [Workflow `condition` API](https://typescript.temporal.io/api/namespaces/workflow#condition)
- [Official TypeScript samples](https://github.com/temporalio/samples-typescript)
