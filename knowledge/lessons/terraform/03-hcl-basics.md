---
slug: terraform/hcl-basics
title: HCL Basics
description: Read and write HCL by comparing a Deployment with its YAML manifest, then add a Service that uses references, functions, fmt, and validate.
tags:
  - terraform
  - hcl
  - kubernetes
  - infrastructure-as-code
---

Terraform code is written in `HCL`, the HashiCorp Configuration Language. In Kubernetes, YAML holds your desired state. In Terraform, HCL plays that role. It looks different, but most of the ideas carry over. In this lesson, you learn to read the `main.tf` from the previous lesson line by line and then add a Service to it.

## Blocks and arguments

HCL has two main building pieces. A `block` is a container for settings. It has a type, zero or more `labels`, and a body in curly braces. An `argument` sets one value inside a body with `name = value`.

```hcl
resource "kubernetes_namespace_v1" "demo" {
  metadata {
    name = "demo"
  }
}
```

Here, `resource` is the block type. It takes two labels: the resource type `kubernetes_namespace_v1` and the local name `demo`. Together they form the resource's address, `kubernetes_namespace_v1.demo`. The local name exists only inside Terraform. The name of the object in the cluster comes from `metadata.name`. The two names often match, but they do not have to.

Other blocks take a different number of labels. The `terraform` block has none, and the `provider` block has one: the provider name.

Inside the body, `metadata { ... }` is a `nested block`, and `name = "demo"` is an argument. The difference matters when you read code. An argument always has `=`. A nested block never does. So `labels = { app = "web" }` is an argument whose value is a map, but `metadata { ... }` is a block. The provider's schema decides which form each setting uses, so check the resource page on the Terraform Registry when you are not sure.

## From YAML to HCL

Here is the Deployment from the previous lesson as a Kubernetes manifest:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: demo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
```

And here is the same Deployment in HCL:

```hcl
resource "kubernetes_deployment_v1" "web" {
  metadata {
    name      = "web"
    namespace = kubernetes_namespace_v1.demo.metadata[0].name
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        app = "web"
      }
    }

    template {
      metadata {
        labels = {
          app = "web"
        }
      }

      spec {
        container {
          name  = "nginx"
          image = "nginx:1.27"
        }
      }
    }
  }
}
```

The shape is almost the same. A few rules explain the differences:

- `apiVersion` and `kind` become the resource type, `kubernetes_deployment_v1`.
- Field names use snake_case instead of camelCase: `matchLabels` becomes `match_labels`.
- A YAML object with fixed fields, such as `metadata` or `spec`, becomes a nested block.
- A YAML object with free-form keys, such as `labels` or `matchLabels`, becomes a map argument.
- A YAML list of objects becomes a repeated block with a singular name. Each `container { ... }` block adds one item to `containers`.
- There is no `status`. The cluster manages it, not your configuration.

## Types

Every value in HCL has a type. You will meet these most often:

| Type | Example | Notes |
| --- | --- | --- |
| `string` | `image = "nginx:1.27"` | Text in double quotes. |
| `number` | `port = 80` | Whole or fractional numbers, without quotes. |
| `bool` | `wait_for_rollout = true` | `true` or `false`, without quotes. |
| `list` | `command = ["nginx", "-g", "daemon off;"]` | An ordered sequence in square brackets. |
| `map` | `labels = { app = "web" }` | Named keys with values of one type, in curly braces. |
| `object` | `kubernetes_namespace_v1.demo` | Named attributes, each with its own type. Each resource is an object. |

Terraform converts a value to the type that an argument expects when it can. For example, the Service port's `target_port` is a string in the provider schema, because Kubernetes also accepts a port name there. You can still write `target_port = 80`, and Terraform turns it into `"80"`.

## References and implicit dependencies

The Deployment above does not repeat the namespace name. It uses a `reference`:

```hcl
namespace = kubernetes_namespace_v1.demo.metadata[0].name
```

Read it from left to right: the resource type, the local name, and then a path to one attribute. Why `[0]`? The Kubernetes provider represents each nested block as a list of objects, even when only one block is allowed. So `metadata[0]` is the first and only `metadata` block, and `.name` is its `name` argument. If you forget the index, `terraform validate` tells you:

```text
╷
│ Error: Invalid operation
│
│   on main.tf line 14, in resource "kubernetes_deployment_v1" "web":
│   14:     namespace = kubernetes_namespace_v1.demo.metadata.name
│
│ Block type "metadata" is represented by a list of objects, so it must be
│ indexed using a numeric key, like .metadata[0].
╵
```

A reference does more than copy a value. It also creates an `implicit dependency`. Terraform builds a graph of resources from the references and creates them in order: first the namespace, then the Deployment that lives in it. When you destroy, it goes in reverse order. With `kubectl apply -f`, a manifest can fail because its namespace does not exist yet. Terraform avoids this, because the reference already tells it the order.

## Add a Service

Now put references to work. Add this block to the end of `main.tf` in your `terraform-course` project:

```hcl
# Exposes the web Deployment inside the cluster.
resource "kubernetes_service_v1" "web" {
  metadata {
    name      = "web"
    namespace = kubernetes_namespace_v1.demo.metadata[0].name
  }

  spec {
    selector = {
      app = "web"
    }

    port {
      port        = 80
      target_port = 80
    }
  }
}
```

The Service gets its namespace from the same reference as the Deployment, so it depends on the namespace too. The selector `app = "web"` matches the Pod labels in the Deployment template. The Service and the Deployment do not refer to each other, so Terraform can create them at the same time, after the namespace.

Format and check the code, then apply it:

```sh
terraform fmt
terraform validate
terraform plan
terraform apply
```

Review the plan before you type `yes`. You destroyed everything at the end of the previous lesson, so the plan creates all three objects:

```text
Plan: 3 to add, 0 to change, 0 to destroy.
```

Then check the result in the cluster:

```sh
kubectl get service web -n demo
```

## String interpolation and functions

To build a string from other values, use `string interpolation`: put an expression inside `${ ... }` in a quoted string. For example, this expression builds the cluster DNS name of the Service:

```hcl
"${kubernetes_service_v1.web.metadata[0].name}.${kubernetes_namespace_v1.demo.metadata[0].name}.svc.cluster.local"
```

When a value is just one reference, write it without quotes, as in `namespace = kubernetes_namespace_v1.demo.metadata[0].name`. Older code often wraps a single reference in `"${ ... }"`. That still works, and `terraform fmt` removes the extra wrapping.

Terraform also has many built-in functions. You call a function by name with arguments in parentheses. These are common in team code:

| Function | Example | Result |
| --- | --- | --- |
| `lower` | `lower("DEMO")` | `"demo"` |
| `upper` | `upper("web")` | `"WEB"` |
| `join` | `join(", ", ["a", "b", "c"])` | `"a, b, c"` |
| `length` | `length(["a", "b"])` | `2` |
| `format` | `format("%s:%s", "nginx", "1.27")` | `"nginx:1.27"` |
| `merge` | `merge({ app = "web" }, { tier = "frontend" })` | `{ app = "web", tier = "frontend" }` |

Try them in `terraform console`, an interactive shell for expressions. Run it in the project directory. It reads values of existing resources from the state, so after `apply` you can evaluate the DNS name expression above. It returns `"web.demo.svc.cluster.local"`. Type `exit` to leave the console.

## Comments

HCL has three comment styles:

```hcl
# A single-line comment. This is the default style.
// Also a single-line comment.
/* A comment that can
   span several lines. */
```

Use `#` in new code. Comments are a good place to explain why a setting exists, not what it does.

## fmt and validate

Two commands keep the code clean before review:

- `terraform fmt` rewrites `.tf` files in the current directory to the standard style. It aligns `=` signs, fixes indentation, and prints the names of the files it changed. Add `-recursive` to include subdirectories. In CI, `terraform fmt -check` changes nothing. It lists the files that need formatting and exits with a non-zero code.
- `terraform validate` checks syntax, argument names, value types, and references. It needs an initialized directory, but it does not contact the cluster. It catches typos before `plan` does.

Run both before every commit. In the next lesson, you replace hard-coded values such as `"web"` and `2` with variables.

## Sources

- [Terraform configuration syntax](https://developer.hashicorp.com/terraform/language/syntax/configuration)
- [Types and values](https://developer.hashicorp.com/terraform/language/expressions/types)
- [References to values](https://developer.hashicorp.com/terraform/language/expressions/references)
- [Strings and templates](https://developer.hashicorp.com/terraform/language/expressions/strings)
- [Built-in functions](https://developer.hashicorp.com/terraform/language/functions)
- [Resource graph](https://developer.hashicorp.com/terraform/internals/graph)
- [terraform fmt](https://developer.hashicorp.com/terraform/cli/commands/fmt)
- [terraform validate](https://developer.hashicorp.com/terraform/cli/commands/validate)
- [terraform console](https://developer.hashicorp.com/terraform/cli/commands/console)
- [kubernetes_deployment_v1](https://registry.terraform.io/providers/hashicorp/kubernetes/latest/docs/resources/deployment_v1)
- [kubernetes_service_v1](https://registry.terraform.io/providers/hashicorp/kubernetes/latest/docs/resources/service_v1)
