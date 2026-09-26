---
slug: grpc/making-unary-rpc-calls
title: Унарные RPC-вызовы
description: Создайте клиент gRPC на Go, отправьте один запрос GetItem и прочитайте ответ.
---

`Унарный RPC` отправляет один запрос и получает один ответ. В описанном ранее контракте склада метод `InventoryService.GetItem` принимает `GetItemRequest` с SKU и возвращает `Item`. Сгенерированный клиент на Go превращает этот контракт в метод, который можно просто вызвать.

## Вызов GetItem

Предположим, вы сгенерировали пакет Go, объявленный в `inventory/v1/inventory.proto`, а локальный сервер реализует этот сервис на порту 50051. Тогда следующая программа запрашивает один товар:

```go
package main

import (
    "context"
    "fmt"
    "log"

    inventoryv1 "example.com/inventory/gen/inventory/v1"
    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials/insecure"
)

func main() {
    conn, err := grpc.NewClient(
        "localhost:50051",
        grpc.WithTransportCredentials(insecure.NewCredentials()),
    )
    if err != nil {
        log.Fatal(err)
    }
    defer conn.Close()

    client := inventoryv1.NewInventoryServiceClient(conn)
    item, err := client.GetItem(
        context.Background(),
        &inventoryv1.GetItemRequest{Sku: "A-100"},
    )
    if err != nil {
        log.Fatalf("GetItem failed: %v", err)
    }

    fmt.Printf("%s: %s (%d in stock)\n", item.GetSku(), item.GetName(), item.GetQuantity())
}
```

`grpc.NewClient` создаёт объект клиентского соединения, который можно использовать повторно; к серверу он пока не обращается. `NewInventoryServiceClient` оборачивает это соединение методами, сгенерированными из `InventoryService`. Вызов `GetItem` отправляет запрос и ждёт либо `Item`, либо ошибку. Его первый аргумент — `context.Context` из Go, через который вызывающая сторона управляет временем жизни вызова. В этом первом примере используется `context.Background()`, чтобы сам вызов оставался на виду; deadline и отмену добавит один из следующих уроков.

Прежде чем читать `item`, проверьте `err`. Если RPC завершился неудачей, успешного ответа, которым можно было бы воспользоваться, просто нет. Какой именно статус gRPC несёт ошибка, разбирается в уроке о кодах статуса. Выведенные значения зависят от данных на сервере: `A-100` и порт 50051 — лишь примеры входных данных, а не гарантированный результат и не сервер, который предоставляет этот курс.

## Выбор transport credentials

`insecure.NewCredentials()` отключает защиту транспорта. Используйте его только для обращения к локальному серверу разработки, который явно настроен на gRPC без шифрования. Для удалённого сервера с TLS-сертификатом, которому доверяет система macOS, используйте вместо этого TLS transport credentials:

```go
conn, err := grpc.NewClient(
    "inventory.example.com:443",
    grpc.WithTransportCredentials(credentials.NewClientTLSFromCert(nil, "")),
)
```

В этом варианте импортируйте `google.golang.org/grpc/credentials` вместо `google.golang.org/grpc/credentials/insecure`. Замените адрес из примера настоящими хостом и портом сервера. TLS сверяет сертификат сервера с именем хоста; сервису с собственным центром сертификации (private CA) или с взаимной аутентификацией (mutual TLS) нужны credentials, настроенные под этот контракт.

Чтобы проверить себя, поменяйте SKU в запросе и найдите строку, которая сообщит о неудачном RPC. Обратите внимание: изменение запроса не требует менять сгенерированный метод клиента или самому собирать HTTP-запрос.

## Официальные ресурсы

- [Основы gRPC для Go: создание клиента и вызов методов](https://grpc.io/docs/languages/go/basics/#creating-the-client)
- [Методы сгенерированного клиента gRPC для Go](https://grpc.io/docs/languages/go/generated-code/#methods-on-generated-client-interfaces)
- [API `NewClient` в grpc-go](https://pkg.go.dev/google.golang.org/grpc#NewClient)
- [Transport credentials в grpc-go](https://pkg.go.dev/google.golang.org/grpc/credentials#NewClientTLSFromCert)
