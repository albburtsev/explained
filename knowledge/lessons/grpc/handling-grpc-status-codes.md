---
slug: grpc/handling-grpc-status-codes
title: Handling gRPC Status Codes
description: Read gRPC error codes in a Go client and choose a response for missing, invalid, or temporarily unavailable requests.
tags:
  - grpc
  - go
  - error-handling
---

Every gRPC call ends with a `status`: a code and, when something fails, a description. A successful unary call returns a response and a nil Go error. A failed call returns an error whose `status code` tells the client what kind of failure occurred. This is separate from the HTTP response code used by the underlying transport: a valid gRPC response can carry HTTP 200 and still report a non-OK gRPC status.

For the earlier `InventoryService.GetItem` example, imagine the service's API contract says a missing SKU produces `NotFound`. The `.proto` file alone does **not** specify that behavior. Given that contract, a client can treat `NotFound` as an absent item while preserving other failures:

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

`status.Code(err)` extracts a gRPC code from the error, including a wrapped status error. A non-gRPC error yields `Unknown`, so the default branch still matters. Keep the original error with `%w` when returning it; callers can inspect its status too. If you need the server's description or structured details, use `status.FromError(err)` and check its `ok` result before reading the returned status.

## Decide what to do next

| Code | Meaning | Typical client response |
| --- | --- | --- |
| `NotFound` | The requested entity was not found. | Treat it as absence only if the service contract defines that meaning. |
| `InvalidArgument` | The request has an invalid argument. | Correct the input; repeating the same request will not help. |
| `Unavailable` | The service is temporarily unavailable. | Consider a bounded retry with backoff if repeating the call is safe. |
| `DeadlineExceeded` | The call did not finish before its deadline. | Report the timeout or decide whether a new call is safe. The server may still have completed the operation. |

These codes describe the outcome, not a universal retry policy. `GetItem` is a read in this example, but for a call that changes data, an error may arrive after the server has acted. Check the method's idempotency and the service's retry guidance before retrying. Do not retry `InvalidArgument` with unchanged input, or turn every failure into `NotFound`.

As a quick check, suppose `GetItem` returns `Unavailable` for an SKU. Does `findItem` report the item as absent? No: it returns an error, so its caller can distinguish a temporary service failure from a missing item.

## Official resources

- [gRPC status codes](https://grpc.io/docs/guides/status-codes/)
- [grpc-go `status` package](https://pkg.go.dev/google.golang.org/grpc/status)
- [gRPC retry guide](https://grpc.io/docs/guides/retry/)
- [gRPC over HTTP/2 protocol](https://grpc.github.io/grpc/cpp/md_doc__p_r_o_t_o_c_o_l-_h_t_t_p2.html)
