---
slug: redis/redis-cli
title: First Steps with redis-cli
description: Install Redis on macOS, start the server, and use redis-cli to store, read, list, and inspect keys.
tags:
  - redis
  - key-value-store
  - distributed-systems
  - redis-cli
---

**`redis-cli`** is the terminal client that ships with Redis. It sends commands to a Redis server and prints the reply. Because Redis has no query language, `redis-cli` is the complete interface: every example in this course is a command you type at its prompt.

The previous lesson described what Redis is for. This lesson gives you a running server and a session you can experiment in. Every later lesson assumes this setup, so finish it before moving on.

## Install Redis on macOS

Redis is distributed as a Homebrew formula, so you need Homebrew on your machine. Install the server and its tools:

```sh
brew install redis
```

The formula installs both `redis-server` and `redis-cli`. Confirm that the client is on your path with `redis-cli --version`, which prints a line such as `redis-cli 8.6.0`.

## Start the server

Redis can run as a background service or in the foreground. Use the background service for everyday work:

```sh
brew services start redis
```

Homebrew registers Redis with `launchd`, so the server starts now and again at login. `brew services info redis` reports whether it is running, and `brew services stop redis` stops it when you are finished for the day.

The foreground alternative is useful when you want to watch what the server does. Run the executable directly:

```sh
redis-server
```

Redis prints its startup log to the terminal and keeps the terminal occupied. Press `Ctrl-C` to stop it. A foreground server started this way uses Redis defaults rather than the configuration file Homebrew installs, and it holds port `6379`. If the background service is already running, the foreground server cannot bind that port and exits with an error. Run one or the other, not both.

## Confirm the connection

With the server running, open a session:

```sh
redis-cli
```

By default `redis-cli` connects to `127.0.0.1` on port `6379`. The prompt shows that address:

```sh
127.0.0.1:6379>
```

Ask the server whether it is alive. `PING` is the standard liveness check, and a healthy server answers `PONG`:

```sh
127.0.0.1:6379> PING
PONG
```

If the prompt instead reads `not connected>`, the server is not running. Start it and try again.

You can also pass a command as arguments and skip interactive mode entirely, which is how `redis-cli PING` is used in scripts and health checks.

## Store, read, and delete a key

Redis stores **keys**, each holding one value. `SET` writes a string value and replies with the simple status `OK`:

```sh
127.0.0.1:6379> SET user:1:name "Alice"
OK
```

`GET` reads it back. `redis-cli` shows string replies in quotes so you can see leading and trailing spaces:

```sh
127.0.0.1:6379> GET user:1:name
"Alice"
```

A missing key is not an error. `GET` replies with `(nil)`, the empty reply. `EXISTS` reports how many of the named keys are present, and `DEL` reports how many it removed:

```sh
127.0.0.1:6379> GET user:2:name
(nil)
127.0.0.1:6379> EXISTS user:1:name
(integer) 1
127.0.0.1:6379> DEL user:1:name
(integer) 1
127.0.0.1:6379> EXISTS user:1:name
(integer) 0
```

Deleting a key that does not exist replies `(integer) 0` rather than failing. Command names are case-insensitive, so `set` and `SET` are the same command, but key names and values are case-sensitive: `user:1:name` and `User:1:Name` are two different keys.

## List keys without blocking the server

Create a few keys so there is something to look at. `MSET` sets several keys in one command:

```sh
127.0.0.1:6379> MSET user:1 "Alice" user:2 "Bob" cart:1 "empty"
OK
```

`KEYS *` returns every matching key name, and beginners reach for it first:

```sh
127.0.0.1:6379> KEYS *
1) "user:1"
2) "cart:1"
3) "user:2"
```

Avoid it on any server that matters. Redis executes commands one at a time on a single thread, and `KEYS` is O(N) in the number of keys in the database. On a database with millions of keys it occupies the server for the whole scan, and every other client waits. The official documentation calls it a debugging command and tells you not to use it in application code.

`SCAN` is the safe alternative. It is a **cursor**-based iterator: each call does a small amount of work, returns a cursor, and returns some keys. Start an iteration with cursor `0`:

```sh
127.0.0.1:6379> SCAN 0
1) "0"
2) 1) "user:1"
   2) "cart:1"
   3) "user:2"
```

The reply has two parts. The first is the cursor for the next call; the second is the batch of key names. Pass the returned cursor to the next `SCAN`, and stop when the server returns `0` again. In this tiny database the first call already finishes the iteration.

`MATCH` filters the returned names, and `COUNT` hints at how much work each call should do:

```sh
127.0.0.1:6379> SCAN 0 MATCH user:* COUNT 100
```

Two properties surprise people. `MATCH` filters after the batch is collected, so a call can legitimately return an empty batch with a non-zero cursor; only the cursor tells you the iteration is over. And a full iteration may return the same key more than once, so treat the results as a set rather than a count.

From the shell, `redis-cli` will drive the whole loop for you and print one key per line:

```sh
redis-cli --scan --pattern 'user:*'
```

## Look around the instance

`TYPE` reports which data structure a key holds, and `DBSIZE` counts the keys in the current database without listing them, in constant time. Later lessons use lists, hashes, and sorted sets; every key you have created so far is a string:

```sh
127.0.0.1:6379> TYPE user:1
string
127.0.0.1:6379> TYPE nothing:here
none
127.0.0.1:6379> DBSIZE
(integer) 3
```

`INFO` returns a text report about the server, grouped into sections such as `server`, `clients`, `memory`, `stats`, and `keyspace`. Ask for one section to keep the output readable:

```sh
127.0.0.1:6379> INFO keyspace
```

The Keyspace section prints one line per non-empty database, in the form `db0:keys=3,expires=0,...`, where `keys` is the key count and `expires` is how many of them have an expiration set. `INFO server` reports the version and uptime; `INFO memory` reports `used_memory_human`; `INFO stats` reports `keyspace_hits` and `keyspace_misses`, which matter once you use Redis as a cache. The exact field list varies between Redis versions.

## Reset a scratch instance and exit

`FLUSHDB` deletes every key in the current database and replies `OK`:

```sh
127.0.0.1:6379> FLUSHDB
OK
127.0.0.1:6379> DBSIZE
(integer) 0
```

This is a clean slate for practice, and it is destructive and immediate. Run it only against a local instance you own. `FLUSHALL` does the same across every database on the server.

End the session by running `QUIT` at the prompt or pressing `Ctrl-D`. Leaving the client does not stop the server; the Homebrew service keeps running until you stop it.

## Connect to another server or database

A local server on the default port needs no options. Anywhere else, name the host and port:

```sh
redis-cli -h cache.example.com -p 6380
```

One Redis server holds several numbered logical **databases**, sixteen by default, and new connections always use database `0`. They are separate key namespaces on one server, not separate servers: they share the same process, memory, and configuration. Select one when you connect:

```sh
redis-cli -n 1
```

Inside a session, `SELECT 1` does the same, and the prompt changes to `127.0.0.1:6379[1]>` so you can see which database you are in. Use numbered databases to keep scratch work apart from real data, not to host unrelated applications.

Do not pass a password with `-a` on the command line, because the whole command lands in your shell history. Put it in the `REDISCLI_AUTH` environment variable instead, which `redis-cli` reads automatically.

## Note on Redis Cluster

Redis Cluster shards the keyspace across several nodes, and that changes two things in this lesson.

Add `-c` so the client follows the redirections a cluster sends when a key lives on another node:

```sh
redis-cli -c -h node1.example.com -p 6379
```

Without `-c`, a command for a key on another node returns a `MOVED` error instead of a result. A cluster also supports only database `0`, so `SELECT` and `-n` are unavailable.

More importantly, `SCAN`, `DBSIZE`, `KEYS`, and `FLUSHDB` are per-node: they see only the keys held by the node you are connected to. To cover a whole cluster you must run them against every node yourself. Assume a single instance in the rest of this course unless a lesson says otherwise.

## Check your understanding

Start from an empty scratch database and predict each reply before you run it:

```sh
127.0.0.1:6379> FLUSHDB
127.0.0.1:6379> MSET session:a "1" session:b "2" job:1 "queued"
127.0.0.1:6379> DBSIZE
127.0.0.1:6379> EXISTS session:a session:c
127.0.0.1:6379> TYPE job:1
127.0.0.1:6379> GET job:2
127.0.0.1:6379> DEL job:1 job:2
127.0.0.1:6379> SCAN 0 MATCH session:*
```

`DBSIZE` returns `(integer) 3`. `EXISTS` returns `(integer) 1`, because it counts only the keys that are present. `TYPE` returns `string`, `GET` returns `(nil)`, and `DEL` returns `(integer) 1`. The final `SCAN` returns cursor `"0"` with `session:a` and `session:b` in some order.

Then answer these without the terminal:

1. Why would `KEYS *` be a bad idea on a production server with ten million keys, while `DBSIZE` is fine?
2. A `SCAN` call returns cursor `"3072"` and an empty list of keys. Is the iteration finished?
3. You run `DBSIZE` against one node of a cluster and get `(integer) 5000`. How many keys does the cluster hold?

The answers: `KEYS` blocks the single-threaded server for the length of a full O(N) scan, while `DBSIZE` reads a counter in constant time. The iteration is not finished, because only a returned cursor of `0` ends it. And you do not know the cluster total; `5000` is that one node's share.

## Official resources

- [redis-cli documentation](https://redis.io/docs/latest/develop/tools/cli/)
- [Install Redis on macOS](https://redis.io/docs/latest/operate/oss_and_stack/install/archive/install-redis/install-redis-on-mac-os/)
- [`SCAN` command reference](https://redis.io/docs/latest/commands/scan/)
- [`KEYS` command reference](https://redis.io/docs/latest/commands/keys/)
- [`INFO` command reference](https://redis.io/docs/latest/commands/info/)
- [Complete command reference](https://redis.io/docs/latest/commands/)
