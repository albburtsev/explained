---
slug: temporal/patched
title: Patched
description: Безопасно меняйте код уже идущих Workflow в Temporal с помощью patched, ловите несовместимые изменения replay-тестом и со временем убирайте патч.
---

Workflow отчёта может ждать одобрения до 24 часов, и за это время вы вполне можете выкатить новый код. Чем это опасно, мы уже видели в уроке о долговечных Workflow: Worker восстанавливает выполнение, проигрывая его Event History через текущий код. Если новый код порождает не те Command, что записаны в истории, replay завершается ошибкой.

В этом уроке вы намеренно сломаете ожидающий отчёт и почините его с помощью `patched`. А затем добавите replay-тест, который ловит ту же ошибку ещё до развёртывания.

## Поймите, каким изменениям нужен патч

При replay проверяются Command, которые порождает код Workflow: планирование Activity, запуск таймеров, завершение Workflow и другие долговечные операции. `Patch` нужен тогда, когда открытое выполнение увидело бы другую последовательность этих Command. Типичные примеры:

- добавить, удалить или переставить вызов Activity или `sleep`;
- заменить одну Activity другой;
- изменить ветвление так, что оно планирует другую работу.

Другие изменения на replay не влияют. Temporal никогда не проигрывает Activity заново, поэтому тело функции Activity можно менять свободно. Новое сообщение в журнале или локальное вычисление, которое не порождает Command, тоже безопасны. Если сомневаетесь, запустите replay-тест — о нём речь пойдёт ниже.

## Запустите отчёт, который ждёт одобрения

Не останавливайте локальный Temporal Service. Запустите Worker, если он ещё не работает:

```sh
npm run start.watch
```

Client из прошлых уроков одобряет свой отчёт сразу же. Сейчас же нужно выполнение, которое останется открытым, поэтому запустите его через Temporal CLI. В уроке о Schedule дата отчёта стала необязательной, так что входные данные команде не нужны:

```sh
temporal workflow start \
  --type executiveReportWorkflow \
  --task-queue executive-report \
  --workflow-id executive-report-patching-demo
```

Подождите около полуминуты: за это время пройдут 20-секундный таймер, повторная попытка получить метрики и рендеринг. Затем запросите состояние:

```sh
temporal workflow query \
  --workflow-id executive-report-patching-demo \
  --name getReportStatus
```

Фаза должна быть `awaiting-approval`. В Event History этого выполнения уже записаны `fetchMetrics`, а за ней `renderExecutiveReport`. Оставьте отчёт ждать.

## Сломайте идущий отчёт

Теперь бизнесу понадобилось для аудита архивировать исходные метрики перед рендерингом. Добавьте в `src/activities.ts` после `fetchMetrics` такую Activity:

```ts
export async function archiveMetrics(
  metrics: ReportMetrics,
): Promise<void> {
  // A real archive would write to durable storage keyed by report date.
  console.log('Archiving metrics', metrics);
}
```

В `src/workflows.ts` добавьте новую Activity к быстрым Activity:

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

А затем вызовите её между получением метрик и рендерингом, без всякой защиты:

```ts
const metrics = await fetchMetrics(reportDate);
await archiveMetrics(metrics);
const report = await renderExecutiveReport(metrics);
```

Сохраните файлы. Скрипт `start.watch` перезапустит Worker, и у нового процесса не будет кэшированной копии выполнения. Теперь одобрите отчёт:

```sh
temporal workflow signal \
  --workflow-id executive-report-patching-demo \
  --name approveReport \
  --input '{"approvedBy": "Maya"}'
```

Signal порождает новую Workflow Task. Чтобы её выполнить, перезапущенный Worker проигрывает историю. После `fetchMetrics` новый код просит запланировать `archiveMetrics`, тогда как по истории следующая Command запланировала `renderExecutiveReport`. Worker замечает расхождение и пишет в журнал ошибку недетерминизма.

Откройте выполнение в [Temporal Web UI](http://localhost:8233). Его статус по-прежнему Running, но Workflow Task раз за разом завершается с ошибкой. Ошибка недетерминизма не роняет само Workflow Execution: Temporal считает её сбоем Workflow Task и повторяет задачу через всё более длинные промежутки, вплоть до 10 минут. Отчёт застрял, но ничего не потеряно: он продолжится, как только какой-нибудь Worker сможет корректно его проиграть.

## Оберните изменение в patched

`patched(patchId)` позволяет одному Workflow Definition обслуживать и старые, и новые выполнения. Что он вернёт, зависит от истории:

- Когда Workflow не проигрывается, `patched` возвращает `true` и добавляет в Event History `marker` с идентификатором патча. В истории маркер виден как событие `MarkerRecorded`.
- Во время replay `patched` возвращает `true`, только если в истории есть этот маркер. В истории, записанной старым кодом, маркера нет, поэтому вызов возвращает `false`.

Добавьте `patched` в импорт из `@temporalio/workflow`:

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

И оберните новый вызов:

```ts
const metrics = await fetchMetrics(reportDate);

if (patched('archive-metrics')) {
  await archiveMetrics(metrics);
}

const report = await renderExecutiveReport(metrics);
```

`Patch ID` обозначает одно изменение. Делайте его коротким и понятным. Для каждого изменения заводите новый идентификатор и никогда не используйте старый для другого кода.

Сохраните файл и дайте Worker перезапуститься. При следующей повторной попытке Workflow Task `patched` вернёт `false`, replay пойдёт по старому пути и совпадёт с историей. Дальше выполнение продолжится с одобрением, которое Signal уже успел записать. Отчёт будет доставлен без архивирования, и это правильно: его метрики были получены ещё до того, как архив появился. Промежутки между повторами растут, поэтому восстановление может занять несколько минут. Следите за журналом Worker или за Web UI, пока выполнение не завершится.

Теперь запустите и одобрите новый отчёт:

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

Одобрение приходит рано, но обработчик сохраняет его, пока Workflow не дойдёт до ожидания. На этот раз в журнале Worker появится `Archiving metrics`. В Web UI история этого выполнения содержит событие `MarkerRecorded`, а за ним — Activity `archiveMetrics`. Оба выполнения работали на одном и том же коде, а путь для каждого выбрала его история.

## Поймайте проблему replay-тестом

Неудачное развёртывание обнаружилось только тогда, когда добралось до идущего выполнения. `Replay-тест` находит такую проблему раньше: он проигрывает сохранённую историю через текущий код Workflow, обходясь без Temporal Service.

Сохраните историю демонстрационного выполнения как фикстуру для теста. Она записана ещё до того, как появился шаг архивирования:

```sh
mkdir -p histories
temporal workflow show \
  --workflow-id executive-report-patching-demo \
  --output json > histories/before-archive.json
```

Создайте `src/mocha/replay.test.ts`:

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

`Worker.runReplayHistory` собирает бандл кода Workflow и проигрывает историю в памяти. Если код и история расходятся, он завершается отказом с `DeterminismViolationError`.

Тесты Workflow из урока о тестировании строят подставные Activity по `typeof activities`, так что теперь TypeScript требует подставную реализацию и для `archiveMetrics`. В `src/mocha/workflows.test.ts` добавьте её в `fakeActivities`:

```ts
async archiveMetrics() {
  // The test does not need a real archive.
},
```

Запустите набор тестов:

```sh
npm test
```

Все тесты проходят. Чтобы увидеть, от чего защищает replay-тест, временно уберите обёртку `if (patched('archive-metrics'))`, оставив голый вызов `await archiveMetrics(metrics);`, и снова запустите `npm test`. Теперь replay-тест падает с ошибкой недетерминизма. Прежде чем двигаться дальше, верните патч на место.

Храните фикстуры в системе контроля версий и запускайте replay-тесты перед каждым развёртыванием Worker. Сохраняйте историю для каждого важного пути через Workflow. Чтобы проверить сразу много выполнений, используйте `Worker.runReplayHistories`: он проигрывает пачку историй — например, недавних выполнений, полученных через Client.

## Уберите патч

Патч — временная мера. Старая ветка должна оставаться, пока Temporal может проиграть выполнение, запущенное без маркера. Закрытые выполнения тоже в счёт, пока их не удалит срок хранения (retention) Namespace: Query или reset способны проиграть и закрытое выполнение. Убирайте патч за два развёртывания.

Сначала, когда выполнений без маркера не осталось, замените ветку на `deprecatePatch`. Импортируйте его из `@temporalio/workflow` вместо `patched`:

```ts
const metrics = await fetchMetrics(reportDate);

deprecatePatch('archive-metrics');
await archiveMetrics(metrics);

const report = await renderExecutiveReport(metrics);
```

`deprecatePatch` всегда выполняет новый код. В новых выполнениях он по-прежнему пишет маркер, но помечает его как устаревший, чтобы более поздний код мог его не учитывать. Во время выкатки Worker с версией на `patched` и Worker с этой версией могут работать бок о бок. Фикстура `before-archive.json` на этом шаге уже не проигрывается, поэтому замените её историей, записанной кодом с патчем.

Затем, когда не осталось выполнений, запущенных версией с `patched`, удалите вызов `deprecatePatch`. Код снова становится простым:

```ts
const metrics = await fetchMetrics(reportDate);
await archiveMetrics(metrics);
const report = await renderExecutiveReport(metrics);
```

## Знайте об альтернативах

Патчи — не единственный способ менять код Workflow. Два других подхода подходят для иных ситуаций:

- `Worker Versioning` закрепляет каждое выполнение за версией развёртывания Worker (Worker Deployment Version), которая его запустила. Старые Worker продолжают обслуживать старые выполнения, а новые выполнения уходят к новым Worker, так что многим изменениям патч не нужен. Цена — несколько версий Worker, которые приходится одновременно запускать и сопровождать.
- Новый Workflow Type, например `executiveReportWorkflowV2`, — это копия кода под новым именем. Открытые выполнения остаются на старом типе, поэтому Worker должны регистрировать оба типа, пока эти выполнения не закроются. Кроме того, каждый Client и каждый Schedule придётся перевести на новое имя.

Патч уместен для небольшого изменения в Workflow, который обслуживает один набор Worker. Ему не нужна инфраструктура развёртывания, но каждый патч добавляет ветку, которую потом придётся убрать.

## Подведите итог: контракт изменений

- Replay сравнивает Command текущего кода с Event History. Если для открытого выполнения их последовательность изменилась, возникает ошибка недетерминизма.
- Ошибка недетерминизма роняет Workflow Task, а не само выполнение. Temporal повторяет задачу, пока совместимый Worker не сможет её проиграть.
- В новых выполнениях `patched` возвращает `true` и записывает маркер. При replay истории без этого маркера он возвращает `false`.
- Replay-тесты прогоняют сохранённые истории через новый код ещё до развёртывания.
- Сначала замените патч на `deprecatePatch`, а затем удалите его, когда не останется выполнений, которым при replay нужна старая ветка.

## Официальные ресурсы

- [Версионирование в TypeScript SDK](https://docs.temporal.io/develop/typescript/versioning)
- [Replay-тесты в TypeScript SDK](https://docs.temporal.io/develop/typescript/best-practices/testing-suite#replay)
- [API `patched` для TypeScript](https://typescript.temporal.io/api/namespaces/workflow#patched)
- [Официальный пример патчинга на TypeScript](https://github.com/temporalio/samples-typescript/tree/main/patching-api)
- [Worker Versioning](https://docs.temporal.io/production-deployment/worker-deployments/worker-versioning)
