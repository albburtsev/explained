---
slug: temporal/reliable-activities
title: Reliable Activities
description: Design retryable Temporal Activities with bounded timeouts, progress heartbeats, and idempotent external side effects.
tags:
  - temporal
  - typescript
  - activities
---

The previous lesson kept external work behind one Activity so that Workflow replay would not perform it directly. A real report pipeline has several independent failure boundaries: the BI service may be unavailable, rendering may take a long time, and delivery may succeed even when its response is lost.

This lesson splits that work into three Activities and gives each execution a retry and timeout contract.

## Draw the Activity boundary around one operation

An `Activity` is a normal TypeScript function that performs one well-defined action outside deterministic Workflow code. It runs in the standard Node.js environment, so it may call an API, query a database, read a file, or use an ordinary library.

The report pipeline needs three boundaries:

```text
Workflow
   │
   ├── fetchMetrics ─────────────▶ BI service
   ├── renderExecutiveReport ────▶ report renderer
   └── deliverReport ────────────▶ delivery provider
```

Splitting the operations lets Temporal retry a failed BI request without repeating a successful render or delivery. It also lets each Activity use timeouts appropriate to its work. Avoid making Activities so tiny that every local calculation becomes a durable call, or so broad that unrelated side effects must be retried together.

Activity arguments and results are recorded in Event History. Keep them serializable and reasonably small. This example passes metric values and report text directly; a large production report would usually pass a durable object-store reference instead.

## Implement the three Activities

Replace `src/activities.ts` with this cumulative version:

```ts
import { activityInfo, heartbeat, sleep } from '@temporalio/activity';

export interface ReportMetrics {
  reportDate: string;
  activeAccounts: number;
  monthlyRevenue: number;
}

export interface ExecutiveReport {
  reportDate: string;
  body: string;
}

interface RenderProgress {
  completedSections: number;
}

export async function fetchMetrics(
  reportDate: string,
): Promise<ReportMetrics> {
  const { attempt } = activityInfo();

  console.log(`Fetching metrics, attempt ${attempt}`);

  // A controlled transient failure for this lesson's retry experiment.
  if (attempt === 1) {
    throw new Error('BI service is temporarily unavailable');
  }

  return {
    reportDate,
    activeAccounts: 1_284,
    monthlyRevenue: 247_500,
  };
}

export async function renderExecutiveReport(
  metrics: ReportMetrics,
): Promise<ExecutiveReport> {
  const previous = activityInfo().heartbeatDetails as
    | RenderProgress
    | undefined;
  const sections = [
    `Report date: ${metrics.reportDate}`,
    `Active accounts: ${metrics.activeAccounts}`,
    `Monthly revenue: $${metrics.monthlyRevenue.toLocaleString('en-US')}`,
  ];
  const startAt = previous?.completedSections ?? 0;

  for (let index = startAt; index < sections.length; index += 1) {
    await sleep(500);
    heartbeat({ completedSections: index + 1 } satisfies RenderProgress);
  }

  return {
    reportDate: metrics.reportDate,
    body: sections.join('\n'),
  };
}

export async function deliverReport(
  report: ExecutiveReport,
  idempotencyKey: string,
): Promise<string> {
  // A real provider or durable outbox must atomically deduplicate this key.
  console.log('Delivering report', {
    idempotencyKey,
    body: report.body,
  });

  return `Report for ${report.reportDate} delivered with key ${idempotencyKey}`;
}
```

`fetchMetrics` fails only on its first Activity attempt. The TypeScript Activity context exposes the server-assigned attempt number, so the next attempt succeeds without process-global counters.

`renderExecutiveReport` illustrates a long-running operation in a short exercise. A heartbeat tells the Temporal Service that an Activity is alive and can attach checkpoint details. If an attempt times out and Temporal retries it, `heartbeatDetails` contains the latest details accepted by the Service. The Activity can resume from that point rather than repeat all completed work. Use this pattern for genuinely long or incremental work; a normal quick request does not need heartbeats.

The renderer reconstructs the final text from its input because heartbeat details are a checkpoint, not the Activity's final result. Heartbeats may be throttled, so code must tolerate resuming from an earlier checkpoint.

## Give executions explicit limits

Replace `src/workflows.ts` with:

```ts
import { log, proxyActivities, sleep } from '@temporalio/workflow';

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

export async function executiveReportWorkflow(
  reportDate: string,
): Promise<string> {
  log.info('Report accepted', { reportDate });

  await sleep('20 seconds');

  const metrics = await fetchMetrics(reportDate);
  const report = await renderExecutiveReport(metrics);
  const idempotencyKey = `executive-report:${reportDate}`;

  return await deliverReport(report, idempotencyKey);
}
```

Temporal requires at least one of these two Activity timeouts:

| Timeout | What it limits | Use it to answer |
| --- | --- | --- |
| `startToCloseTimeout` | One attempt, after a Worker starts it | How long may one invocation run? |
| `scheduleToCloseTimeout` | The whole Activity Execution, including queueing and retries | How long may the Workflow wait for eventual success? |

Using both creates a per-attempt limit and an overall retry budget. The heartbeat timeout is different: once rendering starts, Temporal expects another heartbeat within five seconds. A missed heartbeat makes that attempt time out and allows the retry policy to schedule another attempt.

Activities have a default Retry Policy even when `retry` is omitted: exponential backoff begins at one second, doubles up to a maximum interval of 100 seconds, and has unlimited attempts unless another limit closes the execution. That is a useful default for many transient failures. This lesson sets explicit caps so a broken dependency becomes visible within a predictable practice window.

Choose policies from operation semantics, not from a shared constant. A rate-limited API may need a longer interval; invalid input should usually produce a non-retryable `ApplicationFailure`; a business deadline belongs in the total Schedule-To-Close bound. Do not add a retry loop inside the Activity around Temporal's retry loop unless the inner retries serve a deliberately different purpose.

## Observe a retry

Keep the local Temporal Service running. Start or restart the Worker:

```sh
npm run start.watch
```

In another terminal, start the Workflow:

```sh
npm run workflow
```

After the durable 20-second wait, the Worker log should contain two fetch attempts:

```text
Fetching metrics, attempt 1
Fetching metrics, attempt 2
```

The Client still receives one successful Workflow result. In Temporal Web UI, open the execution and inspect `fetchMetrics`. Its first attempt failed, Temporal waited according to the Retry Policy, and the second attempt completed. Workflow code remained suspended at the same `await`; it did not restart the report pipeline from the beginning.

If every allowed attempt fails, or the Schedule-To-Close deadline expires, the Activity proxy rejects in Workflow code with an Activity failure. The Workflow can catch that failure and choose another durable path. In this version it is unhandled, so the execution reports failure to the Client rather than advancing to rendering or delivery.

## Protect side effects from duplicate attempts

Temporal durably orchestrates Activity execution, but it cannot make an external side effect exactly once. Consider this failure sequence:

1. `deliverReport` asks the provider to send the message.
2. The provider sends it.
3. The Activity process crashes before Temporal records completion.
4. Temporal retries the Activity because the outcome is unknown.

Both attempts are valid from Temporal's perspective. The external system must make the repeated request safe. Common approaches are:

- send a stable idempotency key to a provider that records and deduplicates it;
- insert a unique operation key and an outbox record in one database transaction;
- make a naturally idempotent state change, such as setting a value rather than incrementing it.

The Workflow derives `executive-report:<reportDate>` once and passes it into delivery. The local Activity only logs that key; an in-memory `Set` would be a misleading substitute because it disappears during the same process failure that causes a retry. In production, the delivery provider or a durable database must enforce uniqueness atomically.

Retries also apply to reads and other operations without visible side effects. Those calls should still be bounded by timeouts and safe to repeat, but delivery is where confusing durable orchestration with exactly-once delivery is most costly.

## Review the Activity contract

- Put external, nondeterministic operations in Activities and keep each boundary coherent.
- Expect an Activity attempt to run more than once.
- Bound one attempt with Start-To-Close and the whole retry window with Schedule-To-Close.
- Use heartbeats and checkpoint details only for long-running or incremental work.
- Let retryable failures propagate to Temporal; classify permanent failures as non-retryable.
- Give side effects a stable idempotency key enforced by the external system or a durable store.

## Official resources

- [Activity basics in the TypeScript SDK](https://docs.temporal.io/develop/typescript/activities/basics)
- [Activity execution in the TypeScript SDK](https://docs.temporal.io/develop/typescript/activities/execution)
- [Activity timeouts, retries, and heartbeats](https://docs.temporal.io/develop/typescript/activities/timeouts)
- [Retry Policy defaults and properties](https://docs.temporal.io/encyclopedia/retry-policies)
- [TypeScript Activity API reference](https://typescript.temporal.io/api/namespaces/activity)
