---
slug: terraform/variables-and-outputs
title: Variables and Outputs
description: Make a configuration flexible with input variables, name repeated values with locals, and read results with outputs and terraform output.
tags:
  - terraform
  - kubernetes
  - variables
  - outputs
---

So far, every value in the `terraform-course` project is written directly in the code. The namespace is always `demo`, and the image tag is fixed. Real team code is different: the same configuration runs with different values in different places.

If you know Helm, the idea is familiar. A chart declares its inputs in `values.yaml`, and you override them with `-f` or `--set`. Terraform has three related tools:

- Input variables are the inputs, like chart values.
- Locals are named helper values inside the configuration, like a labels helper in `_helpers.tpl`.
- Outputs are the results that Terraform shows after `apply`, so people and scripts can read them.

## Input variables

An `input variable` is a parameter of a configuration. You declare it with a `variable` block:

```hcl
variable "replicas" {
  type        = number
  default     = 2
  description = "Number of nginx Pods in the web Deployment."

  validation {
    condition     = var.replicas >= 1 && var.replicas <= 5
    error_message = "The replicas value must be between 1 and 5."
  }
}
```

The label after `variable` is its name. Inside the configuration, you read it as `var.replicas`. All arguments are optional:

- `type` limits the accepted values, for example `string`, `number`, `bool`, `list(string)`, or `map(string)`. Terraform rejects a value of the wrong type before it plans anything.
- `default` makes the variable optional. A variable without a default is required.
- `description` explains the variable to the next reader. Always add one.
- `validation` adds your own rule. The `condition` must be true for the value; otherwise Terraform stops and shows `error_message`. A variable can have several `validation` blocks.
- `sensitive = true` hides the value in `plan` and `apply` output. Use it for passwords and tokens. The value is still stored in state in plain text, so it is not encryption.

## Set variable values

Terraform takes values for variables from several places:

- `terraform.tfvars` and files that end in `.auto.tfvars` are loaded automatically. They contain plain assignments, such as `image_tag = "1.27"`.
- `-var-file=staging.tfvars` loads any other file, like `helm install -f`.
- `-var 'replicas=3'` sets one value on the command line, like `helm install --set`.
- An environment variable with the `TF_VAR_` prefix sets the variable with the rest of its name. For example, `TF_VAR_replicas=3` sets `replicas`.

When several sources set the same variable, the later source in this list wins:

1. The `default` in the `variable` block.
2. `TF_VAR_` environment variables.
3. `terraform.tfvars`, then `terraform.tfvars.json`.
4. `*.auto.tfvars` and `*.auto.tfvars.json` files, in alphabetical order of their names.
5. `-var` and `-var-file` options, in the order you write them on the command line.

If a required variable has no value from any source, Terraform asks for it interactively. In CI, where nobody can type an answer, the run fails instead.

Teams often commit a `terraform.tfvars` with safe values and pass secrets through `TF_VAR_` variables in CI. When you review a change, check both the variable declaration and the place that sets its value.

## Locals

A `local value`, or local, gives a name to an expression that you use more than once. Declare locals in a `locals` block and read them as `local.<name>`. Note the singular `local`:

```hcl
locals {
  common_labels = {
    "app.kubernetes.io/managed-by" = "terraform"
    "app.kubernetes.io/part-of"    = "terraform-course"
  }

  web_labels = merge(local.common_labels, { app = "web" })
  image      = "nginx:${var.image_tag}"
}
```

The built-in `merge` function combines maps, so `web_labels` contains the common labels and `app = "web"`.

A local is not an input. Nobody can override it with `-var` or a `.tfvars` file. Use a variable when the value should change between runs, and a local when the value is computed inside the configuration. Do not create a local for a value that you use only once: the reader then has to jump to another place to find it.

## Outputs

An `output value` publishes a result of the configuration:

```hcl
output "namespace" {
  description = "Namespace that holds the web app."
  value       = kubernetes_namespace_v1.demo.metadata[0].name
}
```

The `value` can be any expression. Terraform prints all outputs at the end of `apply` and saves them in state. Outputs work a little like the `status` of a Kubernetes object: they report facts after the change.

To read outputs later, run `terraform output`. It reads values from the saved state and does not contact the cluster:

- `terraform output` prints all outputs.
- `terraform output -raw namespace` prints one plain value without quotes. It is the right form for shell scripts. It works only for strings, numbers, and booleans.
- `terraform output -json` prints all outputs as JSON, including lists and maps, for tools like `jq`.

An output can also be `sensitive = true`. Terraform refuses to plan if an output uses a sensitive value but is not marked as sensitive itself. A sensitive output shows `<sensitive>` in the normal list, but `-raw` and `-json` print the real value.

## Practice

Make the `terraform-course` project configurable. Your cluster from the earlier lessons must be running.

1. In the project directory, create `variables.tf`:

   ```hcl
   variable "namespace" {
     type        = string
     default     = "demo"
     description = "Name of the namespace for the web app."
   }

   variable "replicas" {
     type        = number
     default     = 2
     description = "Number of nginx Pods in the web Deployment."

     validation {
       condition     = var.replicas >= 1 && var.replicas <= 5
       error_message = "The replicas value must be between 1 and 5."
     }
   }

   variable "image_tag" {
     type        = string
     description = "Tag of the nginx image, such as 1.27."
   }
   ```

   `image_tag` has no default, so it is required.

2. In `main.tf`, keep the `provider` block. Replace the namespace, Deployment, and Service resources with this code:

   ```hcl
   locals {
     common_labels = {
       "app.kubernetes.io/managed-by" = "terraform"
       "app.kubernetes.io/part-of"    = "terraform-course"
     }

     web_labels = merge(local.common_labels, { app = "web" })
     image      = "nginx:${var.image_tag}"
   }

   resource "kubernetes_namespace_v1" "demo" {
     metadata {
       name   = var.namespace
       labels = local.common_labels
     }
   }

   resource "kubernetes_deployment_v1" "web" {
     metadata {
       name      = "web"
       namespace = kubernetes_namespace_v1.demo.metadata[0].name
       labels    = local.web_labels
     }

     spec {
       replicas = var.replicas

       selector {
         match_labels = {
           app = "web"
         }
       }

       template {
         metadata {
           labels = local.web_labels
         }

         spec {
           container {
             name  = "nginx"
             image = local.image

             port {
               container_port = 80
             }
           }
         }
       }
     }
   }

   resource "kubernetes_service_v1" "web" {
     metadata {
       name      = "web"
       namespace = kubernetes_namespace_v1.demo.metadata[0].name
       labels    = local.web_labels
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

   The resource address stays `kubernetes_namespace_v1.demo`. Only the real namespace name now comes from a variable. The selector stays `app = "web"`, because a Deployment selector cannot change after creation.

3. Create `outputs.tf`:

   ```hcl
   output "namespace" {
     description = "Namespace that holds the web app."
     value       = kubernetes_namespace_v1.demo.metadata[0].name
   }

   output "service_name" {
     description = "Name of the Service in front of the web Pods."
     value       = kubernetes_service_v1.web.metadata[0].name
   }
   ```

4. Create `terraform.tfvars` with the required value:

   ```hcl
   image_tag = "1.27"
   ```

5. Run `terraform plan`. Expect only in-place updates, marked with `~`, such as new labels. Nothing should be destroyed. If the plan replaces the namespace, check that the `namespace` default is `demo`. Then run `terraform apply` and confirm with `yes`. At the end, Terraform prints the outputs:

   ```text
   Outputs:

   namespace = "demo"
   service_name = "web"
   ```

6. Use an output in a shell command:

   ```sh
   kubectl get deployment web -n "$(terraform output -raw namespace)"
   terraform output -json
   ```

7. Check the precedence rules without applying anything:

   ```sh
   TF_VAR_replicas=3 terraform plan
   terraform plan -var 'replicas=9'
   ```

   The first plan changes `replicas` from `"2"` to `"3"`. The Kubernetes provider stores `replicas` as a string, and Terraform converts your number automatically. The second command fails with `The replicas value must be between 1 and 5.` before Terraform plans any change.

## Official resources

- [Input variables](https://developer.hashicorp.com/terraform/language/values/variables)
- [Local values](https://developer.hashicorp.com/terraform/language/values/locals)
- [Output values](https://developer.hashicorp.com/terraform/language/values/outputs)
- [terraform output command](https://developer.hashicorp.com/terraform/cli/commands/output)
