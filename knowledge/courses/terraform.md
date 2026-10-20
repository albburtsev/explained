---
slug: terraform
title: Terraform
catalogOrder: 130
description: Learn Terraform as a Kubernetes developer, from plan and apply to state, modules, Helm charts, and team workflow, on a local cluster.
tags:
  - terraform
  - infrastructure-as-code
  - kubernetes
  - devops
lessons:
  - terraform/terraform-and-kubernetes
  - terraform/first-project
  - terraform/hcl-basics
  - terraform/variables-and-outputs
  - terraform/state-and-drift
  - terraform/data-sources
  - terraform/count-and-for-each
  - terraform/modules
  - terraform/helm-charts
  - terraform/teamwork
---

`Terraform` is a tool for `infrastructure as code`. You describe the infrastructure you want in text files, and Terraform creates, changes, or deletes real objects to match them. It works with clouds, DNS, databases, monitoring, and Kubernetes through plugins called `providers`.

If you know Kubernetes, many ideas will feel familiar. You already write declarative manifests and let the system reach the desired state. Terraform does the same, but the loop is different. Kubernetes controllers reconcile all the time. Terraform runs only when you ask it to: it shows a `plan` of the changes, and you `apply` it. Instead of etcd, it keeps what it knows about real objects in a `state` file.

This course is for developers, not for platform engineers. The goal is to read, write, and review the Terraform code in your team's repository with confidence. You do not need a cloud account. All practice runs against a local Kubernetes cluster, such as kind or Docker Desktop, through the Kubernetes and Helm providers.

## What you will learn

- How Terraform compares to Kubernetes, Helm, and kubectl, and where each one fits.
- How to create a project and run the `init`, `plan`, `apply`, and `destroy` workflow.
- How to read and write HCL: blocks, references, and expressions.
- How to make a configuration flexible with variables, outputs, and locals.
- What state is, how Terraform detects drift, and how to inspect state safely.
- How to read existing objects with data sources and how Terraform orders changes.
- How to create many similar resources with `count` and `for_each`.
- How to reuse code with modules.
- How to install Helm charts with Terraform.
- How a team shares remote state and reviews plans before applying them.

## Official resources

- [Terraform documentation](https://developer.hashicorp.com/terraform/docs)
- [Terraform language reference](https://developer.hashicorp.com/terraform/language)
- [Kubernetes provider on the Terraform Registry](https://registry.terraform.io/providers/hashicorp/kubernetes/latest/docs)
- [Helm provider on the Terraform Registry](https://registry.terraform.io/providers/hashicorp/helm/latest/docs)
