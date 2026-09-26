---
slug: grpc/deadlines-cancellation-and-metadata
title: Deadline, отмена и metadata
description: Ограничьте время gRPC-вызова на Go, отмените ставшую ненужной работу и добавьте к вызову исходящие metadata.
---

Каждый сгенерированный метод клиента на Go принимает `context.Context`. Через него можно управлять временем жизни отдельного вызова и прикреплять сведения, которые передаются вместе с запросом. В прежнем примере с `GetItem` сразу передавался `context.Background()`; в этой версии у вызова появляются ограничение по времени и идентификатор запроса.

## Ограничиваем вызов и добавляем metadata

```go
import (
    "context"
    "fmt"
    "time"

    inventoryv1 "example.com/inventory/gen/inventory/v1"
    "google.golang.org/grpc/metadata"
)

func getItem(parent context.Context, client inventoryv1.InventoryServiceClient, sku, requestID string) (*inventoryv1.Item, error) {
    ctx, cancel := context.WithTimeout(parent, 2*time.Second)
    defer cancel()

    ctx = metadata.AppendToOutgoingContext(ctx, "x-request-id", requestID)
    item, err := client.GetItem(ctx, &inventoryv1.GetItemRequest{Sku: sku})
    if err != nil {
        return nil, fmt.Errorf("GetItem: %w", err)
    }
    return item, nil
}
```

`deadline` — это момент времени, после которого клиент перестаёт ждать. `context.WithTimeout` задаёт его относительно момента создания контекста. Две секунды здесь взяты для примера; выбирайте предел, соответствующий ожидаемой задержке сервиса. Если у родительского контекста deadline наступает раньше или его отменили, вызов прекратится раньше. Всегда вызывайте возвращённую функцию `cancel`, даже после успешного вызова, чтобы освободить ресурсы, связанные с таймером.

`Отмена` (cancellation) означает, что вызывающей стороне вызов больше не нужен. Если она отказывается от запроса, то может отменить родительский контекст; тогда производный контекст отменит и RPC. Для долгоживущего потока `WatchItems` отменяйте его контекст, когда перестаёте читать раньше времени. Отмена даёт серверу сигнал прекратить работу, но не гарантирует, что сервер ещё ничего не успел сделать.

`Metadata` — это сведения о вызове в виде пар ключ–значение, которые передаются в заголовках или трейлерах HTTP/2 отдельно от сообщений запроса и ответа protobuf. `AppendToOutgoingContext` добавляет исходящие metadata, не заменяя те, что уже есть в контексте. Здесь `x-request-id` помогает сопоставить этот вызов с записями в логах сервера, если сервис знает такой ключ. Не рассчитывайте, что сервер понимает произвольные ключи metadata; следуйте его контракту API.

Если в metadata передаются учётные данные, используйте для соединения TLS transport credentials и никогда не записывайте секретные значения в логи. Как настроить TLS-соединение, показано в уроке об унарных вызовах. Идентификатор запроса сам по себе учётными данными не является.

Для практики представьте, что `GetItem` обычно выполняется за 100 мс, но на этот раз зависает на пять секунд. С тайм-аутом в две секунды из примера клиент перестанет ждать примерно в момент deadline. Теперь представьте, что вызывающая сторона отменяет `parent` через 50 мс: эта более ранняя отмена сработает первой. Ни в одном из случаев сообщение `GetItemRequest` не меняется.

## Официальные ресурсы

- [Deadline в gRPC](https://grpc.io/docs/guides/deadlines/)
- [Отмена в gRPC](https://grpc.io/docs/guides/cancellation/)
- [Metadata в gRPC](https://grpc.io/docs/guides/metadata/)
- [Пакет context в Go](https://pkg.go.dev/context)
- [Пакет metadata в grpc-go](https://pkg.go.dev/google.golang.org/grpc/metadata#AppendToOutgoingContext)
