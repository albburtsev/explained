---
slug: temporal/patched
title: Patched
description: Change the code of running Temporal Workflows safely with patched, catch incompatible changes with a replay test, and retire the patch later.
tags:
  - temporal
  - typescript
  - versioning
---

A report Workflow can wait up to 24 hours for approval. During that time, you may deploy new Workflow code. The Durable Workflows lesson explained why this is risky. A Worker rebuilds an execution by replaying its Event History through the current code. If the new code produces different Commands than the history records, replay fails.

In this lesson, you break a waiting report on purpose and repair it with `patched`. Then you add a replay test that catches the same mistake before deployment.

## Know which changes need a patch

Replay checks the Commands that Workflow code produces: scheduling Activities, starting timers, completing the Workflow, and other durable operations. A change needs a `patch` when an open execution would see a different sequence of these Commands. Typical examples are:

- adding, removing, or reordering an Activity call or a `sleep`;
- replacing one Activity with another;
- changing a branch so that it schedules different work.

Other changes do not affect replay. Temporal never replays an Activity, so you can change the body of an Activity function freely. A new log message or a local calculation that produces no Command is also safe. When you are not sure, run a replay test, as shown later in this lesson.

## Start a report that waits for approval

Keep the local Temporal Service running. Start the Worker if it is not already running:

```sh
npm run start.watch
```

The Client from earlier lessons approves its report immediately. This time you need an execution that stays open, so start it with Temporal CLI. The Schedules lesson made the report date optional, so the command needs no input:

```sh
temporal workflow start \
  --type executiveReportWorkflow \
  --task-queue executive-report \
  --workflow-id executive-report-patching-demo
```

Wait about half a minute for the 20-second timer, the retried metrics fetch, and rendering. Then query the status:

```sh
temporal workflow query \
  --workflow-id executive-report-patching-demo \
  --name getReportStatus
```

The phase should be `awaiting-approval`. The Event History of this execution already records `fetchMetrics`, followed by `renderExecutiveReport`. Leave the report waiting.

## Break the running report

The business now wants to archive the raw metrics before rendering, for audit. Add this Activity to `src/activities.ts`, after `fetchMetrics`:

```ts
export async function archiveMetrics(
  metrics: ReportMetrics,
): Promise<void> {
  // A real archive would write to durable storage keyed by report date.
  console.log('Archiving metrics', metrics);
}
```

In `src/workflows.ts`, add the new Activity to the quick Activities:

```ts
type QuickActivities = Pick<
  typeof activities,
  'fetchMetrics' | 'archiveMetrics' | 'deliverReport'
>;

const { fetchMetrics, archiveMetrics, deliverReport } =
  proxyActivities<QuickActivities>({
    startToCloseTimeout: '10 seconds',
    scheduleToCloseTimeout: '1 minute',
    retry: {
      initialInterval: '1 second',
      backoffCoefficient: 2,
      maximumInterval: '5 seconds',
      maximumAttempts: 4,
    },
  });
```

Then call it between fetching and rendering, without any protection:

```ts
const metrics = await fetchMetrics(reportDate);
await archiveMetrics(metrics);
const report = await renderExecutiveReport(metrics);
```

Save the files. The `start.watch` script restarts the Worker, and the new process has no cached copy of the execution. Now approve the report:

```sh
temporal workflow signal \
  --workflow-id executive-report-patching-demo \
  --name approveReport \
  --input '{"approvedBy": "Maya"}'
```

The Signal creates a new Workflow Task. To run it, the restarted Worker replays the history. After `fetchMetrics`, the new code asks to schedule `archiveMetrics`. The history says that the next Command scheduled `renderExecutiveReport`. The Worker detects the mismatch and logs a nondeterminism error.

Open the execution in [Temporal Web UI](http://localhost:8233). Its status is still Running, but its Workflow Task fails. A nondeterminism error does not fail the Workflow Execution. Temporal treats it as a Workflow Task failure and retries the task with growing intervals, up to 10 minutes apart. The report is stuck, but nothing is lost. It continues as soon as a Worker can replay it correctly.

## Wrap the change in patched

`patched(patchId)` lets one Workflow Definition serve both old and new executions. Its result depends on the history:

- When the Workflow is not replaying, `patched` returns `true` and adds a `marker` with the patch ID to Event History. The marker appears as a `MarkerRecorded` event.
- During replay, `patched` returns `true` only if the history contains that marker. A history written by older code has no marker, so the call returns `false`.

Add `patched` to the import from `@temporalio/workflow`:

```ts
import {
  condition,
  defineQuery,
  defineSignal,
  defineUpdate,
  log,
  patched,
  proxyActivities,
  setHandler,
  sleep,
} from '@temporalio/workflow';
```

Then wrap the new call:

```ts
const metrics = await fetchMetrics(reportDate);

if (patched('archive-metrics')) {
  await archiveMetrics(metrics);
}

const report = await renderExecutiveReport(metrics);
```

The `patch ID` names one change. Keep it short and descriptive. Use a new ID for every change, and never reuse an old ID for different code.

Save the file and let the Worker restart. On the next retry of the Workflow Task, `patched` returns `false`, so replay takes the old path and matches the history. The execution then continues with the approval that the Signal already recorded. The report is delivered without an archive step. That is correct: its metrics were fetched before archiving existed. Because the retry interval grows, recovery can take a few minutes. Watch the Worker log or Web UI until the execution completes.

Now start and approve a new report:

```sh
temporal workflow start \
  --type executiveReportWorkflow \
  --task-queue executive-report \
  --workflow-id executive-report-patched-run

temporal workflow signal \
  --workflow-id executive-report-patched-run \
  --name approveReport \
  --input '{"approvedBy": "Maya"}'
```

The approval arrives early, but the handler stores it until the Workflow reaches its approval wait. This time the Worker log prints `Archiving metrics`. In Web UI, the history of this execution contains a `MarkerRecorded` event followed by the `archiveMetrics` Activity. Both executions ran the same code. Their histories chose the path.

## Catch the problem with a replay test

The broken deployment became visible only after it reached a running execution. A `replay test` finds the problem earlier. It replays a saved history through the current Workflow code, without the Temporal Service.

Save the history of the demo execution as a test fixture. That history was recorded before the archive step existed:

```sh
mkdir -p histories
temporal workflow show \
  --workflow-id executive-report-patching-demo \
  --output json > histories/before-archive.json
```

Create `src/mocha/replay.test.ts`:

```ts
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Worker } from '@temporalio/worker';

describe('executiveReportWorkflow replay', function () {
  this.timeout(30_000);

  it('replays a history recorded before the archive step', async () => {
    const history = JSON.parse(
      await readFile(
        path.join(__dirname, '../../histories/before-archive.json'),
        'utf8',
      ),
    );

    await Worker.runReplayHistory(
      { workflowsPath: require.resolve('../workflows') },
      history,
    );
  });
});
```

`Worker.runReplayHistory` bundles the Workflow code and replays the history in memory. It rejects with `DeterminismViolationError` when the code and the history disagree.

The Workflow tests from the Testing lesson build their fake Activities from `typeof activities`. TypeScript now requires a fake for `archiveMetrics` too. In `src/mocha/workflows.test.ts`, add it to `fakeActivities`:

```ts
async archiveMetrics() {
  // The test does not need a real archive.
},
```

Run the suite:

```sh
npm test
```

All tests pass. To see what the replay test protects against, temporarily remove the `if (patched('archive-metrics'))` wrapper and keep only the bare `await archiveMetrics(metrics);` call. Run `npm test` again. The replay test now fails with a nondeterminism error. Restore the patch before you continue.

Keep fixtures in version control and run replay tests before every Worker deployment. Save a history for each important path through the Workflow. To check many executions at once, `Worker.runReplayHistories` replays a batch of histories, for example recent executions listed through a Client.

## Retire the patch

A patch is temporary. The old branch must stay while Temporal might still replay an execution that was started without the marker. Closed executions count too, until the Namespace retention period removes them, because a Query or a reset can replay a closed execution. Remove the patch in two deployments.

First, when no execution without the marker remains, replace the branch with `deprecatePatch`. Import it from `@temporalio/workflow` in place of `patched`:

```ts
const metrics = await fetchMetrics(reportDate);

deprecatePatch('archive-metrics');
await archiveMetrics(metrics);

const report = await renderExecutiveReport(metrics);
```

`deprecatePatch` always runs the new code. It still writes the marker in new executions, but it marks that marker as deprecated so that later code may ignore it. Workers with the `patched` version and Workers with this version can run side by side during the rollout. The `before-archive.json` fixture no longer replays at this step, so replace it with a history recorded by the patched code.

Second, when no execution started by the `patched` version remains, delete the `deprecatePatch` call. The code is then plain again:

```ts
const metrics = await fetchMetrics(reportDate);
await archiveMetrics(metrics);
const report = await renderExecutiveReport(metrics);
```

## Know the alternatives

Patching is not the only way to change Workflow code. Two other approaches fit different situations:

- `Worker Versioning` pins each execution to the Worker Deployment Version that started it. Old Workers keep serving old executions while new executions go to new Workers, so many changes need no patch. The cost is running and managing several Worker versions at once.
- A new Workflow Type, such as `executiveReportWorkflowV2`, copies the code under a new name. Open executions keep the old type, so Workers must register both until those executions close. Every Client and Schedule must also switch to the new name.

Patching fits a small change in a Workflow that keeps one set of Workers. It needs no deployment infrastructure, but each patch adds a branch that you must later remove.

## Review the change contract

- Replay compares the Commands of the current code with Event History. Changing their sequence for an open execution causes a nondeterminism error.
- A nondeterminism error fails the Workflow Task, not the execution. Temporal retries the task until a compatible Worker can replay it.
- `patched` returns `true` and records a marker in new executions. It returns `false` when replaying a history without that marker.
- Replay tests run saved histories through new code before deployment.
- Retire a patch with `deprecatePatch`, then remove it once no execution that needs the old branch can be replayed.

## Official resources

- [Versioning in the TypeScript SDK](https://docs.temporal.io/develop/typescript/versioning)
- [Replay testing in the TypeScript SDK](https://docs.temporal.io/develop/typescript/best-practices/testing-suite#replay)
- [TypeScript `patched` API](https://typescript.temporal.io/api/namespaces/workflow#patched)
- [Official TypeScript patching sample](https://github.com/temporalio/samples-typescript/tree/main/patching-api)
- [Worker Versioning](https://docs.temporal.io/production-deployment/worker-deployments/worker-versioning)
