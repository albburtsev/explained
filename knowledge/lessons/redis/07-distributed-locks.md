---
slug: redis/distributed-locks
title: Distributed Locks with Redis
description: Build a lock from SET NX PX, release it safely with a Lua script, and understand what a lock with a timeout can and cannot promise.
tags:
  - redis
  - key-value-store
  - distributed-systems
  - locking
---

A **distributed lock** is a key in Redis that represents permission to do one piece of work. The process that manages to create the key holds the lock. Every other process sees that the key already exists and backs off. Redis knows nothing about the work itself, so the lock only works while every participant agrees to ask for it first.

This lesson builds that lock command by command, then spends as much time on what the lock cannot promise. That second part matters more than the first.

## Give one job to one instance

You deploy the same application to three instances behind a load balancer. Each instance runs its own scheduler, and at 02:00 all three wake up and start building the nightly report. The report is written three times, the email goes out three times, and the invoices are counted three times.

You need a place outside the three instances where they can agree on who goes first. Redis is already shared by all of them, it answers in well under a millisecond, and it runs your commands one at a time. That makes it a natural place to keep the flag.

Name the key after the job, not after the instance:

```text
lock:job:nightly-report
```

One job, one key. A second scheduled job gets its own key and the two never block each other.

## Acquire the lock with one command

Each process first generates a value that no other process will produce. On macOS, `uuidgen` is enough:

```sh
$ uuidgen
9F2A6C3E-1B44-4D0A-9E77-2C5B8D41A6F3
```

Then it tries to claim the key:

```sh
127.0.0.1:6379> SET lock:job:nightly-report 9F2A6C3E-1B44-4D0A-9E77-2C5B8D41A6F3 NX PX 30000
OK
```

Read the command left to right:

- `lock:job:nightly-report` is the key that stands for the job.
- `9F2A6C3E-…` is the caller's **token**: proof of who owns the lock right now.
- `NX` sets the key only if it does not already exist.
- `PX 30000` gives the key a time to live of 30000 milliseconds.

`OK` means the key was created and this process holds the lock. A second instance running the same command a moment later gets nothing back:

```sh
127.0.0.1:6379> SET lock:job:nightly-report 4B7E1D08-55C2-4A9F-8E31-6D0FA2C74B19 NX PX 30000
(nil)
```

`(nil)` means the key already existed, so `NX` refused to write. That instance skips the report and goes back to sleep.

`NX` is what makes the acquisition safe. Checking with `EXISTS` and then writing with `SET` is two round trips, and two instances can both see the key missing in the gap between them. `NX` folds the check and the write into one command, and Redis runs each command to completion before it starts the next one. This is the same single-command atomicity that made the rate-limiting counter correct in the previous lesson.

`PX` is what keeps the system alive. If the process that holds the lock crashes, is killed, or loses the network, nobody is left to clean up. Without a time to live the key would stay forever and the nightly report would never run again. With `PX`, Redis releases the lock on its own.

The token has to be unique per acquisition. A constant value such as `locked` would let any process delete any lock, because every process would recognize the value as its own. The token turns the key into a signed claim: only the holder can prove the lock is still theirs.

## Release the lock without deleting someone else's

The obvious release is to read the key, compare, and delete:

```sh
127.0.0.1:6379> GET lock:job:nightly-report
"9F2A6C3E-1B44-4D0A-9E77-2C5B8D41A6F3"
127.0.0.1:6379> DEL lock:job:nightly-report
(integer) 1
```

This is wrong, and the reason is the gap between the two commands. Follow three instances through it:

1. Instance A holds the lock and its report takes longer than 30 seconds.
2. A runs `GET`, sees its own token, and decides to delete.
3. Before A sends `DEL`, the key expires on its own.
4. Instance B runs `SET … NX PX 30000`, gets `OK`, and starts its own report.
5. A's `DEL` arrives and removes B's lock.
6. Instance C now acquires the lock while B is still working.

A deleted a lock it no longer owned. The compare and the delete must happen as one indivisible step, and no single Redis string command does both. A Lua script does:

```lua
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
```

Send it with `EVAL`, passing the key and the token as arguments rather than pasting them into the script text:

```sh
127.0.0.1:6379> EVAL "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end" 1 lock:job:nightly-report 9F2A6C3E-1B44-4D0A-9E77-2C5B8D41A6F3
(integer) 1
```

The `1` after the script is the number of keys that follow. Redis fills the `KEYS` table with those key names and the `ARGV` table with everything after them. Always declare the keys this way instead of writing them into the script body.

Redis guarantees that a script runs atomically: the server blocks all other activity for the whole run, so no other client can slip between the `get` and the `del`. Keep the script short for exactly that reason.

The reply tells you what happened. `(integer) 1` means your token matched and your lock is released. `(integer) 0` means the key was gone or held by someone else — your lock had already expired, and the work you just finished ran without protection.

Redis 8.4 added `DELEX`, which expresses the same compare-and-delete as one command: `DELEX lock:job:nightly-report IFEQ 9F2A6C3E-…`. It returns `1` or `0` just like the script. On any earlier version, use the script.

## Choose a TTL you can defend

The time to live is the deadline you give yourself. Both directions hurt:

- Too short, and the lock expires while the work is still running. A second process starts the same job, and your release deletes nothing.
- Too long, and a crashed holder blocks the job for that whole period. A 10-minute TTL means up to 10 minutes of nothing happening after a crash.

Measure how long the job actually takes, then set the TTL above the realistic worst case rather than the average. Check the remaining time with `PTTL`:

```sh
127.0.0.1:6379> PTTL lock:job:nightly-report
(integer) 27418
```

If the honest answer is "the job takes somewhere between 5 seconds and 20 minutes", stop picking a number and renew the lock instead.

## Renew the lock while the work continues

A **watchdog** is a timer inside the holding process that periodically extends the lock while the work is still going. Take a short TTL, say 30 seconds, and push it forward every 10 seconds. Extension has the same ownership problem as release, so it uses the same shape of script:

```lua
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
else
  return 0
end
```

```sh
127.0.0.1:6379> EVAL "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end" 1 lock:job:nightly-report 9F2A6C3E-1B44-4D0A-9E77-2C5B8D41A6F3 30000
(integer) 1
```

A reply of `0` means you no longer hold the lock. Treat that as a signal to stop the work, not as a reason to retry the extension.

Renewal narrows the window in which the lock expires under a still-running job. It does not close it. The renewal itself can be late, because the process that sends it is the same process that might be stalled. Do not assume that a lock is held simply because the process that took it is still alive.

## Accept that a timeout is not mutual exclusion

Here is the part that most introductions skip. A lock with a timeout does not guarantee that only one process runs the work.

The holder can stop running without knowing it. A long garbage-collection pause, a descheduled thread on a busy machine, a stalled disk write, or a network partition can freeze a process for seconds. From inside, no time passed. From Redis's point of view, the TTL elapsed and the key vanished. A second process acquires the lock legitimately, and now two processes are doing the job while each believes it is alone.

Redis also expires keys against the server's wall clock rather than a monotonic clock, so an administrator or a misconfigured time sync that shifts the clock can retire a lock early.

So a Redis lock is a good tool for **efficiency** — avoiding duplicate work that is merely wasteful — and a poor tool for **correctness** — preventing an outcome that must never happen twice, such as double-charging a customer.

When the work truly must not run twice, make the protected resource itself reject stale writers. A **fencing token** is a number that increases with every lock grant and travels with the request:

```sh
127.0.0.1:6379> INCR lock:job:nightly-report:fence
(integer) 42
```

The holder sends `42` along with each write, and the storage system refuses any write carrying a token lower than the highest one it has already accepted. A process that was paused past its TTL comes back with `42` while the new holder is writing with `43`, and its writes are rejected. Note the obligation: this only works if the downstream system checks the token. If it cannot, use a system built for consensus, such as ZooKeeper or etcd, instead of adding more Redis commands.

## Read the Redlock proposal with open eyes

Everything above assumes one Redis master. If that master fails over to a replica, the lock can simply disappear, because Redis replication is asynchronous: the master can acknowledge your `SET` and then crash before the write reaches the replica. The promoted replica has no lock key, and the next process to ask gets `OK`.

**Redlock** is the algorithm Redis documents to address that. The client runs N independent Redis masters — five is the documented example — with no replication between them. It tries to set the same key with the same token on all of them in parallel, and considers the lock acquired only if it succeeded on a majority and the whole attempt took much less than the TTL. The remaining validity is the TTL minus the time the acquisition took. On failure it releases every instance it touched, including the ones it thinks it missed.

Be honest about its standing. Redis publishes Redlock and links, on the same page, to Martin Kleppmann's analysis arguing that it is unsafe for correctness, and to antirez's reply. The core of the dispute is that Redlock's safety rests on timing assumptions: bounded clock drift and the absence of process pauses longer than the lock's validity. Those assumptions do not hold in an asynchronous system. The Redis documentation itself advises implementing fencing tokens if you care about consistency.

The practical reading: Redlock raises your odds against single-node failure, and it does not turn a lease into mutual exclusion. Use a Redis lock to avoid duplicate work. Use fencing or a consensus system when a second execution would be a bug you cannot tolerate.

## Know what changes under Redis Cluster

A lock key maps to one hash slot, and that slot is served by one master. So the lock is a single-node object no matter how many nodes the cluster has, and it inherits that node's failure modes: a failover promotes a replica that may not have received the key, and the lock is gone. The cluster specification is explicit that replication is asynchronous and that acknowledged writes can be lost during a failover.

Redlock exists precisely to attack this single-master assumption, and it does so with independent masters rather than a cluster — a Redis Cluster coordinates its nodes, which is the opposite of what the algorithm requires.

Your scripts are unaffected here: they touch one key, so the cross-slot restriction on multi-key scripts never applies. Just keep passing the key through `KEYS` so the client can route the command to the right node.

## Check your understanding

Answer these before reading on:

1. Two instances send `SET lock:job:nightly-report <token> NX PX 30000` at the same millisecond. How many get `OK`?
2. Why can the release script not be replaced by `GET` followed by `DEL`?
3. Your release script returns `(integer) 0`. What does that tell you about the work you just finished?
4. The nightly report usually takes 40 seconds, but once a month it takes 12 minutes. Is a `PX 60000` lock sufficient?
5. You need to guarantee that an invoice is never charged twice. Is a Redis lock enough?

Answers: 1. Exactly one — Redis runs commands one at a time and `NX` fails for the second. 2. Because the key can expire and be re-acquired by another process between the two commands, so your `DEL` may delete a lock you no longer own; the script makes the compare and the delete one atomic step. 3. That your lock had already expired, so the work ran unprotected and another process may have been running it too. 4. No — on the slow run the lock expires after one minute and a second instance starts the report; renew the lock periodically instead. 5. No — use a fencing token the billing system validates, or a system designed for consensus.

## Official resources

- [Distributed locks with Redis](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/)
- [`SET`](https://redis.io/docs/latest/commands/set/)
- [`EVAL`](https://redis.io/docs/latest/commands/eval/)
- [Scripting with Lua](https://redis.io/docs/latest/develop/programmability/eval-intro/)
- [`PEXPIRE`](https://redis.io/docs/latest/commands/pexpire/)
- [`DELEX`](https://redis.io/docs/latest/commands/delex/)
- [Redis cluster specification](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/)
