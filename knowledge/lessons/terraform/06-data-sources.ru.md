---
slug: terraform/data-sources
title: Data sources
description: Как читать объекты, которыми Terraform не управляет, через блоки data, использовать их значения в ресурсах и понимать, как ссылки, depends_on и граф зависимостей определяют порядок изменений.
---

До сих пор каждый блок в `terraform-course` был ресурсом — блоком `resource`. Terraform создаёт такой объект, владеет им и удаляет его при `destroy`. Но в настоящем кластере есть и объекты, созданные другими людьми или инструментами: namespace `kube-system`, ConfigMap от платформенной команды, Secret, который кто-то добавил через `kubectl`. Вашему коду нередко нужны значения из таких объектов, и прочитать их помогают data sources. Во второй половине урока вы увидите, как Terraform решает, в каком порядке читать, создавать и удалять объекты.

## Читаем объект блоком data

`data source` читает существующий объект и делает его атрибуты доступными в коде. Это аналог `kubectl get` в мире Terraform: data source никогда ничего не создаёт, не изменяет и не удаляет. Объявляется он блоком `data`:

```hcl
data "kubernetes_config_map_v1" "platform" {
  metadata {
    name      = "platform-settings"
    namespace = "default"
  }
}
```

Внешне блок похож на ресурс, но смысл у него другой:

- Первая метка — тип data source. Его определяет провайдер — точно так же, как типы ресурсов. `kubernetes_config_map_v1` читает один ConfigMap.
- Вторая метка — локальное имя. Вместе они образуют адрес `data.kubernetes_config_map_v1.platform`. Обратите внимание на префикс `data.`: ресурс и data source могут носить одинаковые тип и имя, не мешая друг другу.
- Аргументы здесь — это запрос, а не желаемое состояние. `name` и `namespace` указывают, какой именно ConfigMap прочитать.

Результатом пользуются через обычную ссылку. Атрибут `data` этого data source — map с ключами ConfigMap:

```hcl
data.kubernetes_config_map_v1.platform.data["log_level"]
```

Terraform заново читает data sources при каждом `plan` и `apply`. Результат он сохраняет в state, но самим объектом не управляет. Если ConfigMap изменится, следующий plan просто возьмёт новое значение. Это не drift: Terraform никогда не владел этим объектом. `terraform destroy` удалит результат чтения из state, а сам ConfigMap останется в кластере.

## Почему бы не доверить чтение Kubernetes

Kubernetes и сам умеет читать ConfigMap: Pod может получить из него переменные окружения через `envFrom` или `configMapKeyRef`. Если такой путь подходит, выбирайте его. Однако Pod читает ConfigMap и Secret только из собственного namespace. Pods `web` работают в `demo`, а ConfigMap платформенной команды лежит в `default`.

Data source действует на другом уровне. Terraform читает значение во время планирования и записывает его в Deployment как обычное значение, так что Kubernetes об этой связи даже не знает. Зато значение видно в плане, и ревьюер понимает, что именно изменится.

## Отсутствующий объект — не всегда ошибка

Внимательно проверяйте имя и namespace в блоке data. Некоторые data sources Kubernetes, включая `kubernetes_config_map_v1`, не завершаются ошибкой, если объекта нет, а возвращают пустые атрибуты. Ошибка всплывёт позже — в строке, которая читает ключ из пустого результата, а не в самом блоке `data`.

## Когда Terraform читает data sources

Обычно Terraform читает data sources в самом начале `plan`, и это видно в выводе:

```text
data.kubernetes_config_map_v1.platform: Reading...
data.kubernetes_config_map_v1.platform: Read complete after 0s [id=default/platform-settings]
```

Значения известны уже при планировании, поэтому plan показывает их полностью. Но иногда прочитать данные так рано не получается. Аргумент блока data может зависеть от значения, которое станет известно только после применения, — `(known after apply)`: например, от атрибута ресурса, который Terraform ещё не создал. Тогда Terraform откладывает чтение до `apply` и сообщает об этом в плане:

```text
  # data.kubernetes_config_map_v1.platform will be read during apply
  # (config refers to values not yet known)
```

Такое чтение plan помечает символом `<=`. Все значения, которые приходят из этого data source, тоже превращаются в `(known after apply)`, и ревьюер узнаёт из плана меньше.

Есть здесь и ловушка. Если блок data читает объект, который создаёт эта же конфигурация, а его аргументы — обычные строки, Terraform прочитает объект ещё при планировании. Объекта к этому моменту нет, и результат окажется пустым. Правило простое: если объектом управляет Terraform, ссылайтесь прямо на ресурс. Data source нужен только для объектов, которыми управляет кто-то другой.

## Другие data sources Kubernetes

У провайдера Kubernetes есть data sources для многих видов объектов. Их имена повторяют имена ресурсов: `kubernetes_secret_v1`, `kubernetes_namespace_v1`, `kubernetes_service_v1`. Несколько примеров:

```hcl
data "kubernetes_namespace_v1" "kube_system" {
  metadata {
    name = "kube-system"
  }
}

data "kubernetes_all_namespaces" "all" {}

output "kube_system_uid" {
  value = data.kubernetes_namespace_v1.kube_system.metadata[0].uid
}

output "namespaces" {
  value = data.kubernetes_all_namespaces.all.namespaces
}
```

`kubernetes_all_namespaces` не принимает аргументов и возвращает список имён всех namespaces. UID namespace `kube-system` живёт столько же, сколько сам кластер, поэтому команды иногда используют его как идентификатор кластера.

Secret читается через `kubernetes_secret_v1` так же, как ConfigMap. Его `data` помечен как sensitive, и Terraform скрывает его в выводе. Но, как вы помните из прошлого урока, в state он всё равно хранится открытым текстом.

## Граф зависимостей

Прежде чем приступить к работе, Terraform строит `граф зависимостей` (dependency graph). Каждый ресурс и каждый data source — это вершина графа, а каждая ссылка из одного блока на другой — ребро. В вашем Deployment есть такая строка:

```hcl
namespace = kubernetes_namespace_v1.demo.metadata[0].name
```

Эта ссылка — `неявная зависимость` (implicit dependency): Deployment зависит от namespace, поэтому Terraform сначала создаёт namespace. В Service та же ссылка. Deployment и Service друг на друга не ссылаются, поэтому Terraform создаёт их одновременно, как только namespace готов. По умолчанию Terraform обрабатывает до 10 объектов параллельно; этот предел меняет параметр `-parallelism` у `plan`, `apply` и `destroy`. При `destroy` Terraform обходит граф в обратном порядке: сначала удаляет Deployment и Service, а namespace — последним.

Важнее значения здесь сама ссылка. Сравните две строки:

```hcl
namespace = var.namespace
namespace = kubernetes_namespace_v1.demo.metadata[0].name
```

Обе передают в Deployment строку `demo`, но ребро к namespace создаёт только вторая. С первой Terraform может создать Deployment раньше, чем появится namespace, и API Kubernetes его отклонит. На ревью обращайте внимание на имена-литералы и переменные там, где должна стоять ссылка на ресурс.

## Явные зависимости и depends_on

Бывает, что одному объекту нужен другой, но ни один аргумент на него не ссылается. Для такой скрытой зависимости служит мета-аргумент `depends_on`. Он принимает список адресов и работает в любом блоке `resource` или `data`:

```hcl
resource "kubernetes_job_v1" "smoke_test" {
  depends_on = [kubernetes_service_v1.web]

  # ...
}
```

Так возникает `явная зависимость` (explicit dependency): Terraform завершает всю работу над Service и только потом берётся за Job. Но даже здесь ссылка часто оказывается лучше. Если команда Job собирает URL из `kubernetes_service_v1.web.metadata[0].name`, ребро появится само собой.

В коде для Kubernetes `depends_on` нужен редко. Контроллеры непрерывно приводят кластер к желаемому состоянию, так что порядок для большинства объектов не важен: Service без Pods просто дождётся их появления. Официальная документация называет `depends_on` крайней мерой, и тому есть причины:

- Он делает планы осторожнее. В блоке data `depends_on` откладывает чтение до `apply` всякий раз, когда у зависимости есть изменения. Тогда plan пишет `(depends on a resource or a module with changes pending)`, а значений `(known after apply)` в нём становится больше.
- Он скрывает причину. Ссылка объясняет себя сама, а строка `depends_on` — нет. На ревью просите оставить рядом с ней короткий комментарий.

## Смотрим на граф

`terraform graph` печатает граф зависимостей в формате DOT — текстовом формате инструментов Graphviz. Запустите команду в каталоге проекта, когда выполните практику ниже. Вы увидите примерно такие строки:

```text
digraph G {
  rankdir = "RL";
  node [shape = rect, fontname = "sans-serif"];
  "data.kubernetes_config_map_v1.platform" [label="data.kubernetes_config_map_v1.platform"];
  "kubernetes_deployment_v1.web" [label="kubernetes_deployment_v1.web"];
  "kubernetes_namespace_v1.demo" [label="kubernetes_namespace_v1.demo"];
  "kubernetes_service_v1.web" [label="kubernetes_service_v1.web"];
  "kubernetes_deployment_v1.web" -> "data.kubernetes_config_map_v1.platform";
  "kubernetes_deployment_v1.web" -> "kubernetes_namespace_v1.demo";
  "kubernetes_service_v1.web" -> "kubernetes_namespace_v1.demo";
}
```

Каждая стрелка ведёт от вершины к той, от которой она зависит. Для маленького проекта текста вполне достаточно. Если у вас есть Graphviz, команда `terraform graph | dot -Tsvg > graph.svg` нарисует картинку.

## Практика

Понадобятся кластер и проект `terraform-course` из предыдущих уроков.

1. Сыграйте роль платформенной команды и создайте ConfigMap в обход Terraform:

   ```sh
   kubectl create configmap platform-settings -n default --from-literal=log_level=info
   ```

2. Добавьте блок data в `main.tf`:

   ```hcl
   data "kubernetes_config_map_v1" "platform" {
     metadata {
       name      = "platform-settings"
       namespace = "default"
     }
   }
   ```

3. В ресурсе `kubernetes_deployment_v1.web` добавьте блок `env` внутрь блока `container`, после `image`:

   ```hcl
   env {
     name  = "LOG_LEVEL"
     value = data.kubernetes_config_map_v1.platform.data["log_level"]
   }
   ```

4. Выполните `terraform plan`. В начале вывода Terraform сообщит, что читает ConfigMap. План обновит Deployment на месте и добавит `LOG_LEVEL` со значением `info`. Выполните `terraform apply` и подтвердите ввод словом `yes`.

5. Проверьте результат в кластере и в state:

   ```sh
   kubectl get deployment web -n demo -o jsonpath='{.spec.template.spec.containers[0].env}'
   terraform state list
   ```

   У Deployment появилась переменная `LOG_LEVEL` со значением `info`, а в списке state — `data.kubernetes_config_map_v1.platform`.

6. Измените ConfigMap за спиной у Terraform:

   ```sh
   kubectl patch configmap platform-settings -n default --type merge -p '{"data":{"log_level":"debug"}}'
   terraform plan
   ```

   Terraform не пытается отменить это изменение, потому что ConfigMap ему не принадлежит. Он читает новое значение и планирует сменить `LOG_LEVEL` в Deployment с `info` на `debug`. Не применяйте этот план.

7. Выполните `terraform graph` и найдите стрелки от `kubernetes_deployment_v1.web` к namespace и к data source.

8. Посмотрите, что происходит, когда объекта нет:

   ```sh
   kubectl delete configmap platform-settings -n default
   terraform plan
   ```

   Plan завершится ошибкой. Она укажет на строку в блоке `env`, которая читает `log_level`, а не на блок `data`.

9. Наведите порядок перед следующими уроками. Удалите из `main.tf` блок `env` и блок `data`, затем выполните `terraform apply` и подтвердите ввод словом `yes`. Terraform уберёт `LOG_LEVEL` из Deployment.

## Официальные ресурсы

- [Data sources](https://developer.hashicorp.com/terraform/language/data-sources)
- [Мета-аргумент depends_on](https://developer.hashicorp.com/terraform/language/meta-arguments/depends_on)
- [Команда terraform graph](https://developer.hashicorp.com/terraform/cli/commands/graph)
- [Data source kubernetes_config_map_v1](https://registry.terraform.io/providers/hashicorp/kubernetes/latest/docs/data-sources/config_map_v1)
