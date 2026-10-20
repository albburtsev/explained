---
slug: terraform/first-project
title: First Project
description: Install Terraform on macOS, describe a namespace and an nginx Deployment, and run init, plan, apply, and destroy against a local Kubernetes cluster.
tags:
  - terraform
  - kubernetes
  - terraform-cli
  - infrastructure-as-code
---

In this lesson, you build a small Terraform project. It describes a namespace and an nginx Deployment, the same objects you would put in two YAML manifests. Then you run the whole Terraform workflow: `init`, `plan`, `apply`, and `destroy`.

You need a running local Kubernetes cluster, such as kind or Docker Desktop. The current `kubectl` context must point at it, because Terraform reads the same `~/.kube/config` file as `kubectl`.

## Install Terraform

HashiCorp publishes Terraform for macOS through its own Homebrew tap. Add the tap and install the formula from it:

```sh
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```

Check that the `terraform` command works:

```sh
terraform version
```

```text
Terraform v1.16.5
on darwin_arm64
```

Your version and platform may be different.

## Check the cluster context

Terraform changes the cluster that your current context points at. Before you go on, make sure it is the local one:

```sh
kubectl config current-context
```

```text
kind-kind
```

With Docker Desktop, the name is `docker-desktop`. If you see a shared or production cluster here, switch to your local context first.

## Create the project

A Terraform project is a directory of `.tf` files. Terraform reads every `.tf` file in the directory and joins them into one configuration. The split into files is only for people, much like a folder of manifests that you pass to `kubectl apply -f`.

Create the project directory:

```sh
mkdir terraform-course
cd terraform-course
```

Create `terraform.tf`. It lists the providers that the project needs:

```hcl
terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 3.0"
    }
  }
}
```

`source` is the provider's address in the Terraform Registry. `version` is a `version constraint`. The value `~> 3.0` allows any 3.x release but not 4.0. A new major version may break your code, so this constraint keeps upgrades inside one major version.

## Describe the namespace and the Deployment

Create `main.tf`:

```hcl
provider "kubernetes" {
  config_path = "~/.kube/config"
}

resource "kubernetes_namespace_v1" "demo" {
  metadata {
    name = "demo"
  }
}

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

The file has three blocks:

- The `provider` block configures the Kubernetes provider. With only `config_path`, it uses the current context in that file, just like `kubectl`.
- A `resource` block describes one object that Terraform manages. The first label is the resource type, `kubernetes_namespace_v1`. The second label, `demo`, is a name that exists only in your code. Together they form the `resource address`: `kubernetes_namespace_v1.demo`.
- The Deployment block follows the shape of a Deployment manifest: `metadata`, `spec`, `selector`, `template`, and `container`. Field names use snake_case, so `matchLabels` becomes `match_labels`.

The `_v1` suffix matches the Kubernetes API version. You may see older names without it, such as `kubernetes_deployment`, in existing code. The provider marks them as deprecated.

Look at the `namespace` line in the Deployment. It does not repeat the text `"demo"`. It is a `reference` to the namespace resource. From this reference, Terraform learns that the Deployment depends on the namespace, so it creates the namespace first. The next lesson covers this syntax in detail.

## Initialize the project

```sh
terraform init
```

```text
Initializing the backend...

Initializing provider plugins...
- Finding hashicorp/kubernetes versions matching "~> 3.0"...
- Installing hashicorp/kubernetes v3.3.0...
- Installed hashicorp/kubernetes v3.3.0 (signed by HashiCorp)

Terraform has created a lock file .terraform.lock.hcl to record the provider
selections it made above. Include this file in your version control repository
so that Terraform can guarantee to make the same selections by default when
you run "terraform init" in the future.

Terraform has been successfully initialized!
```

`terraform init` prepares the project directory. It reads `required_providers`, chooses the newest version that matches the constraint, and downloads the provider. Run it once in a new project, and again after you add a provider or a module.

It creates two things:

- `.terraform/` is a local cache that holds the downloaded provider binary. Do not commit it to Git, because `terraform init` can always rebuild it.
- `.terraform.lock.hcl` is the `dependency lock file`. It records the exact provider version and its checksums, like `package-lock.json` in a Node.js project. Commit it, so your teammates and CI use the same provider build.

```hcl
provider "registry.terraform.io/hashicorp/kubernetes" {
  version     = "3.3.0"
  constraints = "~> 3.0"
  hashes = [
```

## Read the plan

```sh
terraform plan
```

```text
Terraform used the selected providers to generate the following execution
plan. Resource actions are indicated with the following symbols:
  + create

Terraform will perform the following actions:

  # kubernetes_deployment_v1.web will be created
  + resource "kubernetes_deployment_v1" "web" {
      + id               = (known after apply)
      + wait_for_rollout = true

      + metadata {
          + generation       = (known after apply)
          + name             = "web"
          + namespace        = "demo"
          + resource_version = (known after apply)
          + uid              = (known after apply)
        }

      + spec {
          + min_ready_seconds         = 0
          + paused                    = false
          + progress_deadline_seconds = 600
          + replicas                  = "2"
          + revision_history_limit    = 10
          ...
        }
    }

  # kubernetes_namespace_v1.demo will be created
  + resource "kubernetes_namespace_v1" "demo" {
      + id                               = (known after apply)
      + wait_for_default_service_account = false

      + metadata {
          + generation       = (known after apply)
          + name             = "demo"
          + resource_version = (known after apply)
          + uid              = (known after apply)
        }
    }

Plan: 2 to add, 0 to change, 0 to destroy.
```

A `plan` is the list of changes that Terraform would make to match your code. Making a plan changes nothing in the cluster. You can think of it as `kubectl diff` for the whole project. This project is new and Terraform manages nothing yet, so every object must be created.

Some values are `(known after apply)`. The cluster sets them when it creates the object, like `uid` and `resourceVersion` in Kubernetes. Other values, such as `progress_deadline_seconds = 600`, are defaults that you did not write. They are the same defaults that the API server would fill in.

Every change starts with a symbol:

| Symbol | Action | Effect in the cluster |
| --- | --- | --- |
| `+` | create | Terraform creates a new object. |
| `~` | update in-place | Terraform changes the existing object, like a patch from `kubectl apply`. |
| `-` | destroy | Terraform deletes the object. |
| `-/+` | destroy and then create replacement | Terraform deletes the object and creates it again, because a field cannot change in place. |

Read the summary line first: `Plan: 2 to add, 0 to change, 0 to destroy.` In a code review, an unexpected number here, especially in `to destroy`, is a reason to stop and look closer.

## Apply the plan

```sh
terraform apply
```

The `apply` command makes a fresh plan, shows it again, and asks you to confirm. Only the exact word `yes` continues.

```text
Plan: 2 to add, 0 to change, 0 to destroy.

Do you want to perform these actions?
  Terraform will perform the actions described above.
  Only 'yes' will be accepted to approve.

  Enter a value: yes

kubernetes_namespace_v1.demo: Creating...
kubernetes_namespace_v1.demo: Creation complete after 0s [id=demo]
kubernetes_deployment_v1.web: Creating...
kubernetes_deployment_v1.web: Creation complete after 6s [id=demo/web]

Apply complete! Resources: 2 added, 0 changed, 0 destroyed.
```

The times on your machine will be different. Notice two things:

- The namespace is created before the Deployment, because of the reference.
- Terraform waits until the Deployment's Pods are ready. `kubectl apply` returns as soon as the API server accepts the object. The Kubernetes provider waits for the rollout to finish, like `kubectl rollout status`.

Terraform has also written a new file, `terraform.tfstate`. This is the `state`: Terraform's record of the objects it manages and their IDs. Do not edit it by hand. Lesson 5 explains state in detail.

## Check the cluster

```sh
kubectl get deployment web -n demo
```

```text
NAME   READY   UP-TO-DATE   AVAILABLE   AGE
web    2/2     2            2           40s
```

These are ordinary Kubernetes objects. Terraform does not run inside the cluster, and no controller watches your `.tf` files. Nothing happens until you run Terraform again.

## Read an update and a replacement

Change `replicas = 2` to `replicas = 3` in `main.tf` and run `terraform plan`:

```text
  # kubernetes_deployment_v1.web will be updated in-place
  ~ resource "kubernetes_deployment_v1" "web" {
        id               = "demo/web"
        # (1 unchanged attribute hidden)

      ~ spec {
          ~ replicas                  = "2" -> "3"
            # (4 unchanged attributes hidden)
            ...
        }
        ...
    }

Plan: 0 to add, 1 to change, 0 to destroy.
```

Lines without a symbol are context. The arrow shows the old value and the new value. Terraform hides the attributes that do not change.

Now set `replicas` back to `2`. Then, in the namespace resource, change `name` from `"demo"` to `"demo2"`. Kubernetes cannot rename an object, so the plan is different:

```text
  # kubernetes_deployment_v1.web must be replaced
-/+ resource "kubernetes_deployment_v1" "web" {
      ...
          ~ namespace        = "demo" -> "demo2" # forces replacement
      ...

  # kubernetes_namespace_v1.demo must be replaced
-/+ resource "kubernetes_namespace_v1" "demo" {
      ...
          ~ name             = "demo" -> "demo2" # forces replacement
      ...

Plan: 2 to add, 0 to change, 2 to destroy.
```

The comment `# forces replacement` marks the field that causes the replacement. The Deployment is replaced too, because its namespace comes from the reference. Do not apply this plan. Change the name back to `"demo"`.

## Destroy the objects

```sh
terraform destroy
```

```text
  # kubernetes_deployment_v1.web will be destroyed
  - resource "kubernetes_deployment_v1" "web" {
      - id               = "demo/web" -> null
      ...

  # kubernetes_namespace_v1.demo will be destroyed
  - resource "kubernetes_namespace_v1" "demo" {
      - id                               = "demo" -> null
      ...

Plan: 0 to add, 0 to change, 2 to destroy.

Do you really want to destroy all resources?
  Terraform will destroy all your managed infrastructure, as shown above.
  There is no undo. Only 'yes' will be accepted to confirm.

  Enter a value: yes

kubernetes_deployment_v1.web: Destroying... [id=demo/web]
kubernetes_deployment_v1.web: Destruction complete after 0s
kubernetes_namespace_v1.demo: Destroying... [id=demo]
kubernetes_namespace_v1.demo: Destruction complete after 6s

Destroy complete! Resources: 2 destroyed.
```

`terraform destroy` deletes every object in the state, in reverse dependency order: first the Deployment, then the namespace. It deletes only the objects that Terraform manages and leaves the rest of the cluster alone. Your `.tf` files remain, so the next `terraform apply` creates the same objects again.

Check that the namespace is gone:

```sh
kubectl get namespace demo
```

```text
Error from server (NotFound): namespaces "demo" not found
```
