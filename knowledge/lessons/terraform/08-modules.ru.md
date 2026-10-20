---
slug: terraform/modules
title: Модули
description: Вынесите namespace, Deployment и Service в локальный модуль, вызовите его дважды, перенесите существующие ресурсы блоками moved и научитесь читать удалённые источники модулей.
---

Проект `terraform-course` описывает одно приложение: namespace, Deployment и Service. Для второго приложения пришлось бы повторить те же три блока с другими именами. Копирование сработает, но тогда каждое исправление придётся вносить в двух местах. В Terraform эту задачу решают модули.

Тем, кто знаком с Helm, идея уже известна. Чарт прячет несколько объектов Kubernetes за небольшим набором values. Модуль точно так же прячет несколько ресурсов Terraform за небольшим набором входных переменных. Чарт устанавливают много раз с разными values, а модуль вызывают много раз с разными входными значениями.

## Корневой и дочерние модули

`Модуль` (module) — это каталог с файлами `.tf`. Terraform читает все файлы каталога вместе, так что имена файлов нужны только людям.

С модулем вы работаете с первого урока. Каталог, в котором вы запускаете `terraform plan`, — это `корневой модуль` (root module). Модуль, который другой модуль вызывает блоком `module`, называется `дочерним модулем` (child module). Дочерний модуль может лежать в подкаталоге вашего проекта, в Terraform Registry или в Git-репозитории.

Дочерний модуль устроен так же, как ваш проект:

- `variables.tf` объявляет его входные параметры — как `values.yaml` в чарте.
- `main.tf` содержит его ресурсы — как шаблоны чарта.
- `outputs.tf` объявляет результаты, которые может прочитать вызывающий код.

Модуль — закрытая коробка. Вызывающий код не видит его переменных, locals и ресурсов напрямую, ему доступны только outputs. Внутри модуля `var.name` означает собственную переменную модуля `name`, а не одноимённую переменную корневого модуля.

## Вызов модуля

Модуль вызывают блоком `module`:

```hcl
module "web" {
  source = "./modules/web-app"

  name      = "web"
  namespace = var.namespace
  replicas  = var.replicas
  image_tag = var.image_tag
}
```

- Метка `web` — локальное имя этого вызова. Один и тот же модуль можно вызвать много раз под разными именами.
- `source` указывает, где лежит код модуля. Локальный путь должен начинаться с `./` или `../`.
- Остальные аргументы задают входные переменные модуля. Переменная без значения по умолчанию обязательна — так же, как в корневом модуле.

Результат читают так: `module.<имя вызова>.<имя output>`, например `module.web.namespace`.

Собственный блок `provider` дочернему модулю не нужен: он пользуется провайдером `kubernetes`, который настроен в корневом модуле. Но объявить провайдер в `required_providers` модулю всё же стоит, чтобы Terraform знал, что `kubernetes` означает `hashicorp/kubernetes`. А в модуле, который вызывают другие модули, блоков `provider` быть не должно вовсе.

## Адреса внутри модуля

Адрес каждого ресурса внутри модуля начинается с имени вызова:

```text
module.web.kubernetes_deployment_v1.this
```

Читайте его слева направо: вызов модуля `web`, а в нём ресурс `kubernetes_deployment_v1.this`. Имя `this` повторяется в каждом вызове, поэтому `module.admin.kubernetes_deployment_v1.this` — уже другой объект. Если в модуле всего один ресурс данного типа, его принято называть `this`.

Такие адреса встретятся вам в выводе `plan`, в `terraform state list` и на ревью кода.

## Рефакторинг с `moved`

Terraform узнаёт объекты по адресам. Если перенести `kubernetes_deployment_v1.web` в модуль, адрес станет `module.web.kubernetes_deployment_v1.this`. Terraform увидит, что один ресурс исчез, а другой появился, и составит план, который удалит старые объекты и создаст новые. Для namespace это означает удаление всего, что в нём находится.

Блок `moved` сообщает Terraform, что у объекта изменился только адрес:

```hcl
moved {
  from = kubernetes_deployment_v1.web
  to   = module.web.kubernetes_deployment_v1.this
}
```

Terraform обновит адрес в state и сохранит реальный объект, а план покажет перемещение вместо удаления и создания. Блоки `moved` требуют Terraform v1.1+.

В командном коде это особенно важно. Если pull request переносит ресурсы в модуль, ищите в нём блоки `moved`. План рефакторинга должен содержать только перемещения и ни одного удаления.

## Практика

Кластер из прошлых уроков должен быть запущен. Работайте в каталоге `terraform-course`. Вы превратите namespace, Deployment и Service из `main.tf` в модуль, не пересоздавая их.

1. Создайте каталог модуля:

   ```sh
   mkdir -p modules/web-app
   ```

2. Создайте `modules/web-app/terraform.tf`:

   ```hcl
   terraform {
     required_providers {
       kubernetes = {
         source = "hashicorp/kubernetes"
       }
     }
   }
   ```

   Версию провайдера уже задаёт корневой модуль, поэтому здесь указан только источник.

3. Создайте `modules/web-app/variables.tf`:

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

4. Создайте `modules/web-app/main.tf`. Это код из `main.tf`, в котором имена заменены переменными:

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

5. Создайте `modules/web-app/outputs.tf`:

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

6. В корневом `main.tf` оставьте блок `provider`. Удалите блоки `kubernetes_namespace_v1.demo`, `kubernetes_deployment_v1.web` и `kubernetes_service_v1.web`. Теперь у модуля свои метки, поэтому уберите из блока `locals` значения `web_labels` и `image`. `common_labels` оставьте, если им ещё пользуются другие ресурсы. Затем добавьте вызов модуля и три блока `moved`:

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

   Переменные корневого модуля передаются в модуль как входные значения. Сами значения по-прежнему берутся из `terraform.tfvars` и значений по умолчанию.

7. В корневом `outputs.tf` читайте значения из модуля:

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

8. Попробуйте сейчас запустить `terraform plan` — он завершится ошибкой `Module not installed`. Модули Terraform находит во время `terraform init`, поэтому выполните:

   ```sh
   terraform init
   ```

   В выводе появится новый раздел:

   ```text
   Initializing modules...
   - web in modules/web-app
   ```

   Запускайте `terraform init` заново всякий раз, когда добавляете блок `module` или меняете его `source` или `version`. После правок в файлах локального модуля этого делать не нужно.

9. Выполните `terraform validate`. Если код из прошлых уроков всё ещё ссылается на что-то удалённое, команда покажет ошибку с указанием файла и строки, например `Reference to undeclared resource`. Замените `kubernetes_namespace_v1.demo.metadata[0].name` на `module.web.namespace`. Если ошибка касается удалённого local, верните его в корневой блок `locals`. Повторяйте `terraform validate`, пока проверка не пройдёт.

10. Выполните `terraform plan`. Сокращённый вывод:

    ```text
      # kubernetes_deployment_v1.web has moved to module.web.kubernetes_deployment_v1.this
      # kubernetes_namespace_v1.demo has moved to module.web.kubernetes_namespace_v1.this
      # kubernetes_service_v1.web has moved to module.web.kubernetes_service_v1.this

    Plan: 0 to add, 0 to change, 0 to destroy.
    ```

    Если в плане есть `~` или `-/+`, код модуля расходится с прежним кодом. Добейтесь совпадения, чтобы в плане остались одни перемещения. Затем выполните `terraform apply` и подтвердите словом `yes`. В кластере ничего не изменится — поменяются только адреса в state.

## Вызываем модуль дважды

Добавьте второе приложение — ещё один вызов в корневом `main.tf`:

```hcl
module "admin" {
  source = "./modules/web-app"

  name      = "admin"
  namespace = "admin"
  image_tag = var.image_tag
}
```

У `replicas` в модуле есть значение по умолчанию, поэтому в этом вызове его можно не указывать. Выполните `terraform init` для нового вызова, а затем `terraform plan`. План покажет `Plan: 3 to add, 0 to change, 0 to destroy.` Примените его и проверьте результат:

```sh
kubectl get deployments,services -n admin
terraform state list
```

Среди прочих строк `terraform state list` покажет оба вызова:

```text
module.admin.kubernetes_deployment_v1.this
module.admin.kubernetes_namespace_v1.this
module.admin.kubernetes_service_v1.this
module.web.kubernetes_deployment_v1.this
module.web.kubernetes_namespace_v1.this
module.web.kubernetes_service_v1.this
```

Это итоговое состояние проекта после урока, и следующие уроки опираются именно на него. В корневом `main.tf` два вызова модуля:

- `module "web"` управляет namespace `demo` с Deployment и Service `web`. Остальной код получает имя namespace через `module.web.namespace`.
- `module "admin"` управляет namespace `admin` с Deployment и Service `admin`.

Три блока `moved` оставьте в `main.tf`: в команде они ещё понадобятся другим копиям state, например для staging и production. Удалять блок `moved` можно лишь тогда, когда каждый state, который использует этот код, уже применён вместе с ним.

## Много вызовов через `for_each`

Блок `module`, как и ресурс, принимает `count` и `for_each`. В командном коде такая форма встречается часто. Этот раздел только для чтения — менять проект не нужно:

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

Каждый ключ создаёт отдельный вызов с адресами вроде `module.app["web"].kubernetes_deployment_v1.this`. Его outputs читают по ключу: `module.app["web"].namespace`.

Допустим, команда заменяет отдельные вызовы `web` и `admin` одним таким блоком. Без подсказки план удалил бы оба приложения и создал их заново. Блок `moved` умеет переносить вызов модуля целиком, поэтому pull request добавляет по такому блоку на каждый вызов:

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

Меняются и все ссылки: `module.web.namespace` превращается в `module.app["web"].namespace`. С блоками `moved` план состоит только из перемещений.

## Модули из других мест

Аргумент `source` принимает и удалённые адреса. У модуля из Terraform Registry адрес имеет вид `<NAMESPACE>/<NAME>/<PROVIDER>`, а рядом указывается `version`:

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "6.0.1"
}
```

Этот пример рассчитан на AWS, так что здесь его достаточно прочитать. Аргумент `version` работает только для модулей из реестра.

Общие модули команды часто хранят в Git-репозитории. В Git-источнике тег, ветку или коммит выбирают параметром `ref`, а подкаталог — двойной косой чертой `//`:

```hcl
module "web" {
  source = "git::https://github.com/example-org/terraform-modules.git//web-app?ref=v1.4.0"
}
```

`terraform init` скачивает удалённые модули в `.terraform/modules`. Уже установленные модули он не обновляет. Чтобы получить более свежий код в пределах разрешённых версий, выполните `terraform init -upgrade`. На ревью проверяйте, что каждый удалённый модуль закреплён на версии или теге.

## Официальные ресурсы

- [Обзор модулей](https://developer.hashicorp.com/terraform/language/modules)
- [Справочник по блоку module](https://developer.hashicorp.com/terraform/language/block/module)
- [Источники модулей](https://developer.hashicorp.com/terraform/language/modules/sources)
- [Провайдеры внутри модулей](https://developer.hashicorp.com/terraform/language/modules/develop/providers)
- [Рефакторинг с блоками moved](https://developer.hashicorp.com/terraform/language/modules/develop/refactoring)
