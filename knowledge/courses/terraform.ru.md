---
slug: terraform
title: Terraform
description: Освойте Terraform глазами Kubernetes-разработчика — от plan и apply до state, модулей, Helm-чартов и командной работы — на локальном кластере.
---

`Terraform` — инструмент для подхода `infrastructure as code` (инфраструктура как код). Вы описываете нужную инфраструктуру в текстовых файлах, а Terraform создаёт, изменяет или удаляет реальные объекты, чтобы привести их в соответствие с описанием. С облаками, DNS, базами данных, мониторингом и Kubernetes он работает через плагины — `providers` (провайдеры).

Если вы знаете Kubernetes, многое покажется знакомым. Вы уже пишете декларативные манифесты и доверяете системе привести мир к желаемому состоянию. Terraform делает то же самое, но цикл у него другой. Контроллеры Kubernetes сверяют состояние непрерывно, а Terraform запускается только по вашей команде: сначала показывает `plan` — план изменений, — а затем вы выполняете `apply`. Всё, что ему известно о реальных объектах, он хранит не в etcd, а в файле `state`.

Курс рассчитан на разработчиков, а не на платформенных инженеров. Его цель — научить уверенно читать, писать и ревьюить Terraform-код в репозитории вашей команды. Облачный аккаунт не понадобится: вся практика идёт на локальном кластере Kubernetes, например в kind или Docker Desktop, через провайдеры Kubernetes и Helm.

## Чему вы научитесь

- Чем Terraform отличается от Kubernetes, Helm и kubectl и где место каждого из них.
- Как создать проект и пройти цикл `init`, `plan`, `apply` и `destroy`.
- Как читать и писать на HCL: блоки, ссылки и выражения.
- Как сделать конфигурацию гибкой с помощью переменных, outputs и locals.
- Что такое state, как Terraform замечает drift и как безопасно заглядывать в state.
- Как читать существующие объекты через data sources и в каком порядке Terraform применяет изменения.
- Как создавать много однотипных ресурсов с помощью `count` и `for_each`.
- Как переиспользовать код с помощью модулей.
- Как устанавливать Helm-чарты через Terraform.
- Как команда делит общий remote state и ревьюит планы перед применением.

## Официальные ресурсы

- [Документация Terraform](https://developer.hashicorp.com/terraform/docs)
- [Справочник по языку Terraform](https://developer.hashicorp.com/terraform/language)
- [Провайдер Kubernetes в Terraform Registry](https://registry.terraform.io/providers/hashicorp/kubernetes/latest/docs)
- [Провайдер Helm в Terraform Registry](https://registry.terraform.io/providers/hashicorp/helm/latest/docs)
