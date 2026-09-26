---
slug: postgresql/jsonb
title: JSONB
description: Store variable attributes in JSONB, query and update documents, and choose suitable indexes.
tags:
  - postgresql
  - databases
  - jsonb
  - data-modeling
---

**JSON** represents data as objects, arrays, and scalar values such as strings, numbers, and booleans. PostgreSQL's `jsonb` type stores it in a parsed binary form that supports queries, updates, and indexes.

JSONB suits variable data, such as product attributes or external API responses. Keep values with stable types, relationships, or database rules in ordinary columns.

## Choose `jsonb` deliberately

PostgreSQL provides both `json` and `jsonb`. They accept almost the same input, but store it differently:

| Type | Storage behavior | Use it when |
| --- | --- | --- |
| `json` | Preserves the original input text, including insignificant whitespace, key order, and duplicate keys. Processing must reparse the text. | The exact original representation has special meaning. |
| `jsonb` | Stores a parsed representation, discards insignificant whitespace and key order, and keeps only the last value for a duplicate key. | The application needs to query, update, compare, or index the data. |

Most application data that will be processed inside PostgreSQL should use `jsonb`. Do not rely on object key order with either type: JSON objects represent named members, not an ordered record format.

For a product, keep its identifier, stock-keeping unit (`sku`), and name in columns, with variable attributes in JSONB:

```sql
CREATE TABLE products (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT products_attributes_object
    CHECK (jsonb_typeof(attributes) = 'object')
);
```

`sku` has a uniqueness constraint. The check requires `attributes` to be an object, rejecting arrays, scalars, and JSON `null`.

Insert two products with different attribute sets:

```sql
INSERT INTO products (sku, name, attributes)
VALUES
  (
    'BAG-001',
    'Travel bag',
    '{
      "color": "black",
      "tags": ["carry-on", "water-resistant"],
      "dimensions": {"weight_kg": 1.4}
    }'
  ),
  (
    'MUG-001',
    'Ceramic mug',
    '{
      "color": "blue",
      "capacity_ml": 350,
      "dishwasher_safe": true
    }'
  );
```

PostgreSQL validates the JSON syntax and converts each string to the column's `jsonb` type. It does not infer a common document schema across the rows.

## Extract values with the intended SQL type

The extraction operator determines whether a result remains JSONB or becomes SQL text:

- `->` extracts an object member or array element as `jsonb`.
- `->>` extracts it as `text`.
- `#>` and `#>>` follow a path supplied as a `text[]`, returning `jsonb` and `text` respectively.

Use a JSONB result for further JSON operations and a text result when SQL needs to display, cast, sort, or compare a scalar:

```sql
SELECT
  sku,
  attributes ->> 'color' AS color,
  (attributes #>> '{dimensions,weight_kg}')::numeric AS weight_kg
FROM products;
```

The mug has no `dimensions.weight_kg`, so extraction and the numeric cast return SQL `NULL`. A value such as `"heavy"` would fail the cast. If the field must be numeric, enforce that rule or use a typed column.

Three states can otherwise look similar:

- SQL `NULL` marks a missing or unknown SQL value;
- JSON `null` is a value stored inside a JSON document;
- a missing key is not part of the document.

The `?` operator checks whether a top-level key exists:

```sql
SELECT
  sku,
  attributes ? 'warranty_years' AS has_warranty_key,
  attributes -> 'warranty_years' AS warranty_json,
  attributes ->> 'warranty_years' AS warranty_text
FROM products;
```

Both sample products lack this key, so both extractions return SQL `NULL` and `?` returns false. If the key holds JSON `null`, `->` returns JSONB `null`, `->>` returns SQL `NULL`, and `?` returns true. Use a consistent convention for optional fields and check `?` when presence matters.

## Search by structure

The **containment** operator `@>` checks whether the left JSONB value contains the structure and values on the right:

```sql
SELECT sku, name
FROM products
WHERE attributes @> '{
  "color": "black",
  "tags": ["water-resistant"]
}'::jsonb;
```

Object containment follows the document structure, while an array on the right can match contained elements without requiring the same order. The query above requires both a top-level `color` member and the requested element inside the top-level `tags` array.

The existence operator is not recursive. This query checks only for a top-level key named `dimensions`:

```sql
SELECT sku
FROM products
WHERE attributes ? 'dimensions';
```

Use extraction or containment for nested conditions. PostgreSQL also offers `jsonpath`, a language for expressing paths and conditions inside JSON documents.

## Update without replacing the document by hand

`jsonb_set` returns a copy with one path changed. Update the bag's nested weight like this:

```sql
UPDATE products
SET attributes = jsonb_set(
  attributes,
  '{dimensions,weight_kg}',
  to_jsonb(1.6::numeric),
  false
)
WHERE sku = 'BAG-001';
```

The path uses object keys; numeric components can address array positions starting at zero. The final `false` prevents creation of a missing final member. Earlier path components must also exist, or the value stays unchanged. Check the resulting document if a missing path should be an error; the row count alone does not show whether the path changed.

The concatenation operator `||` is convenient for adding or replacing top-level members:

```sql
UPDATE products
SET attributes = attributes || '{"warranty_years": 3}'::jsonb
WHERE sku = 'BAG-001';
```

For objects, a key from the right-hand value replaces the same top-level key on the left. This is not a recursive merge, so use `jsonb_set` when the intended change is nested.

Updating one JSONB field still locks the whole row, creates a new row version under MVCC, and maintains affected indexes. Keep documents reasonably small. Move data that needs independent concurrent updates into separate rows; separate columns in the same row still share its row lock.

## Index the query shape

Choose indexes for the queries you need, as in the indexing lesson. A GIN index on the whole document supports containment, key-existence, and suitable `jsonpath` searches:

```sql
CREATE INDEX products_attributes_gin
ON products USING GIN (attributes);

SELECT sku, name
FROM products
WHERE attributes @> '{"color": "black"}'::jsonb;
```

The default `jsonb_ops` supports `@>`, key-existence operators (`?`, `?|`, `?&`), and `jsonpath` operators (`@?`, `@@`). The alternative `jsonb_path_ops` supports `@>`, `@?`, and `@@`, but not key-existence operators. Its indexes are usually smaller and can make supported searches faster:

```sql
CREATE INDEX products_attributes_path_gin
ON products USING GIN (attributes jsonb_path_ops);
```

Treat this as an alternative to the first index. Keep both only if measurements justify their storage and write costs.

For a frequently queried scalar, a targeted expression index can be smaller and can support ordinary B-tree comparisons. The query must use the indexed expression consistently:

```sql
CREATE INDEX products_weight_idx
ON products (((attributes #>> '{dimensions,weight_kg}')::numeric));

SELECT sku, name
FROM products
WHERE (attributes #>> '{dimensions,weight_kg}')::numeric < 2;
```

PostgreSQL evaluates the cast when it builds and maintains this index, so a row whose value is not a valid number causes an error on insert or update. If a field needs reliable typing, range searches, constraints, or joins, a typed column is usually clearer.

As with any small example, PostgreSQL may prefer a sequential scan because reading the whole table is cheaper. Use `EXPLAIN` with representative data before deciding whether an index helps the production workload.

## Set a boundary for flexible data

Keep document structure predictable even when fields vary between rows. Consistent shapes simplify queries, indexes, and application code.

Keep a value in a normal column when it:

- identifies a row or participates in a foreign key;
- needs `NOT NULL`, uniqueness, or a stable scalar type;
- appears frequently in joins, grouping, ordering, or range filters;
- must be easy for every writer and reporting tool to discover.

## Official resources

- [JSON types and JSONB indexing](https://www.postgresql.org/docs/current/datatype-json.html)
- [JSON functions and operators](https://www.postgresql.org/docs/current/functions-json.html)
- [GIN indexes](https://www.postgresql.org/docs/current/gin.html)
- [Indexes on expressions](https://www.postgresql.org/docs/current/indexes-expressional.html)

## Practice

Create a local catalog with deliberately different document shapes:

```sql
DROP TABLE IF EXISTS practice_catalog;

CREATE TABLE practice_catalog (
  sku text PRIMARY KEY,
  details jsonb NOT NULL,
  CHECK (jsonb_typeof(details) = 'object')
);

INSERT INTO practice_catalog (sku, details)
VALUES
  ('CAM-1', '{"color":"black","tags":["travel","sale"],"specs":{"weight_g":420}}'),
  ('MUG-2', '{"color":"blue","tags":["kitchen"],"dishwasher_safe":true}'),
  ('BAG-3', '{"color":"black","tags":["travel"],"specs":{"weight_g":900},"warranty_years":null}');
```

Complete these tasks:

1. Use containment to find black products tagged for travel.
2. Use `?`, `->`, and `->>` to distinguish the missing warranty key from the JSON `null` value.
3. Change the camera's nested weight to `430` with `jsonb_set`, then add a top-level numeric `warranty_years` member.
4. Create a GIN index on `details`, run `ANALYZE`, and inspect the containment query with `EXPLAIN`. A sequential scan is still reasonable for only three rows.

You are done when the first query returns `CAM-1` and `BAG-3`, the warranty query distinguishes absence from JSON `null`, and the camera retains its original fields after both updates. Drop `practice_catalog` when finished.
