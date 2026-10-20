---
slug: terraform/count-and-for-each
title: count и for_each
description: Создавайте много однотипных объектов Kubernetes из одного блока resource с помощью count и for_each и разберитесь, почему for_each защищает plan от сюрпризов при изменении списка.
---

Чтобы получить в Kubernetes десять подов, никто не пишет десять манифестов: достаточно одного шаблона и поля `replicas`. В Terraform есть похожий инструмент. `Meta-argument` (мета-аргумент) — это аргумент, который обрабатывает сам Terraform, а не provider; его можно добавить в любой блок resource. Два мета-аргумента превращают один блок во множество объектов: `count` и `for_each`.

Каждый объект, созданный таким блоком, называется `instance` (экземпляр). У каждого экземпляра свой адрес — и в plan, и в state. Именно в том, как Terraform строит эти адреса, и заключается главное различие между `count` и `for_each`.

В этом уроке вы добавите в проект `terraform-course` командные namespaces и ConfigMaps.

## Namespaces через count

`count` принимает целое число, и Terraform создаёт ровно столько экземпляров ресурса. Внутри блока `count.index` хранит номер текущего экземпляра, начиная с `0`.

Добавьте список команд в `variables.tf`:

```hcl
variable "teams" {
  type    = list(string)
  default = ["team-a", "team-b", "team-c"]
}
```

А в `main.tf` — по namespace на каждую команду:

```hcl
resource "kubernetes_namespace_v1" "team" {
  count = length(var.teams)

  metadata {
    name = var.teams[count.index]
  }
}
```

`length(var.teams)` равно `3`, поэтому Terraform создаст три экземпляра. Первый получит `var.teams[0]`, то есть `team-a`, и так далее.

Выполните `terraform apply`. В plan появятся три экземпляра с адресами-индексами:

```text
  # kubernetes_namespace_v1.team[0] will be created
  # kubernetes_namespace_v1.team[1] will be created
  # kubernetes_namespace_v1.team[2] will be created
```

Подтвердите применение словом `yes` и загляните в кластер:

```sh
kubectl get namespaces
```

Теперь адрес `kubernetes_namespace_v1.team` обозначает список экземпляров. Чтобы обратиться к одному из них, добавьте индекс: `kubernetes_namespace_v1.team[0].metadata[0].name` — это `team-a`.

Всё это напоминает StatefulSet. Его поды называются `web-0`, `web-1` и `web-2`, и личность каждого привязана к номеру. Здесь точно так же: namespace опознаётся по позиции в списке, а не по имени.

## Необязательный ресурс

`count` — ещё и привычный способ включать и выключать отдельный ресурс. Добавьте флаг в `variables.tf`:

```hcl
variable "debug_enabled" {
  type    = bool
  default = false
}
```

И необязательный ConfigMap в `main.tf`:

```hcl
resource "kubernetes_config_map_v1" "debug" {
  count = var.debug_enabled ? 1 : 0

  metadata {
    name      = "debug"
    namespace = kubernetes_namespace_v1.demo.metadata[0].name
  }

  data = {
    LOG_LEVEL = "debug"
  }
}
```

При значении по умолчанию `count` равен `0`, и Terraform ничего не создаёт. Проверьте это командой `terraform plan -var debug_enabled=true`: теперь plan добавляет `kubernetes_config_map_v1.debug[0]`.

В командных репозиториях этот приём встречается постоянно. Когда `count` равен `0`, экземпляра `kubernetes_config_map_v1.debug[0]` не существует, и ссылка на него приводит к ошибке. Поэтому код, который его читает, проверяет тот же флаг:

```hcl
output "debug_config_map" {
  value = var.debug_enabled ? kubernetes_config_map_v1.debug[0].metadata[0].name : null
}
```

## Беда с индексами

Допустим, команде `team-b` namespace больше не нужен. Уберите её из середины списка:

```hcl
  default = ["team-a", "team-c"]
```

Выполните `terraform plan`. Ниже вывод приведён в сокращённом виде:

```text
  # kubernetes_namespace_v1.team[1] must be replaced
-/+ resource "kubernetes_namespace_v1" "team" {
      ~ metadata {
          ~ name = "team-b" -> "team-c" # forces replacement
        }
    }

  # kubernetes_namespace_v1.team[2] will be destroyed
  # (because index [2] is out of range for count)
  - resource "kubernetes_namespace_v1" "team" {
      - metadata {
          - name = "team-c" -> null
        }
    }

Plan: 1 to add, 0 to change, 2 to destroy.
```

Вы хотели удалить один namespace, а Terraform собирается удалить два и создать один. Дело в том, что он сопоставляет список со state по индексам. Под индексом `1` раньше был `team-b`, а теперь стоит `team-c`. Переименовать namespace нельзя, поэтому Terraform его пересоздаёт. Индекса `2` больше нет, и соответствующий экземпляр уничтожается. В настоящем кластере `team-c` лишился бы всех своих объектов: удаление namespace удаляет всё, что в нём находится.

Не применяйте этот plan. Верните `team-b` в список — `terraform plan` снова должен сообщить, что изменений нет.

## Переход на for_each

`for_each` принимает map или set строк. Terraform создаёт по экземпляру на каждый элемент и подставляет в адрес ключ этого элемента. Внутри блока `each.key` — ключ текущего элемента, а `each.value` — его значение. У set оба совпадают и равны самой строке.

`var.teams` — это list, а list `for_each` не принимает, поэтому преобразуйте его функцией `toset()`. Замените ресурс namespace в `main.tf`:

```hcl
resource "kubernetes_namespace_v1" "team" {
  for_each = toset(var.teams)

  metadata {
    name = each.key
  }
}
```

Адреса экземпляров меняются: был `team[0]`, стал `team["team-a"]`. Если ничего не сделать, Terraform уничтожит старые экземпляры и создаст новые. Блок `moved` сообщает Terraform, что у объекта просто сменился адрес. Добавьте в `main.tf` такие блоки:

```hcl
moved {
  from = kubernetes_namespace_v1.team[0]
  to   = kubernetes_namespace_v1.team["team-a"]
}

moved {
  from = kubernetes_namespace_v1.team[1]
  to   = kubernetes_namespace_v1.team["team-b"]
}

moved {
  from = kubernetes_namespace_v1.team[2]
  to   = kubernetes_namespace_v1.team["team-c"]
}
```

Выполните `terraform plan`. Про каждый namespace plan сообщит, что он `has moved to` новый адрес, а изменений в кластере не запланирует. Выполните `terraform apply`, чтобы записать новые адреса в state. После этого блоки `moved` можно удалить. В общем репозитории их стоит оставить, пока apply не пройдёт для каждого state, который использует этот код, например для staging и production.

Теперь снова уберите `team-b` из списка и выполните `terraform plan`:

```text
  # kubernetes_namespace_v1.team["team-b"] will be destroyed
  # (because key ["team-b"] is not in for_each map)

Plan: 0 to add, 0 to change, 1 to destroy.
```

На этот раз plan совпадает с вашим замыслом. Каждый экземпляр опознаётся по ключу, поэтому адреса остальных namespaces не сдвигаются. Примените plan.

Общее правило такое: `count` подходит для необязательного ресурса или одинаковых копий, а `for_each` — когда у каждого экземпляра есть собственная идентичность, например имя. Использовать оба мета-аргумента в одном блоке нельзя.

## for_each по map

Если передать в `for_each` map, в `each.value` окажутся дополнительные данные для каждого экземпляра. Добавьте в `variables.tf` уровень логирования для каждого приложения:

```hcl
variable "app_log_levels" {
  type = map(string)
  default = {
    frontend = "info"
    backend  = "debug"
  }
}
```

И создайте в `main.tf` по ConfigMap на приложение:

```hcl
resource "kubernetes_config_map_v1" "app" {
  for_each = var.app_log_levels

  metadata {
    name      = "${each.key}-config"
    namespace = kubernetes_namespace_v1.demo.metadata[0].name
  }

  data = {
    LOG_LEVEL = each.value
  }
}
```

Примените изменения. Plan создаст `kubernetes_config_map_v1.app["backend"]` и `kubernetes_config_map_v1.app["frontend"]`. Затем проверьте результат:

```sh
kubectl get configmaps -n demo
```

Ключи значения `for_each` должны быть известны Terraform до того, как он начнёт что-либо менять. Ключи из переменной или из map, записанной прямо в коде, подходят. А значение, которое появляется только после apply, например `uid` объекта, ключом быть не может.

## Преобразование коллекций через for

Ресурс `kubernetes_namespace_v1.team` теперь представляет собой map экземпляров. Другому коду часто нужен из него простой list или map поменьше. Выражение `for` строит новый list или map из существующей коллекции.

Добавьте два outputs в `outputs.tf`:

```hcl
output "team_namespaces" {
  value = [for ns in kubernetes_namespace_v1.team : ns.metadata[0].name]
}

output "app_config_maps" {
  value = { for app, cm in kubernetes_config_map_v1.app : app => cm.metadata[0].name }
}
```

Квадратные скобки строят list, фигурные — map, и в нём `=>` отделяет ключ от значения. Если после `for` указаны два имени, первое получает ключ, а второе — значение.

Чтобы отфильтровать элементы, добавьте в конец `if`:

```hcl
[for app, level in var.app_log_levels : app if level == "debug"]
```

Это выражение вернёт `["backend"]`. Выполните `terraform apply` и посмотрите outputs командой `terraform output`.

## Блоки dynamic

`count` и `for_each` повторяют ресурсы целиком. Но иногда повторить нужно вложенный блок — например, `env` внутри контейнера. Для этого служит блок `dynamic`:

```hcl
dynamic "env" {
  for_each = var.app_env
  content {
    name  = env.key
    value = env.value
  }
}
```

Terraform создаст по блоку `env` на каждый элемент `var.app_env` — map с именами и значениями переменных. Внутри `content` текущий элемент доступен под именем метки блока, здесь это `env`. Такие блоки встречаются в общих модулях. HashiCorp не советует ими злоупотреблять: код становится труднее читать. Если набор вложенных блоков заранее известен, лучше выписать их явно.

## На что смотреть на ревью

- Изменение списка, который используется в `count`, может пересоздать или уничтожить экземпляры, которых никто не собирался трогать. Читайте каждый адрес вида `[N]` в plan.
- Переход между `count` и `for_each` или переименование ресурса требуют блоков `moved`. Без них plan уничтожит объекты и создаст их заново.
- Итоговая строка plan должна соответствовать смыслу изменения. Если убрали один элемент, ждите ровно одного destroy.

## Что почитать

- [Мета-аргумент count](https://developer.hashicorp.com/terraform/language/meta-arguments/count)
- [Мета-аргумент for_each](https://developer.hashicorp.com/terraform/language/meta-arguments/for_each)
- [Выражения for](https://developer.hashicorp.com/terraform/language/expressions/for)
- [Рефакторинг с блоками moved](https://developer.hashicorp.com/terraform/language/modules/develop/refactoring)
- [Блоки dynamic](https://developer.hashicorp.com/terraform/language/expressions/dynamic-blocks)
