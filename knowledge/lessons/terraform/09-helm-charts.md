---
slug: terraform/helm-charts
title: Helm Charts
description: Install a Helm chart with the Terraform Helm provider, pass values, read release attributes, see what Terraform tracks inside a release, and decide when Argo CD or Flux fits better.
tags:
  - terraform
  - helm
  - kubernetes
---

So far, every Kubernetes object in the project has been its own Terraform resource. Many tools, however, ship as Helm charts: ingress controllers, cert-manager, and monitoring stacks. Rewriting their manifests in HCL makes no sense. The `hashicorp/helm` provider lets Terraform install a chart as it is.

In this lesson you add the Helm provider to the `terraform-course` project, install a small chart into the `demo` namespace, and read the release attributes. Then you see what Terraform tracks and when another tool is a better choice.

## Charts and releases

A `chart` is a Helm package: a set of manifest templates plus default settings. The settings are called `values`. You override them to configure the chart.

A `release` is one installed copy of a chart. It has a name and a namespace. Helm records every change to a release as a new `revision` and keeps these records in Secrets in the release namespace.

In Terraform, one `helm_release` resource is one release. The provider contains the Helm code itself, so you do not need the Helm CLI.

This lesson targets Helm provider v3.3. Version 3 changed the syntax: `kubernetes` and `set` are now attributes with `=`, not nested blocks. Many older examples online use the v2 block syntax, such as `kubernetes { ... }` and `set { ... }`. They do not work with v3.

## Add the provider

Open `terraform.tf` and add a `helm` entry to `required_providers`, next to `kubernetes`:

```hcl
terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 3.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 3.3"
    }
  }
}
```

Provider blocks live in `main.tf`, as in your first project. Add a `provider "helm"` block there, next to `provider "kubernetes"`. It points to the same kubeconfig file, so both providers talk to the same cluster through its current context:

```hcl
provider "helm" {
  kubernetes = {
    config_path = "~/.kube/config"
  }
}
```

Note the `=` after `kubernetes`. The connection settings are an object, not a block.

Download the new provider:

```sh
terraform init
```

## Install a chart

The lesson uses `podinfo`, a tiny web app made for Kubernetes demos. Its chart is published in an HTTPS chart repository at `https://stefanprodan.github.io/podinfo`. It needs no cloud and runs on kind or Docker Desktop.

Add this resource to `main.tf`:

```hcl
resource "helm_release" "podinfo" {
  name       = "podinfo"
  repository = "https://stefanprodan.github.io/podinfo"
  chart      = "podinfo"
  version    = "6.15.0"
  namespace  = module.web.namespace

  values = [
    yamlencode({
      replicaCount = 2
      ui = {
        message = "Hello from Terraform"
      }
    })
  ]

  set = [
    {
      name  = "ui.color"
      value = "#2f855a"
    }
  ]
}
```

Here is what each argument does:

- `name` is the release name. This chart names its Deployment and Service after the release, so both are called `podinfo`.
- `repository` and `chart` say where to download the chart. You do not run `helm repo add`.
- `version` pins the chart version, like an image tag. Without it, Terraform installs the latest version at apply time, and the result changes over time.
- `namespace` reads the `namespace` output of the `web` module, so the release goes into `demo`. The reference also creates a dependency, because the output gets its value from the namespace resource inside the module. Terraform creates the namespace before the release and uninstalls the release before it deletes the namespace.
- `values` is a list of YAML documents, like `-f` files for `helm install`. The built-in `yamlencode` function turns an HCL object into YAML, so you write values in normal HCL and can use references and variables inside them.
- `set` overrides one value by its path, like `--set` on the command line. It is a list of objects.

Terraform merges the `values` documents in order, and then applies every `set` entry on top. Use `values` for most settings. Keep `set` for single values that come from other resources or variables.

Run a plan:

```sh
terraform plan
```

The plan adds one resource, `helm_release.podinfo`. It does not list a Deployment or a Service. Those objects are inside the chart, and Terraform does not see them as separate resources.

Apply the change:

```sh
terraform apply
```

By default, the apply waits until the release's objects are ready, as `helm install --wait` does. Check the result with kubectl:

```sh
kubectl get deployment,service -n demo
```

You see a `podinfo` Deployment with two ready Pods and a `podinfo` Service, next to `web` from earlier lessons. To open the app, forward a port:

```sh
kubectl port-forward -n demo service/podinfo 9898:9898
```

Open `http://localhost:9898` in a browser. The page shows your message in the color you set. Press `Ctrl+C` to stop the port forward.

If you have the Helm CLI, `helm list -n demo` shows the same release. This step is optional.

## Read release attributes

After the apply, the resource exposes the release state. `status` is the Helm status, such as `deployed` or `failed`. `metadata` is an object with release details, including `version` (chart version), `app_version`, and `revision`.

Add these outputs to `outputs.tf`:

```hcl
output "podinfo_status" {
  value = helm_release.podinfo.status
}

output "podinfo_chart_version" {
  value = helm_release.podinfo.metadata.version
}

output "podinfo_revision" {
  value = helm_release.podinfo.metadata.revision
}
```

Run `terraform apply` again. It changes nothing in the cluster and prints the outputs: status `deployed`, chart version `6.15.0`, and revision `1`.

Now change `replicaCount` to `3` in `main.tf` and run `terraform plan`. The plan updates `helm_release.podinfo` in place and shows the changed `values`. After `terraform apply`, Helm upgrades the release, and the revision output becomes `2`.

## What Terraform tracks

The state holds one object for the chart: the release. It keeps the release name, the chart, its version, the values, and the metadata. It does not hold the Deployment, the Service, or any other object that the chart renders.

When Terraform refreshes the state, the provider reads the release record from Helm. It does not compare the live objects with the chart. Try it:

```sh
kubectl scale deployment podinfo -n demo --replicas=5
terraform plan
```

The plan reports no changes, although the Deployment now has five replicas instead of three. A Deployment managed as its own Terraform resource, such as `module.web.kubernetes_deployment_v1.this`, would show this drift in the plan. Inside a Helm release, the same drift is invisible to Terraform.

Terraform does notice changes to the release itself. If someone uninstalls the release, the next plan installs it again. If you change the values or the chart version in code, the plan upgrades the release.

To fix drift inside a release, change something in the release, or correct the object by hand. Here, restore the replica count:

```sh
kubectl scale deployment podinfo -n demo --replicas=3
```

The provider has an experimental `manifest` setting. It stores the rendered manifests in state, so a plan shows which objects a change will touch. It is off by default.

## When to use Terraform for Helm

Terraform runs only when someone starts it. Kubernetes controllers reconcile all the time. This difference decides which tool should own a release.

Terraform fits platform add-ons:

- An ingress controller, cert-manager, or a monitoring stack.
- Charts that are installed once per cluster and change rarely.
- Charts whose values come from other Terraform resources, such as a namespace, a DNS name, or a cloud role created in the same code.

For your team's applications, plain Helm in CI or a GitOps tool such as `Argo CD` or `Flux` usually fits better:

- Applications are deployed many times a day, and a full Terraform plan for every release is slow.
- GitOps controllers reconcile continuously, like any Kubernetes controller. They detect and repair drift inside the release, which Terraform does not.
- Developers see sync status and history per application.

A common setup combines both. Terraform installs the platform add-ons and Argo CD or Flux itself. GitOps then deploys the applications.

Whatever you choose, give each release one owner. Do not run `helm upgrade` or point Argo CD at a release that Terraform manages. The tools overwrite each other's changes, and the Terraform state stops matching the cluster.

## Learn more

- [Helm provider on the Terraform Registry](https://registry.terraform.io/providers/hashicorp/helm/latest/docs)
- [`helm_release` resource reference](https://registry.terraform.io/providers/hashicorp/helm/latest/docs/resources/release)
- [Helm provider v3 upgrade guide](https://registry.terraform.io/providers/hashicorp/helm/latest/docs/guides/v3-upgrade-guide)
- [podinfo on GitHub](https://github.com/stefanprodan/podinfo)
