---
slug: terraform/hcl-basics
title: Основы HCL
description: Научитесь читать и писать на HCL, сравнив Deployment с его YAML-манифестом, а затем добавьте Service со ссылками, функциями, fmt и validate.
---

Код Terraform пишут на `HCL` — HashiCorp Configuration Language. В Kubernetes желаемое состояние описывает YAML, в Terraform эту роль берёт на себя HCL. Выглядит он иначе, но большинство идей переносится без изменений. В этом уроке вы научитесь построчно читать `main.tf` из прошлого урока, а затем добавите в него Service.

## Блоки и аргументы

HCL строится из двух основных элементов. `block` (блок) — это контейнер для настроек: у него есть тип, ноль или больше меток (`labels`) и тело в фигурных скобках. `argument` (аргумент) задаёт внутри тела одно значение в виде `name = value`.

```hcl
resource "kubernetes_namespace_v1" "demo" {
  metadata {
    name = "demo"
  }
}
```

Здесь `resource` — тип блока. Он принимает две метки: тип ресурса `kubernetes_namespace_v1` и локальное имя `demo`. Вместе они образуют адрес ресурса — `kubernetes_namespace_v1.demo`. Локальное имя существует только внутри Terraform, а имя объекта в кластере берётся из `metadata.name`. Часто эти имена совпадают, но это не обязательно.

У других блоков меток может быть другое число. У блока `terraform` их нет вовсе, у блока `provider` — одна: имя провайдера.

Внутри тела `metadata { ... }` — это вложенный блок (`nested block`), а `name = "demo"` — аргумент. При чтении кода это различие важно. У аргумента всегда есть `=`, у вложенного блока — никогда. Поэтому `labels = { app = "web" }` — аргумент, значение которого словарь, а `metadata { ... }` — блок. Какую форму принимает каждая настройка, решает схема провайдера, так что в сомнительных случаях загляните на страницу ресурса в Terraform Registry.

## Из YAML в HCL

Вот Deployment из прошлого урока в виде манифеста Kubernetes:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: demo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
```

А вот тот же Deployment на HCL:

```hcl
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

Структура почти та же. Различия объясняются несколькими правилами:

- `apiVersion` и `kind` превращаются в тип ресурса — `kubernetes_deployment_v1`.
- Имена полей записываются в snake_case вместо camelCase: `matchLabels` становится `match_labels`.
- YAML-объект с фиксированным набором полей, например `metadata` или `spec`, становится вложенным блоком.
- YAML-объект с произвольными ключами, например `labels` или `matchLabels`, становится аргументом-словарём.
- YAML-список объектов становится повторяющимся блоком с именем в единственном числе: каждый блок `container { ... }` добавляет один элемент в `containers`.
- Поля `status` нет: им управляет кластер, а не ваша конфигурация.

## Типы

У каждого значения в HCL есть тип. Чаще всего встречаются такие:

| Тип | Пример | Пояснение |
| --- | --- | --- |
| `string` | `image = "nginx:1.27"` | Текст в двойных кавычках. |
| `number` | `port = 80` | Целое или дробное число без кавычек. |
| `bool` | `wait_for_rollout = true` | `true` или `false` без кавычек. |
| `list` | `command = ["nginx", "-g", "daemon off;"]` | Упорядоченная последовательность в квадратных скобках. |
| `map` | `labels = { app = "web" }` | Именованные ключи со значениями одного типа в фигурных скобках. |
| `object` | `kubernetes_namespace_v1.demo` | Именованные атрибуты, у каждого свой тип. Любой ресурс — это объект. |

Если это возможно, Terraform сам приводит значение к типу, которого ждёт аргумент. Например, `target_port` у порта Service в схеме провайдера — строка, потому что Kubernetes принимает там и имя порта. Тем не менее можно написать `target_port = 80`, и Terraform превратит число в `"80"`.

## Ссылки и неявные зависимости

Deployment выше не повторяет имя namespace, а использует ссылку — `reference`:

```hcl
namespace = kubernetes_namespace_v1.demo.metadata[0].name
```

Читайте её слева направо: тип ресурса, локальное имя, а затем путь к нужному атрибуту. Откуда `[0]`? Провайдер Kubernetes представляет каждый вложенный блок как список объектов, даже если блок допускается только один. Значит, `metadata[0]` — первый и единственный блок `metadata`, а `.name` — его аргумент `name`. Если забыть индекс, `terraform validate` подскажет:

```text
╷
│ Error: Invalid operation
│
│   on main.tf line 14, in resource "kubernetes_deployment_v1" "web":
│   14:     namespace = kubernetes_namespace_v1.demo.metadata.name
│
│ Block type "metadata" is represented by a list of objects, so it must be
│ indexed using a numeric key, like .metadata[0].
╵
```

Ссылка не просто копирует значение — она ещё и создаёт неявную зависимость (`implicit dependency`). По ссылкам Terraform строит граф ресурсов и создаёт их по порядку: сначала namespace, затем Deployment, который в нём живёт. При удалении он идёт в обратном порядке. С `kubectl apply -f` манифест может упасть, потому что его namespace ещё не существует. Terraform этой проблемы избегает: порядок ему уже подсказала ссылка.

## Добавляем Service

Теперь применим ссылки на деле. Добавьте этот блок в конец `main.tf` в проекте `terraform-course`:

```hcl
# Exposes the web Deployment inside the cluster.
resource "kubernetes_service_v1" "web" {
  metadata {
    name      = "web"
    namespace = kubernetes_namespace_v1.demo.metadata[0].name
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

Namespace для Service берётся через ту же ссылку, что и для Deployment, поэтому Service тоже зависит от namespace. Selector `app = "web"` совпадает с метками подов в шаблоне Deployment. Друг на друга Service и Deployment не ссылаются, так что Terraform может создать их одновременно, как только появится namespace.

Отформатируйте и проверьте код, а затем примените его:

```sh
terraform fmt
terraform validate
terraform plan
terraform apply
```

Прежде чем ввести `yes`, просмотрите plan. В конце прошлого урока вы всё удалили, поэтому plan создаст все три объекта:

```text
Plan: 3 to add, 0 to change, 0 to destroy.
```

Затем проверьте результат в кластере:

```sh
kubectl get service web -n demo
```

## Интерполяция строк и функции

Чтобы собрать строку из других значений, используйте интерполяцию строк — `string interpolation`: поместите выражение внутрь `${ ... }` в строке в кавычках. Например, это выражение собирает DNS-имя Service в кластере:

```hcl
"${kubernetes_service_v1.web.metadata[0].name}.${kubernetes_namespace_v1.demo.metadata[0].name}.svc.cluster.local"
```

Если значение состоит из одной ссылки, пишите его без кавычек, как в `namespace = kubernetes_namespace_v1.demo.metadata[0].name`. В старом коде одиночную ссылку часто оборачивают в `"${ ... }"`. Это по-прежнему работает, а `terraform fmt` убирает лишнюю обёртку.

Кроме того, в Terraform много встроенных функций. Функцию вызывают по имени, передавая аргументы в скобках. Вот те, что часто встречаются в командном коде:

| Функция | Пример | Результат |
| --- | --- | --- |
| `lower` | `lower("DEMO")` | `"demo"` |
| `upper` | `upper("web")` | `"WEB"` |
| `join` | `join(", ", ["a", "b", "c"])` | `"a, b, c"` |
| `length` | `length(["a", "b"])` | `2` |
| `format` | `format("%s:%s", "nginx", "1.27")` | `"nginx:1.27"` |
| `merge` | `merge({ app = "web" }, { tier = "frontend" })` | `{ app = "web", tier = "frontend" }` |

Опробуйте их в `terraform console` — интерактивной оболочке для выражений. Запустите её в каталоге проекта. Значения существующих ресурсов она читает из state, поэтому после `apply` можно вычислить выражение с DNS-именем, приведённое выше. Оно вернёт `"web.demo.svc.cluster.local"`. Чтобы выйти из консоли, введите `exit`.

## Комментарии

В HCL три вида комментариев:

```hcl
# A single-line comment. This is the default style.
// Also a single-line comment.
/* A comment that can
   span several lines. */
```

В новом коде используйте `#`. В комментарии стоит объяснять, зачем нужна настройка, а не что она делает.

## fmt и validate

Две команды помогают держать код в порядке перед ревью:

- `terraform fmt` приводит файлы `.tf` в текущем каталоге к стандартному стилю: выравнивает знаки `=`, исправляет отступы и печатает имена изменённых файлов. Чтобы захватить и подкаталоги, добавьте `-recursive`. В CI используют `terraform fmt -check`: она ничего не меняет, а лишь перечисляет файлы, которые нужно отформатировать, и завершается с ненулевым кодом.
- `terraform validate` проверяет синтаксис, имена аргументов, типы значений и ссылки. Ей нужен инициализированный каталог, но к кластеру она не обращается. Опечатки она ловит раньше, чем `plan`.

Запускайте обе команды перед каждым коммитом. В следующем уроке вы замените жёстко заданные значения вроде `"web"` и `2` переменными.

## Источники

- [Синтаксис конфигурации Terraform](https://developer.hashicorp.com/terraform/language/syntax/configuration)
- [Типы и значения](https://developer.hashicorp.com/terraform/language/expressions/types)
- [Ссылки на значения](https://developer.hashicorp.com/terraform/language/expressions/references)
- [Строки и шаблоны](https://developer.hashicorp.com/terraform/language/expressions/strings)
- [Встроенные функции](https://developer.hashicorp.com/terraform/language/functions)
- [Граф ресурсов](https://developer.hashicorp.com/terraform/internals/graph)
- [terraform fmt](https://developer.hashicorp.com/terraform/cli/commands/fmt)
- [terraform validate](https://developer.hashicorp.com/terraform/cli/commands/validate)
- [terraform console](https://developer.hashicorp.com/terraform/cli/commands/console)
- [kubernetes_deployment_v1](https://registry.terraform.io/providers/hashicorp/kubernetes/latest/docs/resources/deployment_v1)
- [kubernetes_service_v1](https://registry.terraform.io/providers/hashicorp/kubernetes/latest/docs/resources/service_v1)
