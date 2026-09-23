---
slug: postgresql/coalesce
title: COALESCE
description: Choose fallback values with COALESCE for missing text, nullable calculations, aggregate results, and JSONB fields.
tags:
  - postgresql
  - sql
  - databases
---

`NULL` represents a missing or unknown SQL value. `COALESCE` returns the first non-null value from a list, letting a query use a fallback when a value is missing:

```sql
SELECT COALESCE(NULL, 'Guest') AS display_name;
-- Guest

SELECT COALESCE(NULL, 'Short description', 'No description') AS description;
-- Short description

SELECT COALESCE(NULL::text, NULL::text) AS missing;
-- NULL
```

Argument order sets the priority. If every argument is null, the result is null. A non-null final argument supplies a fallback for that case. In a `SELECT`, this changes the returned value without updating the stored data.

COALESCE checks for null, so zero, an empty string, and false remain valid results:

```sql
SELECT
  COALESCE(0, 100) AS amount,             -- 0
  COALESCE('', 'Guest') AS display_name,  -- empty string
  COALESCE(false, true) AS enabled;       -- false
```

## Create sample data

Connect to `postgresql_course` with `psql`. Run these statements in one session; the temporary tables disappear when you disconnect:

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

For this example, a null discount means no discount was applied. That rule makes zero an appropriate fallback. If null meant an unknown discount, treating it as zero would change the meaning of the data.

## Choose a display value

Prefer a nickname when one is available, then use the customer's name:

```sql
SELECT id, COALESCE(nickname, name) AS display_name
FROM coalesce_customers
ORDER BY id;
```

Alice appears as `Ali`, Bob as `Bob`, and Cara as an empty string. Cara's nickname is non-null, so COALESCE keeps it.

When the application also treats an empty nickname as missing, use `NULLIF` to turn that specific value into null before choosing a fallback. `NULLIF(value, '')` returns null when the value is an empty string and otherwise returns the value:

```sql
SELECT id, COALESCE(NULLIF(nickname, ''), name) AS display_name
FROM coalesce_customers
ORDER BY id;
```

The display names are now `Ali`, `Bob`, and `Cara`. This handles the exact empty string; a nickname containing only spaces still remains a non-null value.

## Use a fallback in calculations

Subtracting a null discount produces null. Replace the optional input before doing the calculation:

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

The position of COALESCE matters. `COALESCE(subtotal - discount, 0)` would return zero for order `102`, losing its known subtotal of `50.00`. Replacing the missing discount first preserves that amount.

## Return zero for an empty total

An `aggregate` combines values from several rows into one result. `sum` ignores null inputs and returns null when there are no non-null inputs, including when no rows match. Apply COALESCE to the aggregate result when the report should show zero:

```sql
SELECT COALESCE(sum(subtotal), 0) AS total
FROM coalesce_orders
WHERE customer_id = 999;
-- 0
```

`sum(COALESCE(subtotal, 0))` would still return null here: there are no input rows on which to apply the inner COALESCE. Wrapping the sum handles the missing aggregate result.

A `LEFT JOIN` keeps every row from the left table, even when the right table has no match. Unmatched right-side columns are null. Use it to include customers without orders, then supply a fallback for their total:

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

The inner COALESCE handles missing discounts; the outer one handles a missing sum. The left join includes Cara. COALESCE alone cannot create a row that a query does not return.

Replacing null inputs can also change a statistic. `avg(discount)` ignores null discounts, while `avg(COALESCE(discount, 0))` includes them as zero. Choose according to what null means in that calculation.

## Supply a fallback for a JSONB field

The JSONB lesson introduced `->>` for extracting a field as SQL text. A missing key or a JSON null value produces SQL null with this operator, so COALESCE can supply a display value:

```sql
SELECT
  COALESCE('{}'::jsonb ->> 'label', 'Unnamed') AS missing_label,
  COALESCE('{"label": null}'::jsonb ->> 'label', 'Unnamed') AS null_label;
-- Both columns contain Unnamed.
```

With `->`, a stored JSON null remains a JSONB value and does not trigger a COALESCE fallback. An empty text value from `->>` also remains non-null.

## Keep argument types compatible

All arguments must convert to one common result type. Use a numeric fallback for a numeric result, or cast a number to text when the result needs a text label:

```sql
SELECT COALESCE(NULL::numeric, 0) AS amount;
-- 0

SELECT COALESCE(42::text, 'Unknown') AS reference;
-- 42 as text
```

The `::type` syntax casts a value to a SQL type. `COALESCE(42, 'Unknown')` fails because PostgreSQL tries to convert `'Unknown'` to an integer. It resolves types before execution, even when the first argument is non-null.

During execution, COALESCE stops evaluating arguments once it finds a non-null value. It does not catch errors in an expression it needs to evaluate, such as an invalid cast or division by zero.

## Official resources

- [COALESCE and NULLIF](https://www.postgresql.org/docs/18/functions-conditional.html#FUNCTIONS-COALESCE-NVL-IFNULL)
- [Aggregate functions](https://www.postgresql.org/docs/18/functions-aggregate.html)
- [Common result types](https://www.postgresql.org/docs/18/typeconv-union-case.html)
- [JSON functions and operators](https://www.postgresql.org/docs/18/functions-json.html)

## Practice

Use the temporary tables from this lesson in the same `psql` session:

1. Return each customer's display name, falling back to `name` for both null and empty nicknames.
2. Calculate each order's payable amount with a missing discount treated as zero. Compare it with `COALESCE(subtotal - discount, 0)` and explain the difference for order `102`.
3. Return every customer's total payable amount, including customers without orders.
4. Query the sum of subtotals for customer `999`. Compare the raw sum, `sum(COALESCE(subtotal, 0))`, and `COALESCE(sum(subtotal), 0)`.

You are done when the display names are `Ali`, `Bob`, and `Cara`, the order amounts are `90.00`, `50.00`, and `80.00`, and the customer totals are `140.00`, `80.00`, and zero. For customer `999`, only the sum wrapped in COALESCE returns zero; the other two sums return null. The temporary tables are removed when you exit `psql`.
