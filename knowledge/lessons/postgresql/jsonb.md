---
slug: postgresql/jsonb
title: JSONB
description: Model flexible PostgreSQL data with JSONB, query and update documents safely, and index the access patterns that matter.
tags:
  - postgresql
  - databases
  - jsonb
  - data-modeling
---

Relational columns are a strong fit when a value has a stable type, participates in a relationship, or must satisfy a database rule. Some data is less regular: product-specific attributes, external API payloads, and event details may have different fields from one row to the next.

PostgreSQL's `jsonb` type stores valid JSON in a decomposed binary representation. It supports field extraction, structural containment, updates, and indexes. That flexibility works best inside a deliberate relational design, not as a replacement for every column.

## Choose `jsonb` deliberately

PostgreSQL provides both `json` and `jsonb`. They accept almost the same input, but store it differently:

| Type | Storage behavior | Use it when |
| --- | --- | --- |
| `json` | Preserves the original input text, including insignificant whitespace, key order, and duplicate keys. Processing must reparse the text. | The exact original representation has special meaning. |
| `jsonb` | Stores a parsed representation, discards insignificant whitespace and key order, and keeps only the last value for a duplicate key. | The application needs to query, update, compare, or index the data. |

Most application data that will be processed inside PostgreSQL should use `jsonb`. Do not rely on object key order with either type: JSON objects represent named members, not an ordered record format.

A useful design keeps stable identity and rules relational while leaving genuinely variable attributes in JSONB:

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

The `sku` remains a normal column because it needs uniqueness and will be addressed directly. The check prevents callers from storing a JSON array, scalar, or JSON `null` where the application expects an object.

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

For the mug, the missing `dimensions.weight_kg` path produces SQL `NULL` rather than an error. The numeric cast therefore also returns null. A present value with incompatible text, such as `"heavy"`, would fail the cast. If a field must always be numeric, enforce that rule or promote it to a typed column instead of trusting every writer.

Three states can otherwise look similar:

- a SQL `NULL` means the whole SQL value is absent;
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

For a missing key, both extraction forms return SQL `NULL` and the existence test is false. For a key whose value is JSON `null`, `->` returns the JSONB value `null`, `->>` returns SQL `NULL`, and the existence test is true. Prefer a consistent application convention, such as omitting unknown optional fields, and use `?` when presence itself matters.

## Search by structure

The containment operator `@>` asks whether the JSONB value on the left contains the structure and values on the right. It is often clearer than extracting several fields separately:

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

Use explicit extraction, containment, or PostgreSQL's `jsonpath` operators when a nested condition is required. Prefer the simplest form that expresses the application's access pattern.

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

The path uses object keys here, although numeric path components can address zero-based array positions. The final `false` tells `jsonb_set` not to create a missing final member. Every earlier path component must already exist; otherwise the original value is returned unchanged. Check the affected row and resulting document when a missing path should be an application error.

The concatenation operator `||` is convenient for adding or replacing top-level members:

```sql
UPDATE products
SET attributes = attributes || '{"warranty_years": 3}'::jsonb
WHERE sku = 'BAG-001';
```

For objects, a key from the right-hand value replaces the same top-level key on the left. This is not a recursive merge, so use `jsonb_set` when the intended change is nested.

A targeted JSONB expression does not turn storage into an in-place field update. The `UPDATE` still locks the row, creates a new row version under MVCC, and maintains affected indexes. Keep documents to a manageable size, and move independently updated or heavily contended data into separate rows or columns.

## Index the query shape

The earlier indexing lesson's rule still applies: start with a real query, then choose an index whose access method and expression support it. A GIN index on the complete document supports common containment, key-existence, and `jsonpath` searches:

```sql
CREATE INDEX products_attributes_gin
ON products USING GIN (attributes);

SELECT sku, name
FROM products
WHERE attributes @> '{"color": "black"}'::jsonb;
```

The default `jsonb_ops` operator class supports `@>`, `?`, `?|`, `?&`, `@?`, and `@@`. The alternative `jsonb_path_ops` supports only `@>`, `@?`, and `@@`, but its indexes are usually smaller and its supported searches can be more specific. Choose it only when observed queries do not need the key-existence operators:

```sql
CREATE INDEX products_attributes_path_gin
ON products USING GIN (attributes jsonb_path_ops);
```

Do not keep both broad indexes without evidence: each consumes storage and adds write work.

For a frequently queried scalar, a targeted expression index can be smaller and can support ordinary B-tree comparisons. The query must use the indexed expression consistently:

```sql
CREATE INDEX products_weight_idx
ON products (((attributes #>> '{dimensions,weight_kg}')::numeric));

SELECT sku, name
FROM products
WHERE (attributes #>> '{dimensions,weight_kg}')::numeric < 2;
```

This index also makes invalid numeric values a write-time problem because PostgreSQL must evaluate the cast while maintaining the index. When a value is important enough to need reliable typing, range searches, constraints, or joins, a dedicated typed column is usually the clearer model.

As with any small example, PostgreSQL may prefer a sequential scan because reading the whole table is cheaper. Use `EXPLAIN` with representative data before deciding whether an index helps the production workload.

## Set a boundary for flexible data

Use JSONB when fields vary naturally between records or arrive from a source whose shape evolves. Keep a regular structure within each document even when PostgreSQL does not enforce every member. Predictable shapes make queries, indexes, migrations, and application code simpler.

Keep a value in a normal column when it:

- identifies a row or participates in a foreign key;
- needs `NOT NULL`, uniqueness, or a stable scalar type;
- appears frequently in joins, grouping, ordering, or range filters;
- changes independently and often;
- must be easy for every writer and reporting tool to discover.

JSONB and relational modeling are complementary. Put durable invariants in columns and constraints, then use JSONB for the variable part of the record and index only the access patterns that justify their cost.

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
