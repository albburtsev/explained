---
slug: terraform/teamwork
title: Работа в команде
description: Перенесите state в кластер с помощью backend kubernetes, посмотрите на блокировку state в действии и проведите ревью сохранённого плана так, как это делает команда в pull request.
---

До сих пор state жил в файле `terraform.tfstate` рядом с кодом. Пока Terraform запускаете только вы, это работает. В команде такая схема быстро ломается. В этом уроке вы перенесёте state проекта `terraform-course` в кластер, увидите, как Terraform не даёт двум запускам столкнуться, и разберётесь, как команда проверяет план до того, как его кто-нибудь применит.

## Почему локальный state не годится для команды

Представьте, что вы с коллегой работаете над одной и той же конфигурацией, и у каждого свой `terraform.tfstate`:

- State коллеги ничего не знает об объектах, которые создали вы. Его план попытается создать их заново или пропустит изменения, которые вы уже применили.
- Два человека могут запустить `terraform apply` одновременно. Оба прочитают один и тот же устаревший state, оба изменят реальные объекты, и победит тот, кто запишет результат последним.
- Закоммитить state в Git — не выход. В state нередко лежат секреты в открытом виде, а Git никак не мешает двум `apply` идти одновременно.

Kubernetes решает ту же задачу единым общим хранилищем. Каждый контроллер и каждый пользователь `kubectl` обращается к одному API-серверу и одному etcd, и ни у кого нет личной копии состояния кластера. Terraform нужно то же самое: одна копия state в общем месте и способ сделать так, чтобы менять её мог только один запуск за раз.

## Backends и remote state

`backend` определяет, где Terraform хранит state. По умолчанию используется backend `local` — он и записывает тот самый `terraform.tfstate`, с которым вы работали до сих пор. Другие backends хранят state в общем месте. Такой state называют `remote state`.

Команды обычно выбирают backend под свою платформу: `s3` в AWS, `gcs` в Google Cloud или `azurerm` в Azure. Есть и другой вариант — HCP Terraform; к нему подключаются блоком `cloud` вместо блока `backend`. Как правило, всё это один раз настраивает платформенная команда. От разработчика обычно требуется лишь читать блок backend и запускать те же команды, что и раньше.

Backend настраивается внутри блока `terraform`. Читая такой блок, помните о двух правилах:

- В конфигурации может быть не больше одного backend.
- В блоке backend нельзя использовать переменные, locals или data sources: все значения записываются в нём напрямую.

## Переносим state в кластер

Чтобы попробовать remote state, облачный аккаунт не нужен. В Terraform встроен backend `kubernetes`: он хранит state в Kubernetes Secret, а в качестве блокировки использует объект Lease.

Откройте `terraform.tf` и добавьте в блок `terraform` блок `backend`:

```hcl
terraform {
  # required_providers { ... } stays as it is

  backend "kubernetes" {
    secret_suffix = "terraform-course"
    config_path   = "~/.kube/config"
  }
}
```

- `secret_suffix` — единственный обязательный аргумент. Terraform называет Secret по шаблону `tfstate-<workspace>-<secret_suffix>`. Ваш workspace называется `default`, поэтому Secret получит имя `tfstate-default-terraform-course`.
- `config_path` указывает на kubeconfig, как и в блоке провайдера. Backend берёт из него текущий контекст и поэтому обращается к тому же локальному кластеру.
- Аргумент `namespace` не задан, поэтому Secret попадёт в namespace `default`. Не храните state в `demo`: этим namespace управляет сама конфигурация, и `terraform destroy` удалит state вместе с ним.

Пока новый backend не настроен, остальные команды работать не будут. Запустите `init` и попросите его скопировать существующий state:

```sh
terraform init -migrate-state
```

Terraform найдёт локальный state и спросит, копировать ли его:

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

Ответьте `yes`. Теперь убедитесь, что state оказался в кластере:

```sh
kubectl get secrets -n default -l tfstate=true
terraform state list
terraform plan
```

Вы увидите один Secret, тот же список ресурсов, что и раньше, и `No changes.` в плане. Отныне Terraform читает и записывает state только в кластере. Удалите старые локальные копии, чтобы никто не воспользовался ими по ошибке:

```sh
rm -f terraform.tfstate terraform.tfstate.backup
```

Теперь state защищён ровно настолько, насколько защищён Secret. Backend сжимает его через gzip, но не шифрует. Любой, кто может читать Secrets в этом namespace, прочитает и весь state:

```sh
kubectl get secret tfstate-default-terraform-course -n default \
  -o jsonpath='{.data.tfstate}' | base64 -d | gunzip | head -n 5
```

Это верно для любого backend. Команды защищают state правами доступа к бакету, к storage account или к namespace.

## Смотрим на блокировку state

Благодаря `state locking` (блокировке state) записывать state в каждый момент может только один запуск Terraform. Если backend поддерживает блокировку, Terraform сам захватывает её перед любой операцией, которая может изменить state. Никакого сообщения об этом он не выводит.

Backend `kubernetes` блокирует state с помощью Lease с именем `lock-<имя Secret>`. Контроллеры Kubernetes точно так же используют объекты Lease для выбора лидера: работу выполняет тот, кто держит Lease.

Это можно увидеть своими глазами. Откройте два терминала в каталоге `terraform-course`. В первом запустите консоль и не закрывайте её — пока она работает, блокировка остаётся за ней:

```sh
terraform console
```

Во втором терминале посмотрите на Lease, а затем попробуйте построить план:

```sh
kubectl get leases -n default
terraform plan
```

В колонке `HOLDER` у `lock-tfstate-default-terraform-course` виден идентификатор блокировки. А `plan` сразу же останавливается:

```text
│ Error: Error acquiring the state lock
│
│ Error message: the state is already locked by another terraform client
│ Lock Info:
│   ID:        3f6c2a1e-8d7b-4c59-9a0e-2b4f7d1c6e85
```

Полное сообщение показывает ещё и то, кто держит блокировку и с какого момента. Введите `exit` в первом терминале — и `plan` снова заработает. В настоящей команде другим запуском обычно оказывается коллега или задача CI. Дождитесь, пока она завершится, или добавьте `-lock-timeout=60s`, и Terraform будет ждать до минуты.

У этого Lease нет срока действия. Если запуск упадёт, блокировка может так и остаться. Снять её можно командой `terraform force-unlock LOCK_ID`. Пользуйтесь ею только для собственной блокировки, оставшейся после сбоя. Если снять чужую блокировку, два запуска смогут писать state одновременно.

## Что хранить в Git

Одни файлы из каталога проекта должны попасть в Git, другие — никогда. Первые три строки в `.gitignore` вы добавили ещё в уроке о state. Допишите `tfplan`, чтобы файл выглядел так:

```text
.terraform/
*.tfstate
*.tfstate.*
tfplan
```

- В `.terraform/` лежат скачанные провайдеры, модули и настройки backend. `terraform init` создаёт этот каталог заново.
- `*.tfstate` и `*.tfstate.*` отсекают локальный state и его резервные копии. С remote backend таких файлов появляться не должно, но правило подстрахует, если кто-то запустит Terraform без backend.
- `tfplan` — файл сохранённого плана, который вы создадите ниже. В нём могут оказаться секреты в открытом виде.

А вот `.terraform.lock.hcl` коммитить нужно. Этот `dependency lock file` фиксирует точные версии провайдеров и их контрольные суммы, выбранные при `init`. Когда он лежит в Git, CI и все коллеги используют одни и те же сборки провайдеров. Изменение этого файла попадает в pull request, и команда проверяет его на ревью наравне с остальным кодом.

## Как устроен процесс с pull request

Команды редко запускают `terraform apply` с ноутбука. Обычный процесс напоминает ревью вывода `kubectl diff`:

1. Вы меняете файлы `.tf` в отдельной ветке и открываете pull request.
2. CI проверяет код и строит план:
   - `terraform fmt -check -recursive` завершается с ошибкой, если хотя бы один файл, включая файлы в каталогах модулей, не отформатирован. Чтобы исправить это, запустите локально `terraform fmt -recursive`.
   - `terraform validate` проверяет синтаксис, ссылки и типы, не обращаясь к кластеру.
   - `terraform plan` сравнивает код с remote state и реальными объектами.
3. CI публикует вывод плана комментарием в pull request.
4. Ревьюеры читают и код, и план. Именно план показывает, что произойдёт на самом деле.
5. После одобрения CI применяет изменение. Он работает с тем же remote state и той же блокировкой, что и все остальные.

Инструменты бывают разные, но идея одна: никто не применяет изменение, план которого команда не видела.

### Применяйте ровно то, что прошло ревью

Обычный `terraform apply` строит новый план. Если после ревью изменились state или кластер, этот новый план может отличаться от того, что был в pull request. Решение — `saved plan` (сохранённый план): вы записываете план в файл, а позже применяете именно этот файл.

Пройдите всю проверку локально. Сначала внесите небольшое изменение: добавьте `replicas = 3` в `terraform.tfvars`. Затем выполните:

```sh
terraform fmt -check -recursive
terraform validate
terraform plan -out=tfplan
```

Если все файлы отформатированы, `fmt -check` ничего не выводит. `validate` печатает `Success! The configuration is valid.` А план заканчивается подсказкой:

```text
Saved the plan to: tfplan

To perform exactly these actions, run the following command to apply:
    terraform apply "tfplan"
```

`terraform show tfplan` ещё раз выводит сохранённый план — так CI и публикует его в pull request. Теперь примените файл:

```sh
terraform apply tfplan
```

Подтверждения Terraform не спрашивает: сама передача файла плана считается одобрением, ведь план уже прошёл ревью. Выполните ту же команду ещё раз:

```sh
terraform apply tfplan
```

```text
│ Error: Saved plan is stale
│
│ The given plan file can no longer be applied because the state was changed by another operation after the plan was created.
```

Сохранённый план годится только для того state, из которого он построен. Если после ревью state хоть как-то изменился, Terraform откажется применять старый план, и понадобятся новый план и новое ревью.

## Как читать план на ревью

Каждый ресурс в плане начинается с маркера:

| Маркер | Значение |
| --- | --- |
| `+` | Создание |
| `~` | Изменение на месте |
| `-` | Удаление |
| `-/+` | Удаление, затем создание замены |
| `+/-` | Создание замены, затем удаление старого объекта |
| `<=` | Чтение data source |

Изменения на месте обычно безопасны, а вот замены требуют внимания. Замена происходит, когда меняется аргумент, который провайдер не умеет обновлять, — например, имя объекта Kubernetes. Допустим, кто-то записал `namespace = "demo-app"` в `terraform.tfvars`. Вот первая запись плана в сокращённом виде:

```text
  # module.web.kubernetes_namespace_v1.this must be replaced
-/+ resource "kubernetes_namespace_v1" "this" {
      ~ id = "demo" -> (known after apply)

      ~ metadata {
          ~ name = "demo" -> "demo-app" # forces replacement
        }
    }
```

В коде изменилась одна строка. План же показывает настоящую цену: Terraform удалит namespace `demo`, а вместе с ним Kubernetes удалит и все объекты внутри. Заменены будут и все ресурсы, которые берут namespace из модуля: Deployment и Service внутри `module.web`, ConfigMaps из урока о `count` и `for_each`, а также Helm-релиз. У каждого из них в плане своя запись `must be replaced`, и все они попадают в счётчик `to destroy` итоговой строки. Пока новые объекты не будут готовы, приложение недоступно.

Читайте план в таком порядке:

1. **Итоговая строка.** Любое число больше нуля в `to destroy` требует причины, которую вы понимаете.
2. **Замены.** Ищите `must be replaced` и `-/+`. Комментарий `# forces replacement` показывает, какой атрибут вызывает замену. Замена namespace, PersistentVolumeClaim или базы данных может обернуться потерей данных.
3. **Неожиданные удаления.** Ищите `will be destroyed`. Частые причины — переименованный ресурс, удалённый модуль или изменившийся ключ `for_each`. Terraform видит новый адрес и удаляет объект, который числился под старым.
4. **Изменения, которых никто не вносил.** Если план затрагивает объекты, к которым pull request не относится, значит, кто-то поменял кластер вручную или раньше применили другое изменение. Это тот самый drift, с которым вы познакомились в уроке о state.
5. **Чувствительные значения.** Значения, помеченные как sensitive, отображаются как `(sensitive value)`. Проверьте, что ни пароль, ни токен не попали в комментарий с планом открытым текстом. Файл плана и state всё равно хранят их в открытом виде, поэтому обращайтесь с обоими как с секретами.

Теперь вы умеете читать, писать и ревьюить Terraform-код в репозитории своей команды. Команды остаются прежними: `init`, `plan` и `apply`. Разница лишь в том, что в команде state живёт в общем backend, его защищает блокировка, а что изменится, решает план, прошедший ревью.
