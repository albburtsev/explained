---
slug: greetings/hello-world
title: Hello, World!
description: Write and run the smallest friendly TypeScript program.
tags:
  - fundamentals
  - typescript
  - nodejs
---

The traditional first program prints a short greeting. It confirms that your tools work and gives you a complete program you can understand at a glance.

## The program

Create a file named `hello-world.ts`:

```ts
console.log('Hello, world!');
```

Run it with Node.js:

```sh
node hello-world.ts
```

You should see:

```text
Hello, world!
```

`console.log` writes a value to the standard output stream. Here, that value is the string `'Hello, world!'`.

## Try it yourself

Change the message so the program greets you by name, then run it again. The source code stays the same shape; only the string value changes.

Learn more in the [Node.js TypeScript documentation](https://nodejs.org/api/typescript.html).
