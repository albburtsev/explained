---
slug: grpc/generating-a-grpc-client
title: Генерация клиента gRPC
description: Сгенерируйте из контракта сервиса код сообщений и клиента на Go и найдите API, с которым будет работать ваше приложение.
---

Контракт `.proto` описывает сервис, но напрямую вызвать его из Go нельзя. `Сгенерированный клиент` (generated client) превращает методы и сообщения контракта в типы Go. Берите контракт, который опубликовал владелец сервиса, вместе со всеми файлами, которые он импортирует; реализация сервера вам не нужна.

## Генерация по контракту

Для этого примера на macOS нужны Go v1.25+, `protoc` v3+ и плагины `protoc-gen-go` и `protoc-gen-go-grpc`, доступные для `protoc`. Возьмите `inventory/v1/inventory.proto` из предыдущего урока и положите его в модуль Go с именем `example.com/inventory`. В корне этого модуля выполните:

```sh
protoc --go_out=. --go_opt=module=example.com/inventory \
  --go-grpc_out=. --go-grpc_opt=module=example.com/inventory \
  inventory/v1/inventory.proto
```

Команда создаёт в `gen/inventory/v1/` два файла — в соответствии с путём импорта из `go_package` в контракте:

| Файл | Что в нём |
| --- | --- |
| `inventory.pb.go` | Типы Go для `GetItemRequest`, `WatchItemsRequest` и `Item`, а также поддержка кодирования сообщений. |
| `inventory_grpc.pb.go` | Интерфейс `InventoryServiceClient`, конструктор `NewInventoryServiceClient` и реализации методов, которые работают через gRPC. |

`protoc` читает контракт. Флаг `--go_out` вызывает `protoc-gen-go` для сообщений, а `--go-grpc_out` — `protoc-gen-go-grpc` для кода сервиса. Опции `module=` отбрасывают префикс модуля от пути из `go_package`, когда выбираются каталоги для результата. Без них раскладка по умолчанию, повторяющая путь импорта, поместила бы файлы внутрь лишнего каталога `example.com/inventory/`. Когда контракт сервиса меняется, генерируйте оба файла заново; сгенерированный код вручную не правят.

## Находим API клиента

Сгенерированный пакет называется `inventoryv1` и импортируется из `example.com/inventory/gen/inventory/v1`. В нём `NewInventoryServiceClient` принимает соединение gRPC и возвращает `InventoryServiceClient`. Методы этого клиента соответствуют двум RPC из контракта:

```go
GetItem(ctx context.Context, in *GetItemRequest, opts ...grpc.CallOption) (*Item, error)
WatchItems(ctx context.Context, in *WatchItemsRequest, opts ...grpc.CallOption) (grpc.ServerStreamingClient[Item], error)
```

`GetItem` возвращает один товар или ошибку. `WatchItems` возвращает объект, из которого вызывающая сторона получает последовательность товаров. По этим сигнатурам видно, какой запрос нужно собрать и какой результат обработать; как подключиться и вызвать эти методы, покажут следующие уроки.

Если владелец сервиса уже публикует сгенерированный пакет Go для этого контракта, подключите его как зависимость, а не генерируйте вторую копию. Прежде чем писать клиент, сверьте версию контракта и путь импорта.

Для практики найдите `GetItemRequest` в `inventory.pb.go` и `InventoryServiceClient` в `inventory_grpc.pb.go`. В каком файле нужно искать тип Go для `Item.quantity`? В `inventory.pb.go`.

## Официальные ресурсы

- [Быстрый старт gRPC для Go: повторная генерация кода gRPC](https://grpc.io/docs/languages/go/quickstart/#regenerate-grpc-code)
- [Требования модуля gRPC-Go v1.84.0](https://github.com/grpc/grpc-go/blob/v1.84.0/go.mod)
- [Руководство по коду Protocol Buffers, сгенерированному для Go](https://protobuf.dev/reference/go/go-generated/)
- [API потоков в gRPC-Go](https://pkg.go.dev/google.golang.org/grpc#ServerStreamingClient)
- [Генератор клиентского кода gRPC-Go](https://github.com/grpc/grpc-go/blob/master/cmd/protoc-gen-go-grpc/grpc.go)
