---
slug: terraform/first-project
title: Первый проект
description: Установите Terraform на macOS, опишите namespace и Deployment с nginx и пройдите цикл init, plan, apply и destroy на локальном кластере Kubernetes.
---

В этом уроке вы соберёте небольшой Terraform-проект. Он описывает namespace и Deployment с nginx — те же объекты, которые вы положили бы в два YAML-манифеста. Затем вы пройдёте весь рабочий цикл Terraform: `init`, `plan`, `apply` и `destroy`.

Понадобится запущенный локальный кластер Kubernetes, например kind или Docker Desktop. Текущий контекст `kubectl` должен указывать именно на него: Terraform читает тот же файл `~/.kube/config`, что и `kubectl`.

## Установите Terraform

Для macOS HashiCorp публикует Terraform через собственный tap Homebrew. Подключите tap и установите формулу из него:

```sh
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```

Убедитесь, что команда `terraform` работает:

```sh
terraform version
```

```text
Terraform v1.16.5
on darwin_arm64
```

Версия и платформа у вас могут отличаться.

## Проверьте контекст кластера

Terraform меняет тот кластер, на который указывает текущий контекст. Прежде чем двигаться дальше, убедитесь, что это локальный кластер:

```sh
kubectl config current-context
```

```text
kind-kind
```

В Docker Desktop контекст называется `docker-desktop`. Если здесь виден общий или production-кластер, сначала переключитесь на локальный контекст.

## Создайте проект

Terraform-проект — это каталог с файлами `.tf`. Terraform читает все файлы `.tf` в каталоге и собирает из них одну конфигурацию. Деление на файлы нужно только людям — примерно как папка с манифестами, которую вы передаёте в `kubectl apply -f`.

Создайте каталог проекта:

```sh
mkdir terraform-course
cd terraform-course
```

Создайте `terraform.tf`. В нём перечислены провайдеры, которые нужны проекту:

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

`source` — адрес провайдера в Terraform Registry. `version` — это `version constraint`, ограничение версии. Значение `~> 3.0` допускает любой выпуск 3.x, но не 4.0. Новая мажорная версия может сломать ваш код, поэтому такое ограничение удерживает обновления в пределах одной мажорной версии.

## Опишите namespace и Deployment

Создайте `main.tf`:

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

В файле три блока:

- Блок `provider` настраивает провайдер Kubernetes. Если указан только `config_path`, провайдер берёт текущий контекст из этого файла — так же, как `kubectl`.
- Блок `resource` описывает один объект, которым управляет Terraform. Первая метка — тип ресурса, `kubernetes_namespace_v1`. Вторая метка, `demo`, — имя, которое существует только в вашем коде. Вместе они образуют `resource address`, адрес ресурса: `kubernetes_namespace_v1.demo`.
- Блок Deployment повторяет форму манифеста Deployment: `metadata`, `spec`, `selector`, `template` и `container`. Имена полей записываются в snake_case, поэтому `matchLabels` превращается в `match_labels`.

Суффикс `_v1` соответствует версии API Kubernetes. В существующем коде вам могут встретиться старые имена без него, например `kubernetes_deployment`. Провайдер помечает их как устаревшие.

Посмотрите на строку `namespace` в Deployment. Текст `"demo"` в ней не повторяется: это `reference`, ссылка на ресурс namespace. Из этой ссылки Terraform узнаёт, что Deployment зависит от namespace, и потому создаёт namespace первым. Подробно этот синтаксис разбирается в следующем уроке.

## Инициализируйте проект

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

`terraform init` подготавливает каталог проекта. Команда читает `required_providers`, выбирает самую новую версию, которая подходит под ограничение, и скачивает провайдер. Запускайте её один раз в новом проекте и повторно — после того как добавили провайдер или модуль.

Она создаёт две вещи:

- `.terraform/` — локальный кеш со скачанным бинарным файлом провайдера. Не добавляйте его в Git: `terraform init` всегда может собрать его заново.
- `.terraform.lock.hcl` — `dependency lock file`, файл блокировки зависимостей. В нём записаны точная версия провайдера и её контрольные суммы, как в `package-lock.json` в проекте на Node.js. Этот файл стоит закоммитить, чтобы коллеги и CI пользовались той же сборкой провайдера.

```hcl
provider "registry.terraform.io/hashicorp/kubernetes" {
  version     = "3.3.0"
  constraints = "~> 3.0"
  hashes = [
```

## Прочитайте plan

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

`plan` — это список изменений, которые Terraform внёс бы, чтобы привести кластер в соответствие с вашим кодом. Построение plan ничего в кластере не меняет. Можно считать его аналогом `kubectl diff` для всего проекта. Проект новый, и Terraform пока ничем не управляет, поэтому каждый объект предстоит создать.

У некоторых значений стоит `(known after apply)`. Их задаёт сам кластер при создании объекта — как `uid` и `resourceVersion` в Kubernetes. Другие значения, например `progress_deadline_seconds = 600`, — это значения по умолчанию, которых вы не писали. Это те же умолчания, которые подставил бы API-сервер.

Каждое изменение начинается с символа:

| Символ | Действие | Что происходит в кластере |
| --- | --- | --- |
| `+` | create | Terraform создаёт новый объект. |
| `~` | update in-place | Terraform меняет существующий объект — как патч от `kubectl apply`. |
| `-` | destroy | Terraform удаляет объект. |
| `-/+` | destroy and then create replacement | Terraform удаляет объект и создаёт его заново, потому что поле нельзя изменить на месте. |

Первым делом читайте итоговую строку: `Plan: 2 to add, 0 to change, 0 to destroy.` На код-ревью неожиданное число здесь, особенно в `to destroy`, — повод остановиться и присмотреться внимательнее.

## Выполните apply

```sh
terraform apply
```

Команда `apply` строит свежий plan, ещё раз показывает его и просит подтверждения. Продолжить можно только точным словом `yes`.

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

Время выполнения на вашей машине будет другим. Обратите внимание на две вещи:

- Namespace создаётся раньше Deployment — благодаря ссылке.
- Terraform ждёт, пока поды Deployment станут готовы. `kubectl apply` возвращает управление, как только API-сервер принял объект, а провайдер Kubernetes дожидается завершения rollout — как `kubectl rollout status`.

Кроме того, Terraform записал новый файл — `terraform.tfstate`. Это `state`: учёт объектов, которыми управляет Terraform, и их идентификаторов. Не редактируйте его вручную. Подробно state разбирается в уроке 5.

## Проверьте кластер

```sh
kubectl get deployment web -n demo
```

```text
NAME   READY   UP-TO-DATE   AVAILABLE   AGE
web    2/2     2            2           40s
```

Это обычные объекты Kubernetes. Terraform не работает внутри кластера, и никакой контроллер не следит за вашими файлами `.tf`. Пока вы снова не запустите Terraform, ничего не произойдёт.

## Прочитайте update и replacement

Замените в `main.tf` строку `replicas = 2` на `replicas = 3` и выполните `terraform plan`:

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

Строки без символа — это контекст. Стрелка показывает старое и новое значение. Атрибуты, которые не меняются, Terraform скрывает.

Теперь верните `replicas` значение `2`. Затем в ресурсе namespace замените `name` с `"demo"` на `"demo2"`. Переименовать объект Kubernetes не умеет, поэтому plan выглядит иначе:

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

Комментарий `# forces replacement` отмечает поле, из-за которого объект приходится пересоздавать. Deployment тоже пересоздаётся: его namespace берётся из ссылки. Не применяйте этот plan — верните имя `"demo"`.

## Удалите объекты

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

`terraform destroy` удаляет все объекты из state в порядке, обратном зависимостям: сначала Deployment, затем namespace. Удаляются только объекты, которыми управляет Terraform, а остальной кластер остаётся нетронутым. Файлы `.tf` никуда не деваются, так что следующий `terraform apply` создаст те же объекты заново.

Убедитесь, что namespace исчез:

```sh
kubectl get namespace demo
```

```text
Error from server (NotFound): namespaces "demo" not found
```
