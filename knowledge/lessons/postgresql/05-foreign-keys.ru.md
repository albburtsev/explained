---
slug: postgresql/foreign-keys
title: Внешние ключи
description: Обеспечивайте связи между таблицами, выбирайте действия при удалении и изменении и добавляйте внешние ключи к уже существующим данным.
---

**Внешний ключ** требует, чтобы непустое значение в одной таблице совпадало с ключом в другой. Таблицу, в которой хранится ссылка, называют **ссылающейся**, а таблицу, на которую она указывает, — **целевой**. Внешний ключ может ссылаться и на ту же самую таблицу.

Например, заказ должен ссылаться на существующего клиента. Одной проверки в приложении для этого мало: между проверкой и вставкой другая транзакция может успеть удалить клиента. Внешний ключ заставляет PostgreSQL поддерживать связь и при параллельных изменениях.

## Определение связи

Сначала создайте целевую таблицу. У её целевых столбцов должен быть первичный ключ или ограничение уникальности, объявленные как `NOT DEFERRABLE`, либо уникальный индекс, охватывающий все строки:

```sql
CREATE TABLE customers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE
);

CREATE TABLE orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL,
  total numeric(12, 2) NOT NULL CHECK (total >= 0),
  CONSTRAINT orders_customer_fk
    FOREIGN KEY (customer_id)
    REFERENCES customers (id)
    ON DELETE RESTRICT
);
```

Здесь `orders` — ссылающаяся таблица, а `customers` — целевая. Если дать ограничению имя, ошибки и последующие изменения схемы будет легче понять. Поскольку `customers.id` — первичный ключ, запись `REFERENCES customers` без `(id)` означала бы то же самое, но с явно указанным столбцом код часто читается яснее.

Проверьте гарантию на деле:

```sql
INSERT INTO customers (email)
VALUES ('ada@example.com')
RETURNING id;

-- Replace 1 with the returned id.
INSERT INTO orders (customer_id, total)
VALUES (1, 49.90);

-- Rejected because customer 999999 does not exist.
INSERT INTO orders (customer_id, total)
VALUES (999999, 10.00);
```

Сам по себе внешний ключ не делает связь обязательной. Значение NULL в ссылающемся столбце обычно освобождается от проверки на совпадение. Если каждый заказ обязан принадлежать клиенту, добавьте `NOT NULL`, как в примере выше.

## Что происходит с целевыми строками

`ON DELETE` указывает, что должен делать PostgreSQL, когда у удаляемой целевой строки ещё остаются зависимые строки:

| Действие | Результат | Когда уместно |
| --- | --- | --- |
| `NO ACTION` | Отклоняет изменение, если в момент проверки ограничение всё ещё нарушено; действует по умолчанию. | Приложение должно разрешать связь явно. |
| `RESTRICT` | Отклоняет изменение сразу; проверку нельзя отложить. | Самостоятельные записи никогда не должны удаляться неявно. |
| `CASCADE` | Удаляет и ссылающиеся строки. | Ссылающиеся строки — составные части, которые вне целевой строки не имеют смысла. |
| `SET NULL` | Обнуляет ссылку. | Связь необязательна, и ссылающийся столбец допускает NULL. |
| `SET DEFAULT` | Заменяет ссылку значением столбца по умолчанию. | Значение по умолчанию указывает на существующую целевую строку или равно NULL. |

Используйте `CASCADE`, когда зависимые строки принадлежат целевой строке. Удаление заказа вполне может удалить его позиции, а вот при удалении клиента историю заказов обычно следует сохранить. Сверьтесь с бизнес-правилом: каскад может удалить очень много строк.

`ON UPDATE` принимает те же действия для изменений целевого ключа. Сгенерированные идентификаторы меняются редко. Если же ключ — это бизнес-значение, которое может меняться, `ON UPDATE CASCADE` скопирует новое значение в ссылающиеся строки.

## Связи по нескольким столбцам

**Составной внешний ключ** использует несколько столбцов вместе. Если несколько тенантов пользуются общими таблицами, включите идентификатор тенанта в ключ с обеих сторон, чтобы нельзя было сослаться на данные чужого тенанта:

```sql
CREATE TABLE projects (
  tenant_id bigint NOT NULL,
  project_code text NOT NULL,
  name text NOT NULL,
  PRIMARY KEY (tenant_id, project_code)
);

CREATE TABLE tasks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id bigint NOT NULL,
  project_code text NOT NULL,
  title text NOT NULL,
  CONSTRAINT tasks_project_fk
    FOREIGN KEY (tenant_id, project_code)
    REFERENCES projects (tenant_id, project_code)
    ON DELETE CASCADE
);
```

С обеих сторон должно быть одинаковое число столбцов, перечисленных в соответствующем порядке и имеющих совместимые типы. По умолчанию действует `MATCH SIMPLE`: строка не проверяется, если хотя бы один ссылающийся столбец равен NULL. Если связь обязательна, поставьте `NOT NULL` на каждый столбец ключа. Для необязательной связи `MATCH FULL` требует, чтобы либо все столбцы ключа были NULL, либо ключ совпадал целиком.

## Отложенная проверка внутри транзакции

По умолчанию внешний ключ имеет свойство `NOT DEFERRABLE` и проверяется после каждого оператора. Откладываемое ограничение может временно допустить промежуточное состояние при условии, что связь станет корректной до фиксации транзакции.

Например, иерархии сотрудников, ссылающейся на саму себя, могут понадобиться две отдельные вставки, хотя первый сотрудник указывает второго как своего руководителя:

```sql
CREATE TABLE employees (
  id bigint PRIMARY KEY,
  name text NOT NULL,
  manager_id bigint,
  CONSTRAINT employees_manager_fk
    FOREIGN KEY (manager_id)
    REFERENCES employees (id)
    DEFERRABLE INITIALLY IMMEDIATE
);

BEGIN;
SET CONSTRAINTS employees_manager_fk DEFERRED;

INSERT INTO employees (id, name, manager_id)
VALUES (1, 'Ada', 2);

INSERT INTO employees (id, name, manager_id)
VALUES (2, 'Grace', NULL);

COMMIT;
```

К моменту фиксации руководитель `2` уже существует, поэтому связь корректна. Без откладывания первая вставка завершилась бы ошибкой. Предпочитайте немедленные проверки, если временная несогласованность не нужна по-настоящему: отложенное нарушение приводит к провалу всей фиксации. Чтобы проверить ограничение раньше, используйте `SET CONSTRAINTS ... IMMEDIATE`.

## Индекс в поддержку связи

**Индекс** помогает PostgreSQL находить строки, не просматривая всю таблицу. У целевого ключа индекс уже есть — он нужен для обеспечения уникальности. А вот ссылающиеся столбцы PostgreSQL **не** индексирует автоматически, поэтому поиск зависимых строк при удалении или изменении ключа может обходиться дорого. Индекс поможет и запросам, которые соединяют или фильтруют по этим столбцам.

Для первого примера обычно полезен такой вспомогательный индекс:

```sql
CREATE INDEX orders_customer_id_idx ON orders (customer_id);
```

Внешний ключ работает корректно и без этого индекса. Добавляйте его, когда ускорение поиска оправдывает затраты на хранение и на запись. Как измерить этот компромисс, объясняется в уроке об индексах.

## Внешний ключ для существующих данных

Этот пример миграции предполагает, что `customers` и `orders` существуют, `customers.id` — первичный ключ, а ограничение `orders_customer_fk` ещё не определено. Если вы уже создали его выше, пропустите пример.

Обычная команда `ALTER TABLE ... ADD CONSTRAINT` проверяет все существующие строки. `NOT VALID` пропускает эту начальную проверку, но при этом обеспечивает корректность новых ссылок. Добавление ограничения всё равно захватывает блокировки, которые могут задержать параллельную запись:

```sql
ALTER TABLE orders
  ADD CONSTRAINT orders_customer_fk
  FOREIGN KEY (customer_id)
  REFERENCES customers (id)
  ON DELETE RESTRICT
  NOT VALID;
```

Найдите и исправьте уже существующие осиротевшие строки, а затем отдельно проверьте ограничение:

```sql
SELECT o.id, o.customer_id
FROM orders AS o
LEFT JOIN customers AS c ON c.id = o.customer_id
WHERE o.customer_id IS NOT NULL
  AND c.id IS NULL;

ALTER TABLE orders
  VALIDATE CONSTRAINT orders_customer_fk;
```

Запрос находит непустые ссылки, которым не соответствует ни один клиент. Проверка доказывает, что связь соблюдают и существующие строки; включите её в план миграции.

## Официальные ресурсы

- [PostgreSQL: внешние ключи](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)
- [PostgreSQL: CREATE TABLE](https://www.postgresql.org/docs/current/sql-createtable.html)
- [PostgreSQL: ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [PostgreSQL: SET CONSTRAINTS](https://www.postgresql.org/docs/current/sql-set-constraints.html)

## Практика

Создайте две локальные таблицы без связи между ними:

```sql
DROP TABLE IF EXISTS practice_articles;
DROP TABLE IF EXISTS practice_authors;

CREATE TABLE practice_authors (
  id bigint PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE practice_articles (
  id bigint PRIMARY KEY,
  author_id bigint NOT NULL,
  title text NOT NULL
);
```

Постройте связь самостоятельно:

1. Добавьте внешний ключ `practice_articles_author_fk` от `practice_articles.author_id` к `practice_authors.id` с `ON DELETE RESTRICT`.
2. Добавьте индекс, ускоряющий поиск по ссылающемуся столбцу.
3. Вставьте автора `1` и статью, которая ссылается на этого автора.
4. Попробуйте вставить статью для автора `999`, а затем попробуйте удалить автора `1`.
5. С помощью `\d practice_articles` изучите и ограничение, и вспомогательный индекс.

Задание выполнено, когда обе операции, нарушающие связь, отклонены, а корректные строки остались на месте. При уборке удаляйте дочернюю таблицу раньше родительской.
