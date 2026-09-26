---
slug: grpc/handling-grpc-status-codes
title: Обработка кодов статуса gRPC
description: Научитесь читать коды ошибок gRPC в клиенте на Go и решать, как поступить, если товар не найден, запрос некорректен или сервис временно недоступен.
---

Каждый вызов gRPC завершается со `статусом` (status): это код и, если что-то пошло не так, описание. Успешный унарный вызов возвращает ответ и ошибку Go, равную nil. Неудачный вызов возвращает ошибку, `код статуса` которой сообщает клиенту, какого рода сбой произошёл. Этот код не имеет отношения к коду HTTP-ответа нижележащего транспорта: корректный ответ gRPC может прийти с HTTP 200 и всё равно сообщать о статусе gRPC, отличном от OK.

Вернёмся к примеру с `InventoryService.GetItem` и представим, что контракт API сервиса обещает `NotFound` для несуществующего SKU. Сам файл `.proto` такого поведения **не** задаёт. Но если контракт это гарантирует, клиент может считать `NotFound` отсутствием товара и при этом не терять остальные ошибки:

```go
import (
    "context"
    "fmt"

    inventoryv1 "example.com/inventory/gen/inventory/v1"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"
)

func findItem(ctx context.Context, client inventoryv1.InventoryServiceClient, sku string) (*inventoryv1.Item, bool, error) {
    item, err := client.GetItem(ctx, &inventoryv1.GetItemRequest{Sku: sku})
    if err == nil {
        return item, true, nil
    }

    switch status.Code(err) {
    case codes.NotFound:
        return nil, false, nil // The service contract defines this as an absent item.
    case codes.InvalidArgument:
        return nil, false, fmt.Errorf("invalid SKU %q: %w", sku, err)
    case codes.Unavailable:
        return nil, false, fmt.Errorf("inventory service unavailable: %w", err)
    case codes.DeadlineExceeded:
        return nil, false, fmt.Errorf("item lookup did not finish in time: %w", err)
    default:
        return nil, false, fmt.Errorf("GetItem failed: %w", err)
    }
}
```

`status.Code(err)` извлекает из ошибки код gRPC, в том числе когда ошибка со статусом обёрнута в другую. Для ошибки, не связанной с gRPC, он возвращает `Unknown`, поэтому ветка по умолчанию по-прежнему нужна. Возвращая ошибку, сохраняйте исходную через `%w`: тогда вызывающий код тоже сможет проверить её статус. Если вам нужны описание от сервера или структурированные подробности, воспользуйтесь `status.FromError(err)` и, прежде чем читать возвращённый статус, проверьте результат `ok`.

## Что делать дальше

| Код | Значение | Обычная реакция клиента |
| --- | --- | --- |
| `NotFound` | Запрошенная сущность не найдена. | Считайте это отсутствием, только если такой смысл задан контрактом сервиса. |
| `InvalidArgument` | В запросе некорректный аргумент. | Исправьте входные данные; повтор того же запроса не поможет. |
| `Unavailable` | Сервис временно недоступен. | Если повторять вызов безопасно, подумайте об ограниченном числе повторов с нарастающей паузой (backoff). |
| `DeadlineExceeded` | Вызов не завершился до своего deadline. | Сообщите о тайм-ауте или решите, безопасен ли новый вызов. Сервер при этом мог успеть выполнить операцию. |

Эти коды описывают исход вызова, а не универсальную политику повторов. В этом примере `GetItem` только читает данные, но при вызове, который их меняет, ошибка может прийти уже после того, как сервер выполнил действие. Прежде чем повторять вызов, проверьте, идемпотентен ли метод и что рекомендует сервис насчёт повторов. Не повторяйте `InvalidArgument` с теми же входными данными и не превращайте любую ошибку в `NotFound`.

Для быстрой проверки представьте, что `GetItem` возвращает `Unavailable` для какого-то SKU. Сообщит ли `findItem`, что товара нет? Нет: функция вернёт ошибку, и вызывающий код сможет отличить временный сбой сервиса от отсутствующего товара.

## Официальные ресурсы

- [Коды статуса gRPC](https://grpc.io/docs/guides/status-codes/)
- [Пакет `status` в grpc-go](https://pkg.go.dev/google.golang.org/grpc/status)
- [Руководство по повторам в gRPC](https://grpc.io/docs/guides/retry/)
- [Протокол gRPC поверх HTTP/2](https://grpc.github.io/grpc/cpp/md_doc__p_r_o_t_o_c_o_l-_h_t_t_p2.html)
