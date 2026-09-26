---
slug: postgresql/schemas
title: Схемы в Postgres
description: Упорядочивайте объекты PostgreSQL с помощью схем, полных имён и предсказуемого пути поиска.
---

**Схема** в PostgreSQL — это пространство имён, то есть группа именованных объектов внутри одной базы данных. В ней могут находиться таблицы, представления, типы, последовательности и функции. Одно подключение может обращаться к любой схеме своей базы данных, если у его роли есть на это право. Схемы не разделяют хранилище и не могут быть вложенными.

Схемы помогают разделить модули приложения, расширения или объекты с разными владельцами. Кроме того, они позволяют повторять имена: `sales.events` и `audit.events` — две разные таблицы в одной базе данных.

## Создание и просмотр схем

Создайте в `postgresql_course` два пространства имён:

```sql
CREATE SCHEMA course_app;
CREATE SCHEMA course_audit;
```

Владельцем новой схемы становится роль, выполнившая `CREATE SCHEMA`, если только предложение `AUTHORIZATION` не называет другую роль. Создайте по одной таблице в каждой схеме, указывая **полное имя** вида `schema.object`:

```sql
CREATE TABLE course_app.events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message text NOT NULL
);

CREATE TABLE course_audit.events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message text NOT NULL
);

INSERT INTO course_app.events (message)
VALUES ('application event');

INSERT INTO course_audit.events (message)
VALUES ('audit event');
```

Обе таблицы называются `events`, но друг от друга не зависят. Посмотрите на пространства имён и их таблицы с помощью команд `psql` из предыдущего урока:

```text
\dn
\dt course_app.*
\dt course_audit.*
```

Когда объект должен определяться однозначно, используйте полные имена:

```sql
SELECT * FROM course_app.events;
SELECT * FROM course_audit.events;
```

Имя вроде `course_app.events` выбирает схему и таблицу внутри текущей базы данных. К другой базе данных оно не подключается.

## Схема `public`

В новых базах данных обычно есть схема с именем `public`. В предыдущем уроке таблица `terminal_notes` была создана без указания схемы, поэтому PostgreSQL поместил её в текущую схему — в локальной установке это, как правило, `public`.

При пути поиска, заданном по умолчанию в настройке курса, эти команды обращаются к одной и той же таблице:

```sql
SELECT * FROM terminal_notes;
SELECT * FROM public.terminal_notes;
```

`public` — обычная схема, которая просто предоставляется по умолчанию. По мере роста проекта именованные схемы приложения помогают яснее выразить владение объектами и их организацию.

## Разрешение неполных имён через `search_path`

Когда оператор использует неполное имя, например `events`, PostgreSQL перебирает схемы в порядке, заданном `search_path`, и берёт первый подходящий объект. Посмотрите на заданный и фактический пути:

```sql
SHOW search_path;

SELECT
  current_schema(),
  current_schemas(true);
```

По умолчанию путь равен `"$user", public`. `$user` обозначает схему, названную по имени `current_user` — активной роли базы данных. PostgreSQL пропускает схемы, которые не существуют или к которым у роли нет права `USAGE`. `current_schema()` возвращает первую доступную схему из заданного пути. `current_schemas(true)` включает ещё и системные схемы, которые просматриваются неявно.

Измените путь для текущего сеанса:

```sql
SET search_path TO course_app, course_audit, public;

SELECT * FROM events;
-- Returns the row from course_app.events.
```

PostgreSQL первым находит `course_app.events`. Первая доступная схема в пути служит и местом назначения для `CREATE TABLE` без указания схемы:

```sql
CREATE TABLE settings (
  name text PRIMARY KEY,
  value text NOT NULL
);

SELECT current_schema();
-- course_app
```

Роли также нужно право `CREATE` в этой схеме. Без него создание завершится ошибкой: следующую схему PostgreSQL пробовать не станет.

Поменяйте местами первые два элемента пути, и то же неполное имя таблицы разрешится иначе:

```sql
SET search_path TO course_audit, course_app, public;

SELECT * FROM events;
-- Returns the row from course_audit.events.
```

Закончив эксперимент, верните сеансу заданное значение по умолчанию:

```sql
RESET search_path;
```

Схема системного каталога `pg_catalog` просматривается всегда. Если она не указана в пути явно, PostgreSQL просматривает её раньше явно перечисленных схем, чтобы встроенные типы и функции оставались доступными.

## Предсказуемое разрешение объектов

Неполное имя зависит от настроек сеанса. Указывайте полные имена в миграциях схемы, административных скриптах и в коде, где выбор не того объекта опасен. Если приложение полагается на `search_path`, задайте его явно и проверьте.

Роль с правом `CREATE` в какой-либо схеме может добавить объект, который другой запрос рассчитывает найти в совсем другой схеме. Если эта схема стоит в пути раньше, запрос молча обратится не к тому объекту. Не включайте в путь привилегированного сеанса схемы, в которые могут писать недоверенные роли.

## Осознанное перемещение и удаление объектов

Существующий объект можно перенести в другую схему, не пересоздавая его данные:

```sql
ALTER TABLE course_app.settings
SET SCHEMA course_audit;
```

Теперь полное имя таблицы — `course_audit.settings`. Перемещая или переименовывая опубликованный объект, одновременно обновляйте ссылки на него в приложении и в скриптах развёртывания.

По умолчанию `DROP SCHEMA` действует в режиме `RESTRICT` и отказывается удалять непустую схему:

```sql
DROP SCHEMA course_app;
-- ERROR: cannot drop schema course_app because other objects depend on it
```

`DROP SCHEMA course_app CASCADE` удаляет объекты схемы и может удалить зависящие от них объекты в других схемах. Прежде чем пользоваться этой командой, изучите и то и другое, особенно если база не одноразовая и не локальная.

## Официальные ресурсы

- [Схемы](https://www.postgresql.org/docs/current/ddl-schemas.html)
- [Настройка `search_path`](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-SEARCH-PATH)
- [`CREATE SCHEMA`](https://www.postgresql.org/docs/current/sql-createschema.html)
- [`ALTER TABLE`](https://www.postgresql.org/docs/current/sql-altertable.html)
- [`DROP SCHEMA`](https://www.postgresql.org/docs/current/sql-dropschema.html)

## Практика

Создайте две одноразовые схемы с одноимёнными таблицами:

```sql
DROP SCHEMA IF EXISTS practice_store CASCADE;
DROP SCHEMA IF EXISTS practice_audit CASCADE;

CREATE SCHEMA practice_store;
CREATE SCHEMA practice_audit;

CREATE TABLE practice_store.events (
  source text NOT NULL
);

CREATE TABLE practice_audit.events (
  source text NOT NULL
);

INSERT INTO practice_store.events VALUES ('store');
INSERT INTO practice_audit.events VALUES ('audit');
```

Выполните в `psql` следующие задания:

1. Выведите обе схемы и список таблиц в каждой из них.
2. Установите `search_path` в `practice_store, practice_audit, public`, затем выполните запрос к `events` без указания схемы и проверьте `current_schema()`.
3. Поменяйте местами первые два элемента пути и повторите запрос с неполным именем.
4. Пока первой в пути стоит `practice_audit`, создайте таблицу `settings` без указания схемы и определите, в какой схеме она оказалась.
5. Сбросьте путь и выполните запросы к обеим таблицам `events` по полным именам.
6. Попробуйте удалить `practice_store` без `CASCADE` и объясните ошибку.

Задание выполнено, когда запрос с неполным именем возвращает `store` или `audit` в зависимости от порядка схем в пути, а `settings` оказывается в `practice_audit`. Изучив содержимое практических схем, удалите обе командой `DROP SCHEMA ... CASCADE`.
