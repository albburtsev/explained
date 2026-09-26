---
slug: temporal/reliable-activities
title: Надёжные Activity
description: Проектируйте Activity в Temporal так, чтобы их можно было безопасно повторять, — с ограниченными таймаутами, heartbeat для отслеживания прогресса и идемпотентными внешними побочными эффектами.
---

В предыдущем уроке внешняя работа была спрятана за одной Activity, чтобы replay Workflow не выполнял её напрямую. Но у настоящего конвейера отчётов несколько независимых границ отказа: BI-сервис может быть недоступен, формирование отчёта может затянуться, а доставка — пройти успешно, даже если ответ о ней потерялся.

В этом уроке мы разделим эту работу на три Activity и зададим для каждого выполнения контракт повторных попыток и таймаутов.

## Проводите границу Activity вокруг одной операции

`Activity` — это обычная функция на TypeScript, которая выполняет одно чётко определённое действие за пределами детерминированного кода Workflow. Она работает в стандартном окружении Node.js, поэтому может вызывать API, выполнять запросы к базе данных, читать файлы или пользоваться обычными библиотеками.

Конвейеру отчётов нужны три границы:

```text
Workflow
   │
   ├── fetchMetrics ─────────────▶ BI service
   ├── renderExecutiveReport ────▶ report renderer
   └── deliverReport ────────────▶ delivery provider
```

Раздельные операции позволяют Temporal повторить неудачный запрос к BI-сервису, не повторяя успешное формирование отчёта или доставку. Кроме того, каждая Activity может получить таймауты, соответствующие её работе. Не дробите Activity так мелко, чтобы каждое локальное вычисление становилось долговечным вызовом, но и не делайте их настолько широкими, чтобы несвязанные побочные эффекты приходилось повторять вместе.

Аргументы и результаты Activity записываются в Event History. Они должны сериализоваться и оставаться достаточно компактными. В этом примере значения метрик и текст отчёта передаются напрямую; большой отчёт в продакшене обычно передают ссылкой на объект в долговечном объектном хранилище.

## Реализуйте три Activity

Замените содержимое `src/activities.ts` этой накопительной версией:

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

`fetchMetrics` завершается сбоем только на первой попытке Activity. Контекст Activity в TypeScript сообщает номер попытки, назначенный сервером, поэтому следующая попытка проходит успешно без глобальных счётчиков процесса.

`renderExecutiveReport` показывает долгую операцию в рамках короткого упражнения. Heartbeat сообщает Temporal Service, что Activity жива, и может нести с собой данные контрольной точки. Если попытка превышает таймаут и Temporal её повторяет, `heartbeatDetails` содержит последние данные, принятые Service. Activity может продолжить с этого места, а не повторять всю уже сделанную работу. Используйте этот приём для действительно долгой или пошаговой работы; обычному быстрому запросу heartbeat не нужен.

Activity формирования отчёта собирает итоговый текст заново из входных данных, потому что данные heartbeat — это контрольная точка, а не итоговый результат Activity. Частота отправки heartbeat может ограничиваться, поэтому код должен спокойно переносить продолжение с более ранней контрольной точки.

## Задайте выполнениям явные пределы

Замените содержимое `src/workflows.ts` на:

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

Temporal требует задать хотя бы один из этих двух таймаутов Activity:

| Таймаут | Что он ограничивает | На какой вопрос отвечает |
| --- | --- | --- |
| `startToCloseTimeout` | Одну попытку — с момента, когда Worker её начал | Сколько может длиться один вызов? |
| `scheduleToCloseTimeout` | Всё выполнение Activity, включая ожидание в очереди и повторные попытки | Сколько Workflow готов ждать итогового успеха? |

Вместе они задают предел для каждой попытки и общий бюджет на повторы. Таймаут heartbeat устроен иначе: как только формирование отчёта началось, Temporal ждёт очередной heartbeat в течение пяти секунд. Пропущенный heartbeat приводит к таймауту этой попытки, и Retry Policy может запланировать следующую.

У Activity есть Retry Policy по умолчанию, даже если `retry` не указан: экспоненциальная задержка начинается с одной секунды, удваивается до максимального интервала в 100 секунд, а число попыток не ограничено, пока выполнение не закроет какой-нибудь другой лимит. Для многих временных сбоев это полезное поведение по умолчанию. В этом уроке заданы явные ограничения, чтобы сломанная зависимость проявилась за предсказуемое время учебного запуска.

Подбирайте политику для каждой операции исходя из её поведения, а не из одной общей константы. API с ограничением частоты запросов может потребовать более длинного интервала; некорректные входные данные обычно должны приводить к `ApplicationFailure`, не подлежащей повтору; бизнес-срок должен выражаться общим лимитом Schedule-To-Close. Не оборачивайте механизм повторов Temporal ещё одним циклом повторов внутри Activity, если только внутренние повторы не служат намеренно иной цели.

## Понаблюдайте за повторной попыткой

Не останавливайте локальный Temporal Service. Запустите или перезапустите Worker:

```sh
npm run start.watch
```

В другом терминале запустите Workflow:

```sh
npm run workflow
```

После долговечного 20-секундного ожидания в журнале Worker должны появиться две попытки получения метрик:

```text
Fetching metrics, attempt 1
Fetching metrics, attempt 2
```

Client всё так же получает один успешный результат Workflow. В Temporal Web UI откройте выполнение и найдите `fetchMetrics`. Первая попытка завершилась сбоем, Temporal выждал паузу согласно Retry Policy, и вторая попытка прошла успешно. Код Workflow всё это время оставался приостановленным на том же `await` и не запускал конвейер отчётов заново с самого начала.

Если все разрешённые попытки завершатся сбоем или истечёт срок Schedule-To-Close, прокси Activity в коде Workflow отклонит Promise с ошибкой Activity. Workflow может перехватить эту ошибку и выбрать другой долговечный путь. В этой версии она не обрабатывается, поэтому выполнение сообщает Client о сбое и не переходит ни к формированию отчёта, ни к доставке.

## Защитите побочные эффекты от повторных попыток

Temporal долговечно оркестрирует выполнение Activity, но не может сделать внешний побочный эффект однократным. Рассмотрим такую последовательность сбоев:

1. `deliverReport` просит провайдера отправить сообщение.
2. Провайдер его отправляет.
3. Процесс Activity падает раньше, чем Temporal записывает завершение.
4. Temporal повторяет Activity, потому что её исход неизвестен.

С точки зрения Temporal обе попытки корректны. Сделать повторный запрос безопасным должна внешняя система. Распространённые подходы:

- передавать стабильный ключ идемпотентности провайдеру, который его запоминает и отбрасывает дубликаты;
- вставлять уникальный ключ операции и запись в outbox в одной транзакции базы данных;
- выбирать изменения состояния, идемпотентные по своей природе, например присваивать значение, а не увеличивать его.

Workflow один раз вычисляет `executive-report:<reportDate>` и передаёт этот ключ в доставку. Локальная Activity лишь записывает ключ в журнал; `Set` в памяти был бы обманчивой заменой, потому что исчезает при том же падении процесса, которое и вызывает повтор. В продакшене уникальность должен атомарно обеспечивать провайдер доставки или долговечная база данных.

Повторы касаются и чтения, и других операций без видимых побочных эффектов. Таким вызовам тоже нужны таймауты и безопасность при повторе, но дороже всего путаница между долговечной оркестрацией и однократной доставкой обходится именно при доставке.

## Повторите контракт Activity

- Выносите внешние недетерминированные операции в Activity и следите, чтобы каждая граница была цельной.
- Рассчитывайте на то, что попытка Activity может выполниться больше одного раза.
- Ограничивайте одну попытку через Start-To-Close, а всё окно повторов — через Schedule-To-Close.
- Используйте heartbeat и данные контрольных точек только для долгой или пошаговой работы.
- Позволяйте сбоям, которые можно повторить, доходить до Temporal; постоянные сбои помечайте как не подлежащие повтору.
- Давайте побочным эффектам стабильный ключ идемпотентности, который соблюдает внешняя система или долговечное хранилище.

## Официальные ресурсы

- [Основы Activity в TypeScript SDK](https://docs.temporal.io/develop/typescript/activities/basics)
- [Выполнение Activity в TypeScript SDK](https://docs.temporal.io/develop/typescript/activities/execution)
- [Таймауты, повторы и heartbeat Activity](https://docs.temporal.io/develop/typescript/activities/timeouts)
- [Retry Policy: значения по умолчанию и параметры](https://docs.temporal.io/encyclopedia/retry-policies)
- [Справочник API Activity для TypeScript](https://typescript.temporal.io/api/namespaces/activity)
