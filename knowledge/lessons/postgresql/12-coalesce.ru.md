---
slug: postgresql/coalesce
title: COALESCE
description: Подставляйте запасные значения с помощью COALESCE для отсутствующего текста, вычислений с NULL, результатов агрегатных функций и полей JSONB.
---

`NULL` обозначает отсутствующее или неизвестное значение SQL. `COALESCE` возвращает первое значение из списка, отличное от null, и тем самым позволяет запросу подставить запасное значение, когда нужного нет:

```sql
SELECT COALESCE(NULL, 'Guest') AS display_name;
-- Guest

SELECT COALESCE(NULL, 'Short description', 'No description') AS description;
-- Short description

SELECT COALESCE(NULL::text, NULL::text) AS missing;
-- NULL
```

Порядок аргументов задаёт приоритет. Если все аргументы равны null, результат тоже null. На этот случай запасное значение даёт последний аргумент, отличный от null. В `SELECT` это меняет лишь возвращаемое значение, а хранимые данные остаются прежними.

COALESCE проверяет только на null, поэтому ноль, пустая строка и false остаются полноценными результатами:

```sql
SELECT
  COALESCE(0, 100) AS amount,             -- 0
  COALESCE('', 'Guest') AS display_name,  -- empty string
  COALESCE(false, true) AS enabled;       -- false
```

## Создайте демонстрационные данные

Подключитесь к `postgresql_course` через `psql`. Выполните эти операторы в одном сеансе; временные таблицы исчезнут, когда вы отключитесь:

```sql
CREATE TEMP TABLE coalesce_customers (
  id integer PRIMARY KEY,
  name text NOT NULL,
  nickname text
);

CREATE TEMP TABLE coalesce_orders (
  id integer PRIMARY KEY,
  customer_id integer NOT NULL,
  subtotal numeric(10, 2) NOT NULL,
  discount numeric(10, 2)
);

INSERT INTO coalesce_customers (id, name, nickname)
VALUES
  (1, 'Alice', 'Ali'),
  (2, 'Bob', NULL),
  (3, 'Cara', '');

INSERT INTO coalesce_orders (id, customer_id, subtotal, discount)
VALUES
  (101, 1, 100.00, 10.00),
  (102, 1, 50.00, NULL),
  (103, 2, 80.00, 0.00);
```

В этом примере null в поле скидки означает, что скидка не применялась. Именно это правило делает ноль уместным запасным значением. Если бы null означал неизвестную скидку, то, приравняв его к нулю, мы исказили бы смысл данных.

## Выберите значение для отображения

Если у покупателя есть псевдоним, покажите его, а если нет — имя:

```sql
SELECT id, COALESCE(nickname, name) AS display_name
FROM coalesce_customers
ORDER BY id;
```

Alice отображается как `Ali`, Bob — как `Bob`, а Cara — как пустая строка. Псевдоним Cara не равен null, поэтому COALESCE его и оставляет.

Если приложение считает пустой псевдоним тоже отсутствующим, превратите это конкретное значение в null с помощью `NULLIF`, прежде чем выбирать запасной вариант. `NULLIF(value, '')` возвращает null, когда значение — пустая строка, а в остальных случаях возвращает само значение:

```sql
SELECT id, COALESCE(NULLIF(nickname, ''), name) AS display_name
FROM coalesce_customers
ORDER BY id;
```

Теперь отображаемые имена — `Ali`, `Bob` и `Cara`. Так обрабатывается только в точности пустая строка: псевдоним из одних пробелов по-прежнему остаётся значением, отличным от null.

## Используйте запасное значение в вычислениях

Вычитание скидки, равной null, даёт null. Замените необязательное входное значение до вычисления:

```sql
SELECT
  id,
  subtotal - discount AS raw_total,
  subtotal - COALESCE(discount, 0) AS payable
FROM coalesce_orders
ORDER BY id;
```

| id | raw_total | payable |
| --- | --- | --- |
| 101 | 90.00 | 90.00 |
| 102 | NULL | 50.00 |
| 103 | 80.00 | 80.00 |

Важно, где стоит COALESCE. `COALESCE(subtotal - discount, 0)` вернул бы для заказа `102` ноль, потеряв известную сумму `50.00`. Если сначала заменить отсутствующую скидку, эта сумма сохранится.

## Возвращайте ноль для пустого итога

Агрегатная функция (`aggregate`) объединяет значения из нескольких строк в один результат. `sum` пропускает входные значения, равные null, и возвращает null, если ни одного значения, отличного от null, не нашлось, — в том числе когда под условие не подошла ни одна строка. Если отчёт должен показывать ноль, примените COALESCE к результату агрегатной функции:

```sql
SELECT COALESCE(sum(subtotal), 0) AS total
FROM coalesce_orders
WHERE customer_id = 999;
-- 0
```

`sum(COALESCE(subtotal, 0))` здесь всё равно вернёт null: нет ни одной входной строки, к которой можно было бы применить внутренний COALESCE. Обёртка вокруг суммы справляется именно с отсутствующим результатом агрегатной функции.

`LEFT JOIN` сохраняет каждую строку левой таблицы, даже если в правой для неё нет пары. Столбцы правой стороны у таких строк равны null. Используйте его, чтобы включить покупателей без заказов, а затем подставьте запасное значение для их итога:

```sql
SELECT
  c.name,
  COALESCE(sum(o.subtotal - COALESCE(o.discount, 0)), 0) AS payable
FROM coalesce_customers AS c
LEFT JOIN coalesce_orders AS o ON o.customer_id = c.id
GROUP BY c.id, c.name
ORDER BY c.id;
```

| name | payable |
| --- | --- |
| Alice | 140.00 |
| Bob | 80.00 |
| Cara | 0 |

Внутренний COALESCE отвечает за отсутствующие скидки, внешний — за отсутствующую сумму. Cara попадает в результат благодаря левому соединению. Сам по себе COALESCE не может создать строку, которую запрос не возвращает.

Замена входных null может изменить и статистический показатель. `avg(discount)` не учитывает скидки, равные null, а `avg(COALESCE(discount, 0))` учитывает их как нули. Выбирайте вариант в зависимости от того, что означает null в данном вычислении.

## Подставьте запасное значение для поля JSONB

В уроке о JSONB мы познакомились с оператором `->>`, который извлекает поле как текст SQL. Отсутствующий ключ или значение JSON null этот оператор превращает в SQL null, так что COALESCE может подставить значение для отображения:

```sql
SELECT
  COALESCE('{}'::jsonb ->> 'label', 'Unnamed') AS missing_label,
  COALESCE('{"label": null}'::jsonb ->> 'label', 'Unnamed') AS null_label;
-- Both columns contain Unnamed.
```

С `->` сохранённый JSON null остаётся значением JSONB и не заставляет COALESCE перейти к запасному варианту. Пустое текстовое значение, полученное через `->>`, тоже не равно null.

## Следите за совместимостью типов аргументов

Все аргументы должны приводиться к одному общему типу результата. Для числового результата используйте числовое запасное значение, а если результату нужна текстовая метка, приведите число к тексту:

```sql
SELECT COALESCE(NULL::numeric, 0) AS amount;
-- 0

SELECT COALESCE(42::text, 'Unknown') AS reference;
-- 42 as text
```

Синтаксис `::type` приводит значение к типу SQL. `COALESCE(42, 'Unknown')` завершается ошибкой, потому что PostgreSQL пытается преобразовать `'Unknown'` в целое число. Типы он определяет ещё до выполнения, даже если первый аргумент не равен null.

Во время выполнения COALESCE прекращает вычислять аргументы, как только находит значение, отличное от null. Однако ошибки в выражении, которое ему всё-таки приходится вычислить, — например, недопустимое приведение типа или деление на ноль, — он не перехватывает.

## Официальные ресурсы

- [COALESCE и NULLIF](https://www.postgresql.org/docs/18/functions-conditional.html#FUNCTIONS-COALESCE-NVL-IFNULL)
- [Агрегатные функции](https://www.postgresql.org/docs/18/functions-aggregate.html)
- [Общие типы результата](https://www.postgresql.org/docs/18/typeconv-union-case.html)
- [Функции и операторы JSON](https://www.postgresql.org/docs/18/functions-json.html)

## Практика

Используйте временные таблицы из этого урока в том же сеансе `psql`:

1. Выведите отображаемое имя каждого покупателя, подставляя `name` вместо псевдонима, если тот равен null или пуст.
2. Вычислите сумму к оплате по каждому заказу, считая отсутствующую скидку нулевой. Сравните её с `COALESCE(subtotal - discount, 0)` и объясните разницу для заказа `102`.
3. Выведите общую сумму к оплате для каждого покупателя, включая покупателей без заказов.
4. Запросите сумму промежуточных итогов для покупателя `999`. Сравните простую сумму, `sum(COALESCE(subtotal, 0))` и `COALESCE(sum(subtotal), 0)`.

Задание выполнено, когда отображаемые имена — `Ali`, `Bob` и `Cara`, суммы по заказам — `90.00`, `50.00` и `80.00`, а итоги по покупателям — `140.00`, `80.00` и ноль. Для покупателя `999` ноль возвращает только сумма, обёрнутая в COALESCE; две другие суммы возвращают null. Временные таблицы удаляются, когда вы выходите из `psql`.
