---
slug: terraform/teamwork
title: Teamwork
description: Move state into the cluster with the kubernetes backend, see state locking in action, and review a saved plan the way a team does in a pull request.
tags:
  - terraform
  - remote-state
  - state-locking
  - code-review
  - ci
---

So far, your state has lived in `terraform.tfstate` next to the code. That works while you are the only person who runs Terraform. In a team, it breaks quickly. In this lesson, you move the state of `terraform-course` into the cluster, see how Terraform stops two runs from colliding, and learn how a team reviews a plan before anyone applies it.

## Why local state does not work for a team

Imagine that you and a colleague both work on the same configuration, each with your own `terraform.tfstate`:

- Your colleague's state does not know about the objects you created. Their plan tries to create them again, or misses changes you already applied.
- Two people can run `terraform apply` at the same time. Both read the same old state, both change real objects, and the last write wins.
- You cannot fix this by committing the state to Git. State often holds secrets in plain text, and Git does nothing to stop two applies at once.

Kubernetes solves the same problem with one shared store. Every controller and every `kubectl` user talks to the same API server and the same etcd. Nobody keeps a private copy of the cluster state. Terraform needs the same thing: one copy of the state in a shared place, and a way to let only one run change it at a time.

## Backends and remote state

A `backend` decides where Terraform keeps state. The default backend is `local`, which writes the `terraform.tfstate` file you have used so far. Other backends store the state in a shared place. This is called `remote state`.

Teams usually choose a backend that matches their platform: `s3` on AWS, `gcs` on Google Cloud, or `azurerm` on Azure. Another option is HCP Terraform, which you connect with a `cloud` block instead of a `backend` block. The platform team usually sets this up once. As a developer, you mostly read the backend block and run the same commands as before.

You configure a backend inside the `terraform` block. Two rules matter when you read one:

- A configuration has at most one backend.
- A backend block cannot use variables, locals, or data sources. Its values are written out directly.

## Move the state into the cluster

You do not need a cloud account to try remote state. Terraform has a built-in `kubernetes` backend. It stores the state in a Kubernetes Secret and uses a Lease object as the lock.

Open `terraform.tf` and add a `backend` block to the `terraform` block:

```hcl
terraform {
  # required_providers { ... } stays as it is

  backend "kubernetes" {
    secret_suffix = "terraform-course"
    config_path   = "~/.kube/config"
  }
}
```

- `secret_suffix` is the only required argument. Terraform names the Secret `tfstate-<workspace>-<secret_suffix>`. Your workspace is called `default`, so the Secret becomes `tfstate-default-terraform-course`.
- `config_path` points to your kubeconfig, like in the provider block. The backend uses its current context, so it talks to the same local cluster.
- The `namespace` argument is not set, so the Secret goes to the `default` namespace. Do not store state in `demo`: that namespace is managed by this configuration, and `terraform destroy` would delete the state together with it.

Terraform must set up the new backend before any other command works. Run `init` and ask it to copy the existing state:

```sh
terraform init -migrate-state
```

Terraform finds the local state and asks before it copies:

```text
Initializing the backend...
Do you want to copy existing state to the new backend?
  Pre-existing state was found while migrating the previous "local" backend to the
  newly configured "kubernetes" backend. No existing state was found in the newly
  configured "kubernetes" backend. Do you want to copy this state to the new
  "kubernetes" backend? Enter "yes" to copy and "no" to start with an empty state.

  Enter a value: yes


Successfully configured the backend "kubernetes"! Terraform will automatically
use this backend unless the backend configuration changes.
```

Answer `yes`. Now check that the state is in the cluster:

```sh
kubectl get secrets -n default -l tfstate=true
terraform state list
terraform plan
```

You see one Secret, the same resource list as before, and `No changes.` in the plan. From now on, Terraform reads and writes state only in the cluster. Delete the old local copies, so nobody uses them by mistake:

```sh
rm -f terraform.tfstate terraform.tfstate.backup
```

The state is now as safe as the Secret. The backend compresses it with gzip, but it does not encrypt it. Anyone who can read Secrets in that namespace can read the whole state:

```sh
kubectl get secret tfstate-default-terraform-course -n default \
  -o jsonpath='{.data.tfstate}' | base64 -d | gunzip | head -n 5
```

The same is true for every backend. Teams protect state with access rules on the bucket, the storage account, or the namespace.

## See state locking

With `state locking`, only one Terraform run can write the state at a time. If the backend supports it, Terraform takes the lock automatically before any operation that could write state. You do not see a message when this happens.

The `kubernetes` backend locks with a Lease named `lock-<secret name>`. Kubernetes controllers use Lease objects in the same way for leader election: whoever holds the Lease does the work.

You can watch it. Open two terminals in `terraform-course`. In the first one, start the console and leave it open, because it holds the lock while it runs:

```sh
terraform console
```

In the second terminal, look at the Lease and then try to plan:

```sh
kubectl get leases -n default
terraform plan
```

The `HOLDER` column of `lock-tfstate-default-terraform-course` shows a lock ID. The plan stops at once:

```text
│ Error: Error acquiring the state lock
│
│ Error message: the state is already locked by another terraform client
│ Lock Info:
│   ID:        3f6c2a1e-8d7b-4c59-9a0e-2b4f7d1c6e85
```

The full message also shows who holds the lock and since when. Type `exit` in the first terminal, and the plan works again. In a real team, the other run is usually a colleague or a CI job. Wait for it to finish, or add `-lock-timeout=60s` to make Terraform wait for up to a minute.

This Lease has no expiry time. If a run crashes, the lock can stay behind. `terraform force-unlock LOCK_ID` removes it. Use it only for your own lock after a failed run. If you remove someone else's lock, two runs can write the state at the same time.

## What goes into Git

Some files in the project directory belong in Git, and some never do. The lesson on state already added the first three lines to `.gitignore`. Add `tfplan`, so the file looks like this:

```text
.terraform/
*.tfstate
*.tfstate.*
tfplan
```

- `.terraform/` holds downloaded providers, modules, and the backend settings. `terraform init` recreates it.
- `*.tfstate` and `*.tfstate.*` catch local state and its backups. With a remote backend, these files should not appear. The rule still protects you if someone runs Terraform without the backend.
- `tfplan` is a saved plan file, which you create below. It can contain secrets in plain text.

Do commit `.terraform.lock.hcl`. This `dependency lock file` records the exact provider versions and checksums that `init` selected. With it in Git, CI and every colleague use the same provider builds. A change to it shows up in the pull request, so the team reviews it like any other change.

## The pull request flow

Teams rarely run `terraform apply` from a laptop. The usual flow looks like a code review for `kubectl diff`:

1. You change `.tf` files on a branch and open a pull request.
2. CI checks the code and runs a plan:
   - `terraform fmt -check -recursive` fails if any file, including files in module directories, is not formatted. Run `terraform fmt -recursive` locally to fix it.
   - `terraform validate` checks syntax, references, and types without touching the cluster.
   - `terraform plan` compares the code with the remote state and the real objects.
3. CI posts the plan output as a comment in the pull request.
4. Reviewers read the code and the plan. The plan shows what will really happen.
5. After approval, CI applies the change. It uses the same remote state and the same lock as everyone else.

Tools differ, but the idea stays the same. Nobody applies a change that the team has not seen as a plan.

### Apply exactly what was reviewed

A plain `terraform apply` creates a new plan. If the state or the cluster changed after the review, that new plan can differ from the one in the pull request. A `saved plan` fixes this. You write the plan to a file and later apply that file.

Try the whole check locally. Make a small change first: add `replicas = 3` to `terraform.tfvars`. Then run:

```sh
terraform fmt -check -recursive
terraform validate
terraform plan -out=tfplan
```

`fmt -check` prints nothing when all files are formatted. `validate` prints `Success! The configuration is valid.` The plan ends with a hint:

```text
Saved the plan to: tfplan

To perform exactly these actions, run the following command to apply:
    terraform apply "tfplan"
```

`terraform show tfplan` prints the saved plan again. CI uses this to post the plan. Now apply the file:

```sh
terraform apply tfplan
```

Terraform does not ask for confirmation. Passing the plan file counts as the approval, because the plan was already reviewed. Run the same command again:

```sh
terraform apply tfplan
```

```text
│ Error: Saved plan is stale
│
│ The given plan file can no longer be applied because the state was changed by another operation after the plan was created.
```

A saved plan is valid only for the state it was made from. If anything changed the state after the review, Terraform refuses to apply the old plan, and you need a new plan and a new review.

## How to review a plan

Each resource in a plan starts with a marker:

| Marker | Meaning |
| --- | --- |
| `+` | Create |
| `~` | Update in place |
| `-` | Destroy |
| `-/+` | Destroy, then create a replacement |
| `+/-` | Create a replacement, then destroy the old object |
| `<=` | Read a data source |

Updates in place are usually safe. Replacements need attention. A replacement happens when you change an argument that the provider cannot update, such as the name of a Kubernetes object. Suppose someone sets `namespace = "demo-app"` in `terraform.tfvars`. Here is the first entry of the plan, shortened:

```text
  # module.web.kubernetes_namespace_v1.this must be replaced
-/+ resource "kubernetes_namespace_v1" "this" {
      ~ id = "demo" -> (known after apply)

      ~ metadata {
          ~ name = "demo" -> "demo-app" # forces replacement
        }
    }
```

The code change is one line. The plan shows the real cost: Terraform deletes the `demo` namespace, and Kubernetes deletes every object inside it. Every resource that takes its namespace from the module is replaced too: the Deployment and the Service inside `module.web`, the ConfigMaps from the lesson on `count` and `for_each`, and the Helm release. Each of them has its own `must be replaced` entry, and the summary line counts all of them in `to destroy`. The app is down until the new objects are ready.

Read a plan in this order:

1. **The summary line.** Any number above zero in `to destroy` needs a reason you understand.
2. **Replacements.** Search for `must be replaced` and `-/+`. The `# forces replacement` comment shows which attribute causes it. Replacing a namespace, a PersistentVolumeClaim, or a database can lose data.
3. **Unexpected destroys.** Search for `will be destroyed`. A common cause is a renamed resource, a removed module, or a changed `for_each` key. Terraform sees a new address and destroys the object at the old one.
4. **Changes nobody made.** If the plan changes objects that the pull request does not touch, someone changed the cluster by hand, or another change was applied first. This is the drift you saw in the lesson on state.
5. **Sensitive values.** Values marked as sensitive appear as `(sensitive value)`. Check that no password or token is printed in clear text in the plan comment. The plan file and the state still hold them in plain text, so treat both as secrets.

You can now read, write, and review the Terraform code in your team's repository. The commands stay the same: `init`, `plan`, and `apply`. In a team, the state lives in a shared backend, a lock protects it, and a reviewed plan decides what changes.
