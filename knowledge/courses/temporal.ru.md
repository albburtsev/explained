---
slug: temporal
title: Temporal
description: Научитесь строить надёжные долгоживущие приложения на TypeScript с помощью Temporal — Workflow, Activity, Worker, сообщений, тестов и расписаний.
---

`Temporal` — платформа durable execution (долговечного выполнения) для прикладной логики, которая должна пережить падение процесса, сбои сети и долгие ожидания. Вместо того чтобы раскладывать повторные попытки, сохранение прогресса и код восстановления по разным сервисам, вы описываете бизнес-процесс как Workflow, а сохранение его состояния берёт на себя Temporal.

На протяжении курса мы строим одно приложение на TypeScript, которое готовит и доставляет BI-отчёт для руководства. Сначала вы запустите весь конвейер локально, а затем шаг за шагом сделаете его долговечным, наблюдаемым, интерактивным, тестируемым и запускаемым по расписанию.

## Установка Temporal на macOS

Необходимая зависимость: `Node.js v20+`.

Установите Temporal CLI через Homebrew и убедитесь, что установка прошла успешно:

```sh
brew install temporal
temporal --version
```

Запустите локальный сервис для разработки в отдельном терминале и не останавливайте его, пока проходите курс:

```sh
temporal server start-dev
```

Сервис слушает `localhost:7233`, а его Web UI открывается по адресу [http://localhost:8233](http://localhost:8233).

В другом терминале создайте проект на TypeScript, с которым вы будете работать во всех уроках:

```sh
npx @temporalio/create@latest temporal-bi-report --sample hello-world
cd temporal-bi-report
```

В сгенерированный проект уже входят Temporal TypeScript SDK и небольшое работающее приложение, которое вы постепенно превратите в конвейер отчётов для руководства.

## Официальные ресурсы

- [Документация Temporal](https://docs.temporal.io/)
- [Temporal TypeScript SDK](https://github.com/temporalio/sdk-typescript)
- [Справочник API TypeScript SDK](https://typescript.temporal.io/)
- [Примеры на TypeScript](https://github.com/temporalio/samples-typescript)

## Чему вы научитесь

- Понимать, когда durable execution подходит лучше, чем cron-задача, очередь задач, оркестратор данных или управляемый конечный автомат.
- Видеть, как взаимодействуют Workflow, Activity, Worker, Task Queue, Client и Temporal Service.
- Понимать, как Event History и детерминированный replay сохраняют состояние Workflow.
- Делать внешнюю работу надёжной с помощью повторных попыток, таймаутов, heartbeat и идемпотентности.
- Наблюдать за выполняющимся Workflow и изменять его с помощью Query, Signal и Update.
- Тестировать поведение, зависящее от времени, и запускать Workflow с отчётами по расписанию.
