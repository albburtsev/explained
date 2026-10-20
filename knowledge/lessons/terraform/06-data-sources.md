---
slug: terraform/data-sources
title: Data Sources
description: Read objects that Terraform does not manage with data blocks, use their values in resources, and see how references, depends_on, and the dependency graph decide the order of changes.
tags:
  - terraform
  - kubernetes
  - data-sources
  - dependencies
---

Until now, every block in `terraform-course` was a `resource`. Terraform creates it, owns it, and deletes it on `destroy`. A real cluster also holds objects that other people or tools created: the `kube-system` namespace, a ConfigMap from the platform team, a Secret someone added with `kubectl`. Your code often needs values from such objects. Data sources read them. In the second half of the lesson, you will see how Terraform decides the order in which it reads, creates, and deletes objects.

## Read an object with a data block

A `data source` reads an existing object and makes its attributes available to your code. It is the Terraform version of `kubectl get`: it never creates, changes, or deletes anything. You declare it with a `data` block:

```hcl
data "kubernetes_config_map_v1" "platform" {
  metadata {
    name      = "platform-settings"
    namespace = "default"
  }
}
```

The block looks like a resource block, but it has a different meaning:

- The first label is the data source type. The provider defines it, just as it defines resource types. `kubernetes_config_map_v1` reads one ConfigMap.
- The second label is the local name. Together they give the address `data.kubernetes_config_map_v1.platform`. Note the `data.` prefix: a resource and a data source can have the same type and name without a conflict.
- The arguments are the query, not the desired state. Here, `name` and `namespace` say which ConfigMap to read.

You use the result with a normal reference. The `data` attribute of this data source is a map with the keys of the ConfigMap:

```hcl
data.kubernetes_config_map_v1.platform.data["log_level"]
```

Terraform reads data sources again on every `plan` and `apply`. It saves the result in state, but it does not manage the object. If the ConfigMap changes, the next plan simply uses the new value. This is not drift, because Terraform never owned the object. `terraform destroy` removes the result from state and leaves the ConfigMap in the cluster.

## Why not let Kubernetes read it

Kubernetes can read ConfigMaps by itself: a Pod can take environment variables from a ConfigMap with `envFrom` or `configMapKeyRef`. Prefer that when it works. But a Pod can read ConfigMaps and Secrets only from its own namespace. The `web` Pods run in `demo`, and the platform team's ConfigMap lives in `default`.

A data source works at a different level. Terraform reads the value when it plans, and writes it into the Deployment as a plain value. Kubernetes never sees the link. The value also appears in the plan, so a reviewer can see what will change.

## A missing object is not always an error

Check the name and the namespace in a data block carefully. Some Kubernetes data sources, including `kubernetes_config_map_v1`, do not fail when the object does not exist. They return empty attributes instead. The error then appears later, at the line that reads a key from the empty result, not at the `data` block itself.

## When Terraform reads data sources

Normally, Terraform reads data sources at the start of `plan`. You see it in the output:

```text
data.kubernetes_config_map_v1.platform: Reading...
data.kubernetes_config_map_v1.platform: Read complete after 0s [id=default/platform-settings]
```

The values are known during planning, so the plan shows them in full. Sometimes Terraform cannot read so early. An argument of the data block may use a value that is `(known after apply)`, such as an attribute of a resource that Terraform has not created yet. Then Terraform delays the read until `apply` and says so in the plan:

```text
  # data.kubernetes_config_map_v1.platform will be read during apply
  # (config refers to values not yet known)
```

The plan marks this read with the `<=` symbol. Every value that comes from the data source is now `(known after apply)` too, so the plan tells the reviewer less.

There is also a trap. If the data block reads an object that the same configuration creates, but its arguments are plain strings, Terraform reads during planning. The object does not exist yet, and you get an empty result. The rule is simple: when Terraform manages an object, refer to the resource directly. Use a data source only for objects that something else manages.

## More Kubernetes data sources

The Kubernetes provider has data sources for many object kinds. Their names follow the resource names, such as `kubernetes_secret_v1`, `kubernetes_namespace_v1`, and `kubernetes_service_v1`. A few examples:

```hcl
data "kubernetes_namespace_v1" "kube_system" {
  metadata {
    name = "kube-system"
  }
}

data "kubernetes_all_namespaces" "all" {}

output "kube_system_uid" {
  value = data.kubernetes_namespace_v1.kube_system.metadata[0].uid
}

output "namespaces" {
  value = data.kubernetes_all_namespaces.all.namespaces
}
```

`kubernetes_all_namespaces` takes no arguments and returns a list of all namespace names. The UID of `kube-system` lives as long as the cluster does, so teams sometimes use it as a cluster ID.

Reading a Secret with `kubernetes_secret_v1` works like reading a ConfigMap. Its `data` is marked sensitive, so Terraform hides it in the output. But, as you saw in the previous lesson, it is still stored in state as plain text.

## The dependency graph

Before Terraform does any work, it builds a `dependency graph`. Every resource and data source is a node. Every reference from one block to another is an edge. Your Deployment has this line:

```hcl
namespace = kubernetes_namespace_v1.demo.metadata[0].name
```

This reference is an `implicit dependency`: the Deployment depends on the namespace, so Terraform creates the namespace first. The Service has the same reference. The Deployment and the Service do not refer to each other, so Terraform creates them at the same time, as soon as the namespace is ready. By default, Terraform works on up to 10 objects in parallel; the `-parallelism` option of `plan`, `apply`, and `destroy` changes this limit. On `destroy`, Terraform walks the graph in reverse: it deletes the Deployment and the Service first and the namespace last.

The reference matters more than the value. Look at these two lines:

```hcl
namespace = var.namespace
namespace = kubernetes_namespace_v1.demo.metadata[0].name
```

Both give the Deployment the string `demo`. Only the second one creates an edge to the namespace. With the first one, Terraform may create the Deployment before the namespace exists, and the Kubernetes API rejects it. When you review code, watch for literal names and variables where a reference to the resource belongs.

## Explicit dependencies with depends_on

Sometimes one object needs another, but no argument refers to it. For such a hidden dependency, add the `depends_on` meta-argument. It takes a list of addresses and works in any `resource` or `data` block:

```hcl
resource "kubernetes_job_v1" "smoke_test" {
  depends_on = [kubernetes_service_v1.web]

  # ...
}
```

This creates an `explicit dependency`: Terraform finishes all work on the Service before it starts the Job. Even here, a reference is often better. If the Job's command builds its URL from `kubernetes_service_v1.web.metadata[0].name`, the edge appears by itself.

In Kubernetes code, you rarely need `depends_on`. Controllers reconcile all the time, so the order of most objects does not matter. A Service without Pods simply waits for them. The official documentation calls `depends_on` a last resort, for good reason:

- It makes plans more conservative. In a data block, `depends_on` delays the read until `apply` whenever the dependency has changes. The plan then shows `(depends on a resource or a module with changes pending)` and more values as `(known after apply)`.
- It hides the reason. A reference explains itself; a `depends_on` line does not. In review, ask for a short comment next to it.

## See the graph

`terraform graph` prints the dependency graph in DOT, the text format of the Graphviz tools. Run it in the project directory after the practice below. You will see lines similar to these:

```text
digraph G {
  rankdir = "RL";
  node [shape = rect, fontname = "sans-serif"];
  "data.kubernetes_config_map_v1.platform" [label="data.kubernetes_config_map_v1.platform"];
  "kubernetes_deployment_v1.web" [label="kubernetes_deployment_v1.web"];
  "kubernetes_namespace_v1.demo" [label="kubernetes_namespace_v1.demo"];
  "kubernetes_service_v1.web" [label="kubernetes_service_v1.web"];
  "kubernetes_deployment_v1.web" -> "data.kubernetes_config_map_v1.platform";
  "kubernetes_deployment_v1.web" -> "kubernetes_namespace_v1.demo";
  "kubernetes_service_v1.web" -> "kubernetes_namespace_v1.demo";
}
```

Each arrow points from a node to the node it depends on. The text is enough for a small project. If you have Graphviz, `terraform graph | dot -Tsvg > graph.svg` draws a picture.

## Practice

Your cluster and the `terraform-course` project from the previous lessons must be ready.

1. Play the platform team and create a ConfigMap outside Terraform:

   ```sh
   kubectl create configmap platform-settings -n default --from-literal=log_level=info
   ```

2. Add the data block to `main.tf`:

   ```hcl
   data "kubernetes_config_map_v1" "platform" {
     metadata {
       name      = "platform-settings"
       namespace = "default"
     }
   }
   ```

3. In the `kubernetes_deployment_v1.web` resource, add an `env` block inside the `container` block, after `image`:

   ```hcl
   env {
     name  = "LOG_LEVEL"
     value = data.kubernetes_config_map_v1.platform.data["log_level"]
   }
   ```

4. Run `terraform plan`. Near the top of the output, Terraform reports that it reads the ConfigMap. The plan updates the Deployment in place and adds `LOG_LEVEL` with the value `info`. Run `terraform apply` and confirm with `yes`.

5. Check the result in the cluster and in state:

   ```sh
   kubectl get deployment web -n demo -o jsonpath='{.spec.template.spec.containers[0].env}'
   terraform state list
   ```

   The Deployment has `LOG_LEVEL` set to `info`. The state list now includes `data.kubernetes_config_map_v1.platform`.

6. Change the ConfigMap behind Terraform's back:

   ```sh
   kubectl patch configmap platform-settings -n default --type merge -p '{"data":{"log_level":"debug"}}'
   terraform plan
   ```

   Terraform does not try to undo this change, because it does not manage the ConfigMap. It reads the new value and plans to change `LOG_LEVEL` from `info` to `debug` in the Deployment. Do not apply it.

7. Run `terraform graph` and find the arrows from `kubernetes_deployment_v1.web` to the namespace and to the data source.

8. See what happens when the object is missing:

   ```sh
   kubectl delete configmap platform-settings -n default
   terraform plan
   ```

   The plan fails. The error points at the line in the `env` block that reads `log_level`, not at the `data` block.

9. Clean up for the next lessons. Remove the `env` block and the `data` block from `main.tf`, then run `terraform apply` and confirm with `yes`. Terraform removes `LOG_LEVEL` from the Deployment.

## Official resources

- [Data sources](https://developer.hashicorp.com/terraform/language/data-sources)
- [The depends_on meta-argument](https://developer.hashicorp.com/terraform/language/meta-arguments/depends_on)
- [terraform graph command](https://developer.hashicorp.com/terraform/cli/commands/graph)
- [kubernetes_config_map_v1 data source](https://registry.terraform.io/providers/hashicorp/kubernetes/latest/docs/data-sources/config_map_v1)
