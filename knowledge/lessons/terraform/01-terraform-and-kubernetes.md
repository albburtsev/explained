---
slug: terraform/terraform-and-kubernetes
title: Terraform and Kubernetes
description: Build a mental model of Terraform from Kubernetes ideas you already know, and see where Terraform, Helm, and kubectl each fit.
tags:
  - terraform
  - kubernetes
  - infrastructure-as-code
---

Terraform follows the idea of `infrastructure as code`: you describe infrastructure in text files, keep them in Git, and let a tool create the real objects. The files are reviewed like any other code, and the same files always describe the same setup. Terraform can manage anything that has an API: cloud networks, Kubernetes clusters, databases, DNS records, and objects inside a cluster.

As a Kubernetes developer, you already work this way with apps. This lesson maps Terraform onto the Kubernetes ideas you know, so the next lessons can focus on practice.

## The same desired state, a different language

Here is a namespace as a Kubernetes manifest:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: demo
```

And here is the same namespace in Terraform:

```hcl
resource "kubernetes_namespace_v1" "demo" {
  metadata {
    name = "demo"
  }
}
```

Terraform files use `HCL`, the HashiCorp Configuration Language, and end in `.tf`. A `resource` block declares one object that Terraform manages. The first label, `kubernetes_namespace_v1`, is the resource type. The second label, `demo`, is a local name that other Terraform code uses to refer to this resource. Both files are declarative: they describe the result, not the steps to reach it.

The big difference is not the syntax. It is who makes the description real, and when.

## Plan and apply instead of a control loop

In Kubernetes, `kubectl apply` stores your object in the API server. Controllers then watch it all the time. If a Pod dies or someone edits a Deployment, a controller notices and works to restore the desired state. This continuous process is reconciliation.

Terraform has no process that keeps running. It works only when you run a command:

1. `terraform plan` reads your `.tf` files, checks the real objects through their APIs, and compares the two. The result is a `plan`: a list of objects to create, update, or delete. It ends with a summary such as `Plan: 1 to add, 0 to change, 0 to destroy.` Nothing has changed yet.
2. `terraform apply` shows a plan, asks you to confirm, and then makes those changes in the right order. This step is called `apply`.
3. Terraform saves what it did and exits.

So Terraform reconciles once per run, and a human reviews the change before it happens. Between runs, nobody watches. If someone changes a managed object by hand, Terraform does nothing until the next `plan` shows the difference. That difference between the code and the real world is called `drift`, and lesson 5 covers it.

## Providers instead of controllers

A Kubernetes controller or operator knows how to make one kind of resource real. Terraform has a similar idea: a `provider` is a plugin that knows one API. The `kubernetes` provider talks to the Kubernetes API server, the `helm` provider installs charts, and cloud providers talk to AWS, Google Cloud, or Azure. Each provider defines resource types, such as `kubernetes_namespace_v1` or `kubernetes_deployment_v1`.

Unlike a controller, a provider does not run in the cluster. Terraform starts it on your machine or in a CI job during a command, and it stops when the command ends. The `kubernetes` provider reads your kubeconfig and calls the API server, just like kubectl does.

Terraform also does not replace Kubernetes controllers. When Terraform creates a Deployment, the Deployment controller still creates the ReplicaSet and the Pods. Terraform manages only the objects you declare in its files.

## State instead of etcd

Kubernetes keeps every object in etcd, behind the API server. Terraform needs its own record of what it manages. This record is the `state`. By default, it is a JSON file named `terraform.tfstate` in the project directory.

State links each resource block in your code to a real object, for example `kubernetes_namespace_v1.demo` to the namespace `demo` in your cluster. It also stores the last known attributes of that object. Before each plan, Terraform refreshes the state from the real APIs, so the plan compares your code with what actually exists.

State is not the real world, and it is not your code. It is Terraform's memory. If you lose it, Terraform forgets that it created those objects. State can also contain secrets, so treat the file with care. Teams keep it in shared remote storage, which lesson 10 covers.

## Side by side

| Idea | Kubernetes | Terraform |
| --- | --- | --- |
| Desired state | YAML manifests | `.tf` files in HCL |
| Unit of work | Object of a given kind | Resource of a given type |
| Knows an API | Controller or operator | Provider |
| When changes happen | Continuously, in a control loop | Only when you run `apply` |
| Preview of changes | `kubectl diff` | `terraform plan` |
| Record of objects | etcd, behind the API server | State file |
| Scope | Objects in one cluster | Anything with an API, including clusters |

## Where Terraform, Helm, and kubectl fit

All three tools can create Kubernetes objects, so teams usually split the work:

- Terraform creates the cluster itself, cloud resources around it such as networks, databases, and DNS, and shared platform pieces such as namespaces, access rules, or an ingress controller.
- Kubernetes manifests and Helm charts describe the apps. A CI pipeline or a GitOps tool such as Argo CD or Flux usually deploys them.
- kubectl is for looking around and debugging: `get`, `describe`, `logs`, and quick experiments.

Your team's split may differ. The important rule is that one tool owns each object. If Terraform and Argo CD both manage the same Deployment, each one undoes the other's changes.

This course uses Terraform to manage Kubernetes objects directly. A local cluster lets you practice without a cloud account, and the language, plan, apply, and state work the same way for cloud resources.

## A note on OpenTofu

You may see `tofu` instead of `terraform` in some repositories. OpenTofu is an open-source fork of Terraform. It started in 2023, after HashiCorp moved Terraform to the Business Source License, and it is hosted by the Linux Foundation. It uses the same configuration language, so most of this course applies to it too.

## Check your understanding

A Deployment `web` is managed by Terraform with `replicas = 2`. A teammate runs `kubectl scale deployment web --replicas=5`. Think about two questions:

- What happens right away? Nothing on the Terraform side. No Terraform process is running, so the Deployment keeps 5 replicas.
- What happens at the next `terraform plan`? Terraform refreshes state, sees 5 instead of 2, and proposes to change the Deployment back to 2. You decide whether to apply that change or update the code.

In the next lesson, you install Terraform and create your first project against a local cluster.

## Official resources

- [What is Terraform?](https://developer.hashicorp.com/terraform/intro)
- [Terraform state](https://developer.hashicorp.com/terraform/language/state)
- [Kubernetes provider on the Terraform Registry](https://registry.terraform.io/providers/hashicorp/kubernetes/latest/docs)
- [OpenTofu FAQ](https://opentofu.org/faq/)
