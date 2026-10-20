---
slug: terraform/modules
title: Modules
description: Extract the namespace, Deployment, and Service into a local module, call it twice, move existing resources with moved blocks, and read remote module sources.
tags:
  - terraform
  - kubernetes
  - modules
  - refactoring
---

Your `terraform-course` project describes one app: a namespace, a Deployment, and a Service. A second app would need the same three blocks again with other names. Copying them works, but every fix then has to be made in two places. Terraform solves this with modules.

If you know Helm, you already know the idea. A chart packs several Kubernetes objects behind a small set of values. A module packs several Terraform resources behind a small set of input variables. You install a chart many times with different values, and you call a module many times with different inputs.

## Root and child modules

A `module` is a directory of `.tf` files. Terraform reads all files in a directory together, so the file names only help people.

You have used a module from the first lesson. The directory where you run `terraform plan` is the `root module`. A module that another module calls with a `module` block is a `child module`. A child module can live in a subdirectory of your project, in the Terraform Registry, or in a Git repository.

A child module has the same parts as your project:

- `variables.tf` declares its inputs, like `values.yaml` in a chart.
- `main.tf` holds its resources, like the chart templates.
- `outputs.tf` declares the results that the caller can read.

A module is a closed box. The caller cannot read its variables, locals, or resources directly. The caller sees only the outputs. Inside the module, `var.name` means the module's own `name` variable, not a root variable with the same name.

## Calling a module

You call a module with a `module` block:

```hcl
module "web" {
  source = "./modules/web-app"

  name      = "web"
  namespace = var.namespace
  replicas  = var.replicas
  image_tag = var.image_tag
}
```

- The label, `web`, is the local name of this call. One module can be called many times under different names.
- `source` says where the module code is. A local path must start with `./` or `../`.
- The other arguments set the module's input variables. A variable without a default is required, just as in the root module.

To read a result, use `module.<call name>.<output name>`, for example `module.web.namespace`.

The child module does not need its own `provider` block. It uses the `kubernetes` provider that the root module configures. It should still declare the provider in `required_providers`, so Terraform knows that `kubernetes` means `hashicorp/kubernetes`. A module that other modules call must not contain `provider` blocks.

## Addresses inside a module

Each resource inside a module gets an address with the call name in front:

```text
module.web.kubernetes_deployment_v1.this
```

Read it from left to right: the module call `web`, then the resource `kubernetes_deployment_v1.this` inside it. The same name `this` exists in every call, so `module.admin.kubernetes_deployment_v1.this` is a different object. Inside a module with one resource of a type, `this` is a common name.

You will see these addresses in `plan` output, in `terraform state list`, and in code review.

## Refactoring with `moved`

Terraform tracks objects by address. If you move `kubernetes_deployment_v1.web` into a module, the new address is `module.web.kubernetes_deployment_v1.this`. Terraform sees one resource that disappeared and one new resource. The plan then destroys the old objects and creates new ones. For a namespace, this deletes everything inside it.

A `moved` block tells Terraform that an object only changed its address:

```hcl
moved {
  from = kubernetes_deployment_v1.web
  to   = module.web.kubernetes_deployment_v1.this
}
```

Terraform updates the address in state and keeps the real object. The plan shows the move instead of a destroy and a create. `moved` blocks need Terraform v1.1+.

This matters in team code. When a pull request moves resources into a module, look for `moved` blocks. A refactoring plan should show only moves and no destroys.

## Practice

Your cluster from the earlier lessons must be running. Work in the `terraform-course` directory. You will turn the namespace, Deployment, and Service from `main.tf` into a module without recreating them.

1. Create the module directory:

   ```sh
   mkdir -p modules/web-app
   ```

2. Create `modules/web-app/terraform.tf`:

   ```hcl
   terraform {
     required_providers {
       kubernetes = {
         source = "hashicorp/kubernetes"
       }
     }
   }
   ```

   The root module already sets the provider version, so the module only names the source.

3. Create `modules/web-app/variables.tf`:

   ```hcl
   variable "name" {
     type        = string
     description = "Name of the Deployment and the Service, and the app label."
   }

   variable "namespace" {
     type        = string
     description = "Name of the namespace that the module creates."
   }

   variable "replicas" {
     type        = number
     default     = 1
     description = "Number of nginx Pods."
   }

   variable "image_tag" {
     type        = string
     description = "Tag of the nginx image, such as 1.27."
   }
   ```

4. Create `modules/web-app/main.tf`. It is the code from `main.tf` with names replaced by variables:

   ```hcl
   locals {
     common_labels = {
       "app.kubernetes.io/managed-by" = "terraform"
       "app.kubernetes.io/part-of"    = "terraform-course"
     }

     app_labels = merge(local.common_labels, { app = var.name })
   }

   resource "kubernetes_namespace_v1" "this" {
     metadata {
       name   = var.namespace
       labels = local.common_labels
     }
   }

   resource "kubernetes_deployment_v1" "this" {
     metadata {
       name      = var.name
       namespace = kubernetes_namespace_v1.this.metadata[0].name
       labels    = local.app_labels
     }

     spec {
       replicas = var.replicas

       selector {
         match_labels = {
           app = var.name
         }
       }

       template {
         metadata {
           labels = local.app_labels
         }

         spec {
           container {
             name  = "nginx"
             image = "nginx:${var.image_tag}"

             port {
               container_port = 80
             }
           }
         }
       }
     }
   }

   resource "kubernetes_service_v1" "this" {
     metadata {
       name      = var.name
       namespace = kubernetes_namespace_v1.this.metadata[0].name
       labels    = local.app_labels
     }

     spec {
       selector = {
         app = var.name
       }

       port {
         port        = 80
         target_port = 80
       }
     }
   }
   ```

5. Create `modules/web-app/outputs.tf`:

   ```hcl
   output "namespace" {
     description = "Namespace that holds the app."
     value       = kubernetes_namespace_v1.this.metadata[0].name
   }

   output "service_name" {
     description = "Name of the Service in front of the app Pods."
     value       = kubernetes_service_v1.this.metadata[0].name
   }
   ```

6. In the root `main.tf`, keep the `provider` block. Delete the `kubernetes_namespace_v1.demo`, `kubernetes_deployment_v1.web`, and `kubernetes_service_v1.web` blocks. The module has its own labels now, so also delete `web_labels` and `image` from the `locals` block. Keep `common_labels` if other resources still use it. Then add the module call and three `moved` blocks:

   ```hcl
   module "web" {
     source = "./modules/web-app"

     name      = "web"
     namespace = var.namespace
     replicas  = var.replicas
     image_tag = var.image_tag
   }

   moved {
     from = kubernetes_namespace_v1.demo
     to   = module.web.kubernetes_namespace_v1.this
   }

   moved {
     from = kubernetes_deployment_v1.web
     to   = module.web.kubernetes_deployment_v1.this
   }

   moved {
     from = kubernetes_service_v1.web
     to   = module.web.kubernetes_service_v1.this
   }
   ```

   The root variables go into the module as inputs. Their values still come from `terraform.tfvars` and the defaults.

7. In the root `outputs.tf`, read the values from the module:

   ```hcl
   output "namespace" {
     description = "Namespace that holds the web app."
     value       = module.web.namespace
   }

   output "service_name" {
     description = "Name of the Service in front of the web Pods."
     value       = module.web.service_name
   }
   ```

8. Run `terraform plan` now. It fails with `Module not installed`. Terraform finds modules during `terraform init`, so run it:

   ```sh
   terraform init
   ```

   The output contains a new section:

   ```text
   Initializing modules...
   - web in modules/web-app
   ```

   Run `terraform init` again each time you add a `module` block or change its `source` or `version`. You do not need it after you edit files inside a local module.

9. Run `terraform validate`. If code from earlier lessons still points to something you deleted, it shows an error with the file and line, such as `Reference to undeclared resource`. Replace `kubernetes_namespace_v1.demo.metadata[0].name` with `module.web.namespace`. If the error is about a deleted local, keep that local in the root `locals` block. Run `terraform validate` again until it passes.

10. Run `terraform plan`. A trimmed output:

    ```text
      # kubernetes_deployment_v1.web has moved to module.web.kubernetes_deployment_v1.this
      # kubernetes_namespace_v1.demo has moved to module.web.kubernetes_namespace_v1.this
      # kubernetes_service_v1.web has moved to module.web.kubernetes_service_v1.this

    Plan: 0 to add, 0 to change, 0 to destroy.
    ```

    If you see `~` or `-/+`, the module code differs from your old code. Make them match until the plan shows only moves. Then run `terraform apply` and confirm with `yes`. Nothing changes in the cluster; only the addresses in state change.

## Call the module twice

Add a second app with one more call in the root `main.tf`:

```hcl
module "admin" {
  source = "./modules/web-app"

  name      = "admin"
  namespace = "admin"
  image_tag = var.image_tag
}
```

`replicas` has a default in the module, so this call can skip it. Run `terraform init` for the new call, then `terraform plan`. The plan shows `Plan: 3 to add, 0 to change, 0 to destroy.` Apply it and check the result:

```sh
kubectl get deployments,services -n admin
terraform state list
```

Among other lines, `terraform state list` shows both calls:

```text
module.admin.kubernetes_deployment_v1.this
module.admin.kubernetes_namespace_v1.this
module.admin.kubernetes_service_v1.this
module.web.kubernetes_deployment_v1.this
module.web.kubernetes_namespace_v1.this
module.web.kubernetes_service_v1.this
```

This is the end state of the project for this lesson, and later lessons build on it. The root `main.tf` has two module calls:

- `module "web"` manages the namespace `demo` with the `web` Deployment and Service. Other code reads the namespace as `module.web.namespace`.
- `module "admin"` manages the namespace `admin` with the `admin` Deployment and Service.

Keep the three `moved` blocks in `main.tf`. Other copies of the state, such as staging and production in a team, still need them. Remove a `moved` block only after every state that uses the code has been applied with it.

## Many calls with `for_each`

A `module` block accepts `count` and `for_each`, like a resource. This form is common in team code. This section is for reading only, so do not change your project:

```hcl
module "app" {
  source = "./modules/web-app"

  for_each = {
    web   = "demo"
    admin = "admin"
  }

  name      = each.key
  namespace = each.value
  image_tag = var.image_tag
}
```

Each key creates one call, with addresses such as `module.app["web"].kubernetes_deployment_v1.this`. You read its outputs with the key: `module.app["web"].namespace`.

Suppose a team replaces separate `web` and `admin` calls with this one block. Without help, the plan would destroy both apps and create them again. A `moved` block can move a whole module call at once, so the pull request adds one for each call:

```hcl
moved {
  from = module.web
  to   = module.app["web"]
}

moved {
  from = module.admin
  to   = module.app["admin"]
}
```

Every reference must change too: `module.web.namespace` becomes `module.app["web"].namespace`. With the `moved` blocks in place, the plan shows only moves.

## Modules from other places

The `source` argument also accepts remote addresses. A module from the Terraform Registry has an address in the form `<NAMESPACE>/<NAME>/<PROVIDER>` and a `version`:

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "6.0.1"
}
```

This example is for AWS, so you only read it here. `version` works only for registry modules.

Teams often keep shared modules in a Git repository. A Git source selects a tag, a branch, or a commit with `ref`. A double slash `//` selects a subdirectory:

```hcl
module "web" {
  source = "git::https://github.com/example-org/terraform-modules.git//web-app?ref=v1.4.0"
}
```

`terraform init` downloads remote modules into `.terraform/modules`. It does not update modules that are already installed. To get newer code within the allowed versions, run `terraform init -upgrade`. In a review, check that every remote module is pinned to a version or a tag.

## Official resources

- [Modules overview](https://developer.hashicorp.com/terraform/language/modules)
- [module block reference](https://developer.hashicorp.com/terraform/language/block/module)
- [Module sources](https://developer.hashicorp.com/terraform/language/modules/sources)
- [Providers within modules](https://developer.hashicorp.com/terraform/language/modules/develop/providers)
- [Refactoring with moved blocks](https://developer.hashicorp.com/terraform/language/modules/develop/refactoring)
