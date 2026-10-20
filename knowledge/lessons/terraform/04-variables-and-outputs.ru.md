---
slug: terraform/variables-and-outputs
title: Переменные и outputs
description: Сделайте конфигурацию гибкой с помощью входных переменных, дайте имена повторяющимся значениям через locals и читайте результаты через outputs и terraform output.
---

До сих пор все значения в проекте `terraform-course` были вписаны прямо в код: namespace всегда называется `demo`, тег образа неизменен. В настоящем командном коде всё устроено иначе — одна и та же конфигурация работает в разных местах с разными значениями.

Тем, кто знаком с Helm, идея покажется привычной. Чарт объявляет свои входные параметры в `values.yaml`, а вы переопределяете их через `-f` или `--set`. В Terraform для этого есть три родственных инструмента:

- Входные переменные — это входные параметры, как values чарта.
- Locals — именованные вспомогательные значения внутри конфигурации, как хелпер с метками в `_helpers.tpl`.
- Outputs — результаты, которые Terraform показывает после `apply`, чтобы их могли прочитать люди и скрипты.

## Входные переменные

`Input variable`, или входная переменная, — это параметр конфигурации. Её объявляют блоком `variable`:

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

Метка после `variable` — это имя переменной; внутри конфигурации к ней обращаются как к `var.replicas`. Все аргументы необязательны:

- `type` ограничивает допустимые значения: например, `string`, `number`, `bool`, `list(string)` или `map(string)`. Значение неподходящего типа Terraform отвергнет ещё до того, как начнёт что-либо планировать.
- `default` делает переменную необязательной. Переменная без значения по умолчанию обязательна.
- `description` объясняет переменную следующему читателю кода. Добавляйте его всегда.
- `validation` задаёт собственное правило. Для переданного значения `condition` должно быть истинным, иначе Terraform остановится и покажет `error_message`. У одной переменной может быть несколько блоков `validation`.
- `sensitive = true` скрывает значение в выводе `plan` и `apply`. Это нужно для паролей и токенов. Однако в state значение по-прежнему хранится открытым текстом, так что шифрованием это не является.

## Как задать значения переменных

Terraform берёт значения переменных из нескольких источников:

- `terraform.tfvars` и файлы с окончанием `.auto.tfvars` загружаются автоматически. В них записаны простые присваивания вроде `image_tag = "1.27"`.
- `-var-file=staging.tfvars` подключает любой другой файл — как `helm install -f`.
- `-var 'replicas=3'` задаёт одно значение в командной строке — как `helm install --set`.
- Переменная окружения с префиксом `TF_VAR_` задаёт переменную, чьё имя записано после префикса. Например, `TF_VAR_replicas=3` задаёт `replicas`.

Если одну и ту же переменную задают несколько источников, побеждает тот, что стоит в этом списке ниже:

1. `default` в блоке `variable`.
2. Переменные окружения `TF_VAR_`.
3. `terraform.tfvars`, затем `terraform.tfvars.json`.
4. Файлы `*.auto.tfvars` и `*.auto.tfvars.json` в алфавитном порядке их имён.
5. Параметры `-var` и `-var-file` в том порядке, в каком они записаны в командной строке.

Если ни один источник не задал значение обязательной переменной, Terraform спросит его интерактивно. В CI ответить на вопрос некому, поэтому запуск там просто завершится ошибкой.

Команды часто хранят в репозитории `terraform.tfvars` с безопасными значениями, а секреты передают в CI через переменные `TF_VAR_`. На ревью проверяйте и объявление переменной, и то место, где ей присваивается значение.

## Locals

`Local value`, или local, даёт имя выражению, которое используется больше одного раза. Locals объявляют в блоке `locals`, а читают как `local.<name>` — обратите внимание на единственное число в `local`:

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

Встроенная функция `merge` объединяет map'ы, поэтому в `web_labels` попадают и общие метки, и `app = "web"`.

Local — это не входной параметр: переопределить его через `-var` или файл `.tfvars` нельзя. Берите переменную, когда значение должно меняться от запуска к запуску, и local, когда значение вычисляется внутри самой конфигурации. Не заводите local для значения, которое встречается всего один раз: читателю придётся искать его в другом месте файла.

## Outputs

`Output value`, или output, публикует результат конфигурации:

```hcl
output "namespace" {
  description = "Namespace that holds the web app."
  value       = kubernetes_namespace_v1.demo.metadata[0].name
}
```

В `value` можно записать любое выражение. В конце `apply` Terraform печатает все outputs и сохраняет их в state. Чем-то outputs напоминают `status` объекта Kubernetes: они сообщают факты, сложившиеся после изменения.

Чтобы прочитать outputs позже, выполните `terraform output`. Команда берёт значения из сохранённого state и к кластеру не обращается:

- `terraform output` печатает все outputs.
- `terraform output -raw namespace` печатает одно значение как есть, без кавычек. Именно эта форма нужна в shell-скриптах. Она работает только для строк, чисел и булевых значений.
- `terraform output -json` печатает все outputs в формате JSON, включая списки и map'ы, — для инструментов вроде `jq`.

Output тоже можно пометить как `sensitive = true`. Если output использует чувствительное значение, но сам так не помечен, Terraform откажется строить plan. В обычном списке чувствительный output выглядит как `<sensitive>`, однако `-raw` и `-json` выводят настоящее значение.

## Практика

Сделайте проект `terraform-course` настраиваемым. Кластер из предыдущих уроков должен быть запущен.

1. Создайте в каталоге проекта файл `variables.tf`:

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

   У `image_tag` нет значения по умолчанию, поэтому переменная обязательна.

2. В `main.tf` оставьте блок `provider` без изменений, а ресурсы namespace, Deployment и Service замените таким кодом:

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

   Адрес ресурса остаётся прежним — `kubernetes_namespace_v1.demo`; из переменной теперь берётся только настоящее имя namespace. Селектор тоже остаётся `app = "web"`, потому что селектор Deployment нельзя изменить после создания.

3. Создайте `outputs.tf`:

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

4. Создайте `terraform.tfvars` с обязательным значением:

   ```hcl
   image_tag = "1.27"
   ```

5. Выполните `terraform plan`. В плане должны быть только изменения на месте, отмеченные знаком `~`, — например, новые метки. Ничего не должно удаляться. Если plan пересоздаёт namespace, проверьте, что значение `namespace` по умолчанию — `demo`. Затем выполните `terraform apply` и подтвердите ввод словом `yes`. В конце Terraform напечатает outputs:

   ```text
   Outputs:

   namespace = "demo"
   service_name = "web"
   ```

6. Используйте output в shell-команде:

   ```sh
   kubectl get deployment web -n "$(terraform output -raw namespace)"
   terraform output -json
   ```

7. Проверьте правила приоритета, ничего не применяя:

   ```sh
   TF_VAR_replicas=3 terraform plan
   terraform plan -var 'replicas=9'
   ```

   Первый plan меняет `replicas` с `"2"` на `"3"`. Провайдер Kubernetes хранит `replicas` как строку, и Terraform сам преобразует ваше число. Вторая команда ещё до планирования изменений завершится ошибкой `The replicas value must be between 1 and 5.`

## Официальные ресурсы

- [Входные переменные](https://developer.hashicorp.com/terraform/language/values/variables)
- [Local values](https://developer.hashicorp.com/terraform/language/values/locals)
- [Output values](https://developer.hashicorp.com/terraform/language/values/outputs)
- [Команда terraform output](https://developer.hashicorp.com/terraform/cli/commands/output)
