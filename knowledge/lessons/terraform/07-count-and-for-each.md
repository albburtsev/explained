---
slug: terraform/count-and-for-each
title: count and for_each
description: Create many similar Kubernetes objects from one resource block with count and for_each, and see why for_each keeps plans safe when a list changes.
tags:
  - terraform
  - hcl
  - kubernetes
---

In Kubernetes, you do not write ten Pod manifests to get ten Pods. You write one template and set `replicas`. Terraform has a similar tool. A `meta-argument` is an argument that Terraform itself handles, not the provider, and you can add it to any resource block. Two meta-arguments turn one block into many objects: `count` and `for_each`.

Each object that such a block creates is an `instance`. Every instance has its own address in the plan and in the state. The way Terraform builds these addresses is the main difference between `count` and `for_each`.

In this lesson, you add team namespaces and ConfigMaps to the `terraform-course` project.

## Create namespaces with count

`count` takes a whole number. Terraform creates that many instances of the resource. Inside the block, `count.index` is the number of the current instance, starting at `0`.

Add a list of teams to `variables.tf`:

```hcl
variable "teams" {
  type    = list(string)
  default = ["team-a", "team-b", "team-c"]
}
```

Add one namespace per team to `main.tf`:

```hcl
resource "kubernetes_namespace_v1" "team" {
  count = length(var.teams)

  metadata {
    name = var.teams[count.index]
  }
}
```

`length(var.teams)` is `3`, so Terraform creates three instances. The first one gets `var.teams[0]`, which is `team-a`, and so on.

Run `terraform apply`. The plan lists three instances with index addresses:

```text
  # kubernetes_namespace_v1.team[0] will be created
  # kubernetes_namespace_v1.team[1] will be created
  # kubernetes_namespace_v1.team[2] will be created
```

Confirm with `yes`, then check the cluster:

```sh
kubectl get namespaces
```

The address `kubernetes_namespace_v1.team` now means a list of instances. To read one of them, add its index: `kubernetes_namespace_v1.team[0].metadata[0].name` is `team-a`.

This works like a StatefulSet. Its Pods are named `web-0`, `web-1`, and `web-2`, and each identity is tied to a number. Here, too, each namespace is known by its position, not by its name.

## Make a resource optional

`count` is also the usual way to turn one resource on or off. Add a flag to `variables.tf`:

```hcl
variable "debug_enabled" {
  type    = bool
  default = false
}
```

Add an optional ConfigMap to `main.tf`:

```hcl
resource "kubernetes_config_map_v1" "debug" {
  count = var.debug_enabled ? 1 : 0

  metadata {
    name      = "debug"
    namespace = kubernetes_namespace_v1.demo.metadata[0].name
  }

  data = {
    LOG_LEVEL = "debug"
  }
}
```

With the default value, `count` is `0`, and Terraform creates nothing. Check it with `terraform plan -var debug_enabled=true`: the plan now adds `kubernetes_config_map_v1.debug[0]`.

You will see this pattern often in team repositories. When `count` is `0`, `kubernetes_config_map_v1.debug[0]` does not exist, and a reference to it fails. So code that reads it checks the same flag:

```hcl
output "debug_config_map" {
  value = var.debug_enabled ? kubernetes_config_map_v1.debug[0].metadata[0].name : null
}
```

## The problem with indexes

Now suppose `team-b` no longer needs a namespace. Remove it from the middle of the list:

```hcl
  default = ["team-a", "team-c"]
```

Run `terraform plan`. The output is shortened here:

```text
  # kubernetes_namespace_v1.team[1] must be replaced
-/+ resource "kubernetes_namespace_v1" "team" {
      ~ metadata {
          ~ name = "team-b" -> "team-c" # forces replacement
        }
    }

  # kubernetes_namespace_v1.team[2] will be destroyed
  # (because index [2] is out of range for count)
  - resource "kubernetes_namespace_v1" "team" {
      - metadata {
          - name = "team-c" -> null
        }
    }

Plan: 1 to add, 0 to change, 2 to destroy.
```

You wanted to delete one namespace, but Terraform plans to delete two and create one. Terraform matches the list with the state by index. Index `1` was `team-b` and is now `team-c`. A namespace cannot be renamed, so Terraform replaces it. Index `2` no longer exists, so Terraform destroys it. In a real cluster, `team-c` would lose all its objects, because deleting a namespace deletes everything inside it.

Do not apply this plan. Put `team-b` back into the list. `terraform plan` should report no changes again.

## Switch to for_each

`for_each` takes a map or a set of strings. Terraform creates one instance for each element and uses the element's key in the address. Inside the block, `each.key` is the key of the current element and `each.value` is its value. For a set, both are the same string.

`var.teams` is a list. `for_each` does not accept a list, so convert it with `toset()`. Replace the namespace resource in `main.tf`:

```hcl
resource "kubernetes_namespace_v1" "team" {
  for_each = toset(var.teams)

  metadata {
    name = each.key
  }
}
```

The instance addresses change from `team[0]` to `team["team-a"]`. Without help, Terraform would destroy the old instances and create new ones. A `moved` block tells Terraform that an object only got a new address. Add these blocks to `main.tf`:

```hcl
moved {
  from = kubernetes_namespace_v1.team[0]
  to   = kubernetes_namespace_v1.team["team-a"]
}

moved {
  from = kubernetes_namespace_v1.team[1]
  to   = kubernetes_namespace_v1.team["team-b"]
}

moved {
  from = kubernetes_namespace_v1.team[2]
  to   = kubernetes_namespace_v1.team["team-c"]
}
```

Run `terraform plan`. For each namespace, the plan says that it `has moved to` the new address, and it plans no changes in the cluster. Run `terraform apply` to save the new addresses in the state. After that, you may delete the `moved` blocks. In a shared repository, keep them until every state that uses this code, such as staging and production, has been applied.

Now remove `team-b` from the list again and run `terraform plan`:

```text
  # kubernetes_namespace_v1.team["team-b"] will be destroyed
  # (because key ["team-b"] is not in for_each map)

Plan: 0 to add, 0 to change, 1 to destroy.
```

This time, the plan matches your intent. Each instance is known by its key, so the other namespaces keep their addresses. Apply the plan.

As a rule, use `count` for an optional resource or for identical copies. Use `for_each` when each instance has its own identity, such as a name. A block cannot use both.

## Use a map with for_each

With a map, `each.value` carries extra data for each instance. Add a log level for each app to `variables.tf`:

```hcl
variable "app_log_levels" {
  type = map(string)
  default = {
    frontend = "info"
    backend  = "debug"
  }
}
```

Create one ConfigMap per app in `main.tf`:

```hcl
resource "kubernetes_config_map_v1" "app" {
  for_each = var.app_log_levels

  metadata {
    name      = "${each.key}-config"
    namespace = kubernetes_namespace_v1.demo.metadata[0].name
  }

  data = {
    LOG_LEVEL = each.value
  }
}
```

Apply the change. The plan creates `kubernetes_config_map_v1.app["backend"]` and `kubernetes_config_map_v1.app["frontend"]`. Then check the result:

```sh
kubectl get configmaps -n demo
```

Terraform must know the keys of a `for_each` value before it changes anything. Keys from a variable or a literal map are fine. A value that appears only after apply, such as an object's `uid`, cannot be a key.

## Transform collections with for

The `kubernetes_namespace_v1.team` resource is now a map of instances. Other code often needs a plain list or a smaller map built from it. A `for` expression builds a new list or map from an existing collection.

Add two outputs to `outputs.tf`:

```hcl
output "team_namespaces" {
  value = [for ns in kubernetes_namespace_v1.team : ns.metadata[0].name]
}

output "app_config_maps" {
  value = { for app, cm in kubernetes_config_map_v1.app : app => cm.metadata[0].name }
}
```

Square brackets build a list. Curly braces build a map, and `=>` separates the key from the value. With two names after `for`, the first one is the key and the second one is the value.

Add `if` at the end to filter elements:

```hcl
[for app, level in var.app_log_levels : app if level == "debug"]
```

This expression returns `["backend"]`. Run `terraform apply` and read the outputs with `terraform output`.

## dynamic blocks

`count` and `for_each` repeat whole resources. Sometimes code must repeat a nested block instead, such as `env` inside a container. A `dynamic` block does this:

```hcl
dynamic "env" {
  for_each = var.app_env
  content {
    name  = env.key
    value = env.value
  }
}
```

Terraform generates one `env` block for each element of `var.app_env`, a map of variable names and values. Inside `content`, the element is available under the block's label, here `env`. You will meet this in shared modules. HashiCorp advises against overusing it, because it makes code harder to read. When the list of nested blocks is fixed, write them out.

## What to check in a review

- A change to a list used by `count` can replace or destroy instances that nobody meant to touch. Read every `[N]` address in the plan.
- A switch between `count` and `for_each`, or a renamed resource, needs `moved` blocks. Without them, the plan destroys and recreates objects.
- The plan summary should match the intent of the change. If one item was removed, expect one destroy.

## Further reading

- [The count meta-argument](https://developer.hashicorp.com/terraform/language/meta-arguments/count)
- [The for_each meta-argument](https://developer.hashicorp.com/terraform/language/meta-arguments/for_each)
- [for expressions](https://developer.hashicorp.com/terraform/language/expressions/for)
- [Refactoring with moved blocks](https://developer.hashicorp.com/terraform/language/modules/develop/refactoring)
- [dynamic blocks](https://developer.hashicorp.com/terraform/language/expressions/dynamic-blocks)
