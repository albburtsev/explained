---
slug: terraform/state-and-drift
title: State and Drift
description: Learn what terraform.tfstate stores, how plan detects changes made with kubectl, and how to inspect and refresh state safely.
tags:
  - terraform
  - state
  - drift
  - kubernetes
---

In earlier lessons you ran `plan` and `apply` many times. Each time, Terraform knew which Deployment in the cluster was its `web`. It knows this from the state. This lesson shows what state holds, what happens when someone changes a managed object by hand, and how to look at state without breaking it.

## Why Terraform needs state

After your first `apply`, a file named `terraform.tfstate` appeared in the `terraform-course` directory. This is the `state`: a JSON record of every object that Terraform manages in this project.

Kubernetes does not need such a file. Its API server stores both the objects you asked for and their current status. Terraform works with many different APIs, and most of them have no place for Terraform's own notes. So Terraform keeps a separate record. It uses the record for three things:

- **Mapping.** State links each resource address in your code, such as `kubernetes_deployment_v1.web`, to the ID of a real object, such as `demo/web`. Without this link, Terraform could not tell which objects belong to it. It also would not know what to delete when you remove a block from the code.
- **Metadata.** State remembers the dependencies between resources. When you remove resources from the code, Terraform still knows the safe order to delete them.
- **Performance.** State keeps a copy of the attributes of every object. Terraform can use this copy instead of asking the API about every object, which matters in very large projects.

`kubectl apply` keeps a similar memory: it saves the last applied manifest in the `kubectl.kubernetes.io/last-applied-configuration` annotation on the object. Terraform keeps its memory outside the objects, in one file.

Open `terraform.tfstate` in an editor and look, but do not change anything. A trimmed part of it looks like this:

```json
{
  "version": 4,
  "serial": 6,
  "resources": [
    {
      "mode": "managed",
      "type": "kubernetes_deployment_v1",
      "name": "web",
      "instances": [
        {
          "attributes": {
            "id": "demo/web"
          }
        }
      ]
    }
  ]
}
```

The `type` and `name` together give the address `kubernetes_deployment_v1.web`. The `id` points to the real Deployment `web` in the namespace `demo`. The `serial` number grows each time Terraform writes a new version of the state.

## Three views of one object

Every managed object now exists in three places:

| View | Where it lives | What it tells you |
| --- | --- | --- |
| Configuration | Your `.tf` files | What you want |
| State | `terraform.tfstate` | What Terraform saw at its last run |
| Real world | Objects in the cluster | What exists right now |

Usually all three agree. `Drift` is the case when the real world no longer matches what Terraform recorded. It happens when someone changes a managed object outside Terraform: with `kubectl`, with a dashboard, or with another tool.

## How plan finds drift

Every `plan` starts with a `refresh` step. Terraform asks the provider to read each object in state from the real world. The `Refreshing state...` lines in the output are this step. Then Terraform compares your configuration with this fresh picture and proposes the changes that make the real world match the code.

A normal `plan` does not save the refreshed data to the state file. Only `apply` writes a new state.

## Create drift on purpose

The examples below assume that `var.replicas` is `2`. If your value is different, your numbers will be different too.

Change the number of replicas behind Terraform's back:

```sh
kubectl scale deployment/web --replicas=5 -n demo
kubectl get deployment web -n demo
```

After a few seconds, the Deployment has 5 ready Pods. For Kubernetes, 5 is now the desired state, and its controller is happy. `kubectl edit deployment web -n demo` would have the same effect.

Now ask Terraform:

```sh
terraform plan
```

Terraform refreshes the Deployment, sees 5 replicas, compares that with the code, and plans to go back. A trimmed excerpt of the output:

```text
  # kubernetes_deployment_v1.web will be updated in-place
  ~ resource "kubernetes_deployment_v1" "web" {
      ~ spec {
          ~ replicas = "5" -> "2"
        }
    }

Plan: 0 to add, 1 to change, 0 to destroy.
```

The provider stores `replicas` as a string, so the values appear in quotes. Run `terraform apply` and confirm with `yes` to return the Deployment to 2 replicas.

This is the main difference from Kubernetes. A Deployment controller watches its objects all the time and fixes a missing Pod within seconds. Terraform is not a controller. It watches nothing and reconciles only when someone runs `plan` or `apply`. Between runs, the cluster can differ from the code for hours or weeks. This is why teams make changes through Terraform code. It is also why an unexpected change in a plan deserves a question during review.

## Accept a change instead of undoing it

Sometimes a manual change was right, for example a quick fix during an incident. You may want Terraform to record it instead of undoing it. Create the drift again:

```sh
kubectl scale deployment/web --replicas=5 -n demo
terraform plan -refresh-only
```

A `refresh-only` plan does not propose changes to the cluster. It only shows what changed outside Terraform and offers to update the state. A trimmed excerpt:

```text
Note: Objects have changed outside of Terraform

Terraform detected the following changes made outside of Terraform since the
last "terraform apply":

  # kubernetes_deployment_v1.web has changed
  ~ resource "kubernetes_deployment_v1" "web" {
      ~ spec {
          ~ replicas = "2" -> "5"
        }
    }

This is a refresh-only plan, so Terraform will not take any actions to undo
these. If you were expecting these changes then you can apply this plan to
record the updated values in the Terraform state without changing any remote
objects.
```

To save the new values, run:

```sh
terraform apply -refresh-only
```

Terraform asks for confirmation, writes 5 to the state, and does not touch the cluster. Now run a normal plan:

```sh
terraform plan
```

It still proposes `"5" -> "2"`, because the code still says 2. A refresh-only apply updates Terraform's memory, not your intent. To keep 5 replicas, change the value of `replicas` in the code. For this course, run `terraform apply` to return to 2.

## Inspect state safely

Do not read the JSON file to answer everyday questions. These commands only read state and never change it:

```sh
terraform state list
terraform state show kubernetes_deployment_v1.web
terraform show
```

- `terraform state list` prints the address of every resource in state, such as `kubernetes_deployment_v1.web`, `kubernetes_namespace_v1.demo`, and `kubernetes_service_v1.web`.
- `terraform state show <address>` prints all recorded attributes of one resource in HCL-like form.
- `terraform show` prints the whole latest state in the same readable form.

These commands do not refresh. They show what Terraform recorded at its last run, which can differ from the cluster. To compare with the real world, run `terraform plan`.

## Keep state secret and untouched

State needs the same care as a password file:

- **It contains secrets in plain text.** If the configuration creates a `kubernetes_secret_v1`, its data is stored in state. Marking a value `sensitive` hides it in the CLI output, but not in state. `terraform show -json` prints sensitive values in plain text too.
- **Never commit it.** If `terraform-course` is a Git repository, make sure its `.gitignore` contains these lines:

  ```gitignore
  .terraform/
  *.tfstate
  *.tfstate.*
  ```

  The second pattern also covers `terraform.tfstate.backup`, the previous version that Terraform keeps next to the state.

- **Never edit it by hand.** A wrong ID or a broken file can make Terraform lose track of an object or plan to destroy it. Change state only through Terraform commands.

## Commands that change state

You will rarely need these, but you may see them in your team's notes:

- `terraform state mv` moves an object to a new address, for example after you rename a resource block. Terraform then keeps the object instead of destroying and recreating it.
- `terraform state rm` makes Terraform forget an object without deleting it. The object stays in the cluster, but Terraform no longer manages it.

Modern code often uses `moved`, `removed`, and `import` blocks instead. They describe the same operations in configuration, so the change shows up in a normal plan and goes through review. You do not need them in this course.

## State in a team

A local `terraform.tfstate` works for one person on one laptop. A team needs one shared state and a lock, so two people cannot run `apply` at the same time. The lesson on teamwork covers remote state and locking.
