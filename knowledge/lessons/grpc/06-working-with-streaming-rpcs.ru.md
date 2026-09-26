---
slug: grpc/working-with-streaming-rpcs
title: Работа со streaming RPC
description: Разберите вызов gRPC с server streaming на Go — и успешное завершение, и ошибки при получении сообщений.
---

`Streaming RPC` позволяет обмениваться последовательностью сообщений в рамках одного вызова. В контракте склада из предыдущих уроков `WatchItems` — метод с **server streaming**: клиент отправляет одну категорию, а сервер может прислать в ответ несколько сообщений `Item`.

```proto
rpc WatchItems(WatchItemsRequest) returns (stream Item);
```

Ключевое слово `stream` перед `Item` говорит о том, что ответ — это последовательность, а не одиночный `Item`. Из файла `.proto` не видно, пришлёт ли сервер конечный снимок данных или будет присылать обновления без конца. Прежде чем решать, как долго клиент должен держать вызов открытым, выясните, как ведёт себя сервис.

## Получение товаров на Go

Имея сгенерированный `InventoryServiceClient`, вызовите `WatchItems` один раз, а затем раз за разом вызывайте `Recv` у возвращённого потока:

```go
import (
    "context"
    "errors"
    "fmt"
    "io"

    inventoryv1 "example.com/inventory/gen/inventory/v1"
)

func watchItems(ctx context.Context, client inventoryv1.InventoryServiceClient, category string) error {
    stream, err := client.WatchItems(ctx, &inventoryv1.WatchItemsRequest{
        Category: category,
    })
    if err != nil {
        return fmt.Errorf("start WatchItems: %w", err)
    }

    for {
        item, err := stream.Recv()
        if errors.Is(err, io.EOF) {
            return nil // The server finished successfully.
        }
        if err != nil {
            return fmt.Errorf("receive WatchItems item: %w", err)
        }
        fmt.Printf("%s: %s (%d)\n", item.GetSku(), item.GetName(), item.GetQuantity())
    }
}
```

Каждый успешный `Recv` возвращает один `Item`. Пока сервер готовит следующее сообщение, `Recv` может ждать. `io.EOF` означает, что сервер завершил поток со статусом gRPC OK, в том числе если он не прислал ни одного товара. Любая другая ошибка означает, что вызов не завершился успешно; верните её или обработайте, но не считайте уже полученные сообщения полным результатом. Как истолковывать коды статуса gRPC, показано в следующем уроке.

У потока с обновлениями в реальном времени может вовсе не быть естественного конца. Как долго он остаётся открытым, вызывающая сторона должна определять через контекст вызова; deadline и отмена разобраны в последнем уроке. Если вы перестаёте читать раньше времени, отмените этот контекст, чтобы вызов освободил свои ресурсы.

## Другие схемы вызова

По тому, где в сигнатуре метода стоит `stream`, видно, какая сторона отправляет последовательность:

| Схема | Со стороны запроса | Со стороны ответа |
| --- | --- | --- |
| Унарный вызов | Одно сообщение | Одно сообщение |
| Server streaming | Одно сообщение | Поток сообщений |
| Client streaming | Поток сообщений | Одно сообщение |
| Bidirectional streaming | Поток сообщений | Поток сообщений |

`WatchItems` использует вторую схему. Для остальных схем клиенту нужны другие циклы, но первый шаг всегда один и тот же: прочитать сигнатуру метода в контракте `.proto`.

Для практики представьте вызов `WatchItems`, который возвращает два товара, а затем ошибку, отличную от EOF. По какой ветке пойдёт функция и может ли вызывающая сторона утверждать, что получила весь набор? Функция вернёт ошибку, поэтому два товара — лишь частичный результат.

## Официальные ресурсы

- [Основы gRPC для Go: RPC с server streaming](https://grpc.io/docs/languages/go/basics/#server-side-streaming-rpc)
- [API `ServerStreamingClient` в gRPC для Go](https://pkg.go.dev/google.golang.org/grpc#ServerStreamingClient)
