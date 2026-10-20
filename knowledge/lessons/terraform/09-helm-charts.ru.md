---
slug: terraform/helm-charts
title: Helm-чарты
description: Установите Helm-чарт через Terraform-провайдер Helm, передайте values, прочитайте атрибуты релиза, разберитесь, что Terraform видит внутри релиза, и решите, когда лучше подойдут Argo CD или Flux.
---

До сих пор каждый объект Kubernetes в проекте был отдельным ресурсом Terraform. Но многие инструменты распространяются в виде Helm-чартов: ingress-контроллеры, cert-manager, стеки мониторинга. Переписывать их манифесты на HCL бессмысленно. Провайдер `hashicorp/helm` позволяет Terraform установить чарт как есть.

В этом уроке вы подключите провайдер Helm к проекту `terraform-course`, установите небольшой чарт в namespace `demo` и прочитаете атрибуты релиза. Затем разберётесь, что именно отслеживает Terraform и когда разумнее взять другой инструмент.

## Чарты и релизы

`chart` (чарт) — это пакет Helm: набор шаблонов манифестов и настройки по умолчанию. Эти настройки называются `values`; переопределяя их, вы конфигурируете чарт.

`release` (релиз) — один установленный экземпляр чарта. У него есть имя и namespace. Каждое изменение релиза Helm фиксирует как новую `revision` (ревизию) и хранит эти записи в Secret-объектах в namespace релиза.

В Terraform один ресурс `helm_release` соответствует одному релизу. Код Helm встроен в сам провайдер, поэтому Helm CLI не нужен.

Урок написан для провайдера Helm версии 3.3. В третьей версии изменился синтаксис: `kubernetes` и `set` теперь атрибуты со знаком `=`, а не вложенные блоки. Во многих старых примерах в интернете встречается блочный синтаксис v2 — `kubernetes { ... }` и `set { ... }`. С v3 он не работает.

## Подключите провайдер

Откройте `terraform.tf` и добавьте в `required_providers` запись `helm` рядом с `kubernetes`:

```hcl
terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 3.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 3.3"
    }
  }
}
```

Блоки `provider`, как и в вашем первом проекте, живут в `main.tf`. Добавьте туда блок `provider "helm"` рядом с `provider "kubernetes"`. Он указывает на тот же kubeconfig, так что оба провайдера работают с одним и тем же кластером через его текущий контекст:

```hcl
provider "helm" {
  kubernetes = {
    config_path = "~/.kube/config"
  }
}
```

Обратите внимание на `=` после `kubernetes`: параметры подключения задаются объектом, а не блоком.

Скачайте новый провайдер:

```sh
terraform init
```

## Установите чарт

В уроке используется `podinfo` — крошечное веб-приложение, созданное специально для демонстраций Kubernetes. Его чарт опубликован в HTTPS-репозитории чартов по адресу `https://stefanprodan.github.io/podinfo`. Облако ему не нужно: он запускается в kind или Docker Desktop.

Добавьте этот ресурс в `main.tf`:

```hcl
resource "helm_release" "podinfo" {
  name       = "podinfo"
  repository = "https://stefanprodan.github.io/podinfo"
  chart      = "podinfo"
  version    = "6.15.0"
  namespace  = module.web.namespace

  values = [
    yamlencode({
      replicaCount = 2
      ui = {
        message = "Hello from Terraform"
      }
    })
  ]

  set = [
    {
      name  = "ui.color"
      value = "#2f855a"
    }
  ]
}
```

Вот что делает каждый аргумент:

- `name` — имя релиза. Этот чарт называет Deployment и Service по имени релиза, поэтому оба получат имя `podinfo`.
- `repository` и `chart` указывают, откуда скачать чарт. Выполнять `helm repo add` не нужно.
- `version` фиксирует версию чарта — так же, как тег фиксирует образ. Без неё Terraform установит последнюю версию на момент apply, и результат будет меняться со временем.
- `namespace` берёт значение из output `namespace` модуля `web`, поэтому релиз попадёт в `demo`. Эта ссылка заодно создаёт зависимость: output получает значение от ресурса namespace внутри модуля. Значит, Terraform создаст namespace раньше релиза, а при удалении сначала удалит релиз и только потом namespace.
- `values` — список YAML-документов, как файлы `-f` у `helm install`. Встроенная функция `yamlencode` превращает HCL-объект в YAML, поэтому values можно писать на обычном HCL и использовать в них ссылки и переменные.
- `set` переопределяет одно значение по его пути, как `--set` в командной строке. Это список объектов.

Terraform объединяет документы из `values` по порядку, а затем поверх них применяет каждую запись `set`. Основные настройки задавайте через `values`, а `set` оставьте для отдельных значений, которые приходят из других ресурсов или переменных.

Запустите plan:

```sh
terraform plan
```

План добавляет один ресурс — `helm_release.podinfo`. Ни Deployment, ни Service в нём нет: эти объекты находятся внутри чарта, и Terraform не видит их как отдельные ресурсы.

Примените изменение:

```sh
terraform apply
```

По умолчанию apply ждёт, пока объекты релиза станут готовы, как `helm install --wait`. Проверьте результат через kubectl:

```sh
kubectl get deployment,service -n demo
```

Рядом с `web` из прошлых уроков появятся Deployment `podinfo` с двумя готовыми подами и Service `podinfo`. Чтобы открыть приложение, пробросьте порт:

```sh
kubectl port-forward -n demo service/podinfo 9898:9898
```

Откройте в браузере `http://localhost:9898`. На странице будет ваше сообщение в выбранном цвете. Чтобы остановить проброс порта, нажмите `Ctrl+C`.

Если у вас установлен Helm CLI, команда `helm list -n demo` покажет тот же релиз. Этот шаг необязателен.

## Прочитайте атрибуты релиза

После apply ресурс отдаёт состояние релиза. `status` — статус в терминах Helm, например `deployed` или `failed`. `metadata` — объект с подробностями о релизе, в том числе `version` (версия чарта), `app_version` и `revision`.

Добавьте в `outputs.tf` такие outputs:

```hcl
output "podinfo_status" {
  value = helm_release.podinfo.status
}

output "podinfo_chart_version" {
  value = helm_release.podinfo.metadata.version
}

output "podinfo_revision" {
  value = helm_release.podinfo.metadata.revision
}
```

Снова выполните `terraform apply`. В кластере ничего не изменится, а Terraform выведет outputs: статус `deployed`, версию чарта `6.15.0` и ревизию `1`.

Теперь замените в `main.tf` значение `replicaCount` на `3` и запустите `terraform plan`. План обновит `helm_release.podinfo` на месте и покажет изменённые `values`. После `terraform apply` Helm обновит релиз, а output с ревизией станет равен `2`.

## Что отслеживает Terraform

Для чарта в state хранится один объект — релиз: его имя, чарт, версия, values и метаданные. Ни Deployment, ни Service, ни другие объекты, которые рендерит чарт, в state не попадают.

Когда Terraform обновляет state, провайдер читает запись о релизе из Helm. Живые объекты с чартом он не сравнивает. Проверьте это сами:

```sh
kubectl scale deployment podinfo -n demo --replicas=5
terraform plan
```

План сообщит, что изменений нет, хотя у Deployment теперь пять реплик вместо трёх. Deployment, которым управляет отдельный ресурс Terraform, например `module.web.kubernetes_deployment_v1.this`, показал бы этот drift в плане. Внутри Helm-релиза такой же drift для Terraform невидим.

Изменения самого релиза Terraform при этом замечает. Если кто-то удалит релиз, следующий plan установит его заново. Если вы поменяете в коде values или версию чарта, plan обновит релиз.

Чтобы устранить drift внутри релиза, измените что-нибудь в самом релизе или исправьте объект вручную. Здесь достаточно вернуть прежнее число реплик:

```sh
kubectl scale deployment podinfo -n demo --replicas=3
```

У провайдера есть экспериментальная настройка `manifest`. Она сохраняет отрендеренные манифесты в state, и plan показывает, какие объекты затронет изменение. По умолчанию она выключена.

## Когда устанавливать Helm-чарты через Terraform

Terraform работает, только когда его кто-то запускает, а контроллеры Kubernetes сверяют состояние непрерывно. От этого различия и зависит, какому инструменту отдать релиз.

Terraform подходит для платформенных компонентов:

- ingress-контроллера, cert-manager или стека мониторинга;
- чартов, которые ставятся один раз на кластер и меняются редко;
- чартов, values которых берутся из других ресурсов Terraform — например, namespace, DNS-имени или облачной роли, созданных в том же коде.

Для приложений вашей команды обычно лучше подходит обычный Helm в CI или GitOps-инструмент, такой как `Argo CD` или `Flux`:

- приложения выкатываются по многу раз в день, и полный Terraform plan на каждый релиз — это медленно;
- GitOps-контроллеры, как и любые контроллеры Kubernetes, сверяют состояние непрерывно: они замечают и исправляют drift внутри релиза, чего Terraform не делает;
- разработчики видят статус синхронизации и историю по каждому приложению.

Часто эти подходы сочетают. Terraform устанавливает платформенные компоненты и сам Argo CD или Flux, а приложения дальше выкатывает GitOps.

Что бы вы ни выбрали, у каждого релиза должен быть один владелец. Не запускайте `helm upgrade` и не натравливайте Argo CD на релиз, которым управляет Terraform: инструменты будут перезаписывать изменения друг друга, и state Terraform перестанет соответствовать кластеру.

## Что почитать

- [Провайдер Helm в Terraform Registry](https://registry.terraform.io/providers/hashicorp/helm/latest/docs)
- [Справочник по ресурсу `helm_release`](https://registry.terraform.io/providers/hashicorp/helm/latest/docs/resources/release)
- [Руководство по переходу на провайдер Helm v3](https://registry.terraform.io/providers/hashicorp/helm/latest/docs/guides/v3-upgrade-guide)
- [podinfo на GitHub](https://github.com/stefanprodan/podinfo)
