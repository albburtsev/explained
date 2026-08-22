---
slug: temporal/schedules
title: Schedules
description: Start the report Workflow on a daily calendar, prevent overlapping runs, and manage the Schedule lifecycle.
tags:
  - temporal
  - typescript
  - schedules
---

The report Workflow is now durable, interactive, and tested, but every execution still begins with a direct Client call. A `Schedule` moves recurring start times into the Temporal Service. The Service evaluates the timing rules and starts a new Workflow Execution for each matching time, even when the scheduling Client is no longer running.

Use Schedules for new recurring automation. Temporal also supports the older `cronSchedule` Workflow start option, but recommends Schedules because they have a separate identity and can be described, triggered, paused, updated, and deleted independently of the Workflow Executions they start.

## Separate Schedule time from Workflow time

The earlier Client and tests pass an explicit report date:

```ts
args: ['2026-08-22'],
```

A long-lived Schedule must not capture its creation date and send that same value every day. Make the existing Workflow parameter optional and derive a date inside each execution when the caller omits it. In `src/workflows.ts`, change the beginning of `executiveReportWorkflow` to:

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

Keep every later use of `reportDate` unchanged. Existing direct starts and tests still pass a string and therefore keep their exact behavior. The Schedule will pass no argument, so each new execution derives its own date.

Inside TypeScript Workflow code, `new Date()` and `Date.now()` use deterministic Workflow time. Temporal supplies the same value during replay, so deriving the fallback inside the Workflow does not introduce nondeterminism. The ISO expression deliberately produces a `YYYY-MM-DD` date in UTC. The Schedule below fires at 09:00 in London, when the London and UTC calendar dates are the same.

Do not calculate the fallback in the Schedule creation script. That script runs once, whereas the Workflow function runs once for every Workflow Execution started by the Schedule.

## Create a daily Schedule

Add `src/schedule.ts`:

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

The `Schedule ID` identifies the durable scheduling resource. It is the value used to retrieve a Schedule handle and manage the timing configuration. The Schedule is not a Workflow Execution and does not run the report code itself.

The action describes what to start at each matching time:

- `workflowType` selects `executiveReportWorkflow`.
- `taskQueue` routes every resulting Workflow Task to the existing report Worker.
- `args: []` asks each execution to derive its date from deterministic Workflow time.
- `workflowId` supplies the readable base `executive-report-daily`; Temporal appends the action timestamp to that base, so each start has a distinct Workflow ID, Run ID, and Event History.

`calendars` describes wall-clock matches more clearly than a cron string for this use case. Unspecified calendar fields match their defaults: the hour and minute select 09:00, while day, month, and year remain unrestricted. `timezone` is an IANA time-zone name interpreted by the Temporal Service. Without it, the Schedule uses UTC. Explicit local time zones can be affected by daylight-saving transitions, so avoid ambiguous or nonexistent hours when the business rule permits it.

## Prevent overlapping approval waits

One report can remain open for up to 24 hours while it waits for approval. If the next daily start arrives before the previous execution closes, `ScheduleOverlapPolicy.SKIP` tells the Service not to start the new action. It does not cancel, terminate, or queue another report.

The policy is written explicitly even though `SKIP` is the server default. Here it documents a business decision: at most one Schedule-started report should be awaiting approval. A different process that starts `executiveReportWorkflow` directly is outside this Schedule's overlap accounting.

The manual trigger also passes `ScheduleOverlapPolicy.SKIP`. This gives the practice action the same safety rule: triggering while a Schedule-started report is still open is skipped instead of creating a concurrent approval request.

## Exercise the lifecycle

Keep the local Temporal Service and report Worker running. From the project directory, create the Schedule:

```sh
npx ts-node src/schedule.ts create
```

Creating a Schedule with the same Schedule ID again fails because the resource already exists. Retrieve its current state instead:

```sh
npx ts-node src/schedule.ts describe
```

The description includes future action times and recent or currently running Workflow identities. This is where the two identity layers become visible: one Schedule ID points to several Workflow Executions over time.

Trigger an action now rather than waiting until 09:00:

```sh
npx ts-node src/schedule.ts trigger
```

Open Temporal Web UI and find the new execution whose Workflow ID begins with `executive-report-daily-`. It should reach `awaiting-approval` after the Activities finish. You can approve it with the Signal Client pattern from the Workflow Messages lesson.

Pause and inspect the Schedule:

```sh
npx ts-node src/schedule.ts pause
npx ts-node src/schedule.ts describe
```

Pausing stops future scheduled actions. It does not pause, cancel, or terminate an execution that has already started. Resume future actions with:

```sh
npx ts-node src/schedule.ts unpause
```

Finally, remove the practice Schedule so it does not start another report tomorrow:

```sh
npx ts-node src/schedule.ts delete
```

Deleting a Schedule removes its future timing configuration but does not delete or terminate Workflow Executions it already started. After deletion, `describe` fails because that Schedule ID no longer resolves.

## Review the scheduling boundary

- A Schedule is a durable Service resource with its own Schedule ID and lifecycle.
- Each matching time starts a separate Workflow Execution with its own Event History.
- A calendar and IANA time zone express the daily wall-clock rule.
- The action's Task Queue must be polled by a Worker that registers the selected Workflow Type.
- `SKIP` prevents a second Schedule action while an earlier Schedule-started report remains open.
- Pause affects future actions; delete removes the Schedule but leaves started executions intact.

## Official resources

- [Schedules in the TypeScript SDK](https://docs.temporal.io/develop/typescript/workflows/schedules)
- [TypeScript `ScheduleClient` API](https://typescript.temporal.io/api/classes/client.ScheduleClient)
- [TypeScript Schedule types and overlap policies](https://typescript.temporal.io/api/namespaces/client#scheduleoverlappolicy)
- [Official TypeScript Schedules sample](https://github.com/temporalio/samples-typescript/tree/main/schedules)
- [Temporal Schedule concepts](https://docs.temporal.io/schedule)
