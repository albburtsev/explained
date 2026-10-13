---
slug: https-certificates/server-certificate-configuration
title: How a Server Uses a Certificate
description: Deploy the certificate chain and matching private key at the TLS endpoint, and understand how SNI selects a certificate.
tags:
  - https
  - tls
  - certificates
  - web-security
---

A certificate has been issued for your service. Now you need to give it to the component that handles the client's TLS connection. Putting it beside your application code is useful only if that application actually handles TLS.

## Find where TLS ends

`TLS termination` means completing the TLS handshake and decrypting traffic at an endpoint. That endpoint needs access to the certificate and its matching private key.

In a small deployment, the application can terminate TLS itself. In a larger one, a CDN, load balancer, or `reverse proxy` may do it. A reverse proxy accepts client requests and forwards them to an application. The browser sees the certificate presented by this front component.

For example, a browser connects to a CDN over HTTPS. The CDN then connects to your application. These are two separate connections. If the second also uses TLS, the CDN must check the application's certificate and hostname for that connection. A valid browser-facing certificate does not authenticate the upstream server. [NGINX documents separate upstream TLS verification settings](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_ssl_verify).

![The browser checks the CDN certificate on one TLS connection. The CDN or proxy checks the origin certificate on a separate TLS connection.](./server-certificate-configuration/tls-termination.png)

## Prepare the certificate and key

Common PEM files have these roles:

| File | Contents |
| --- | --- |
| `cert.pem` | The service's leaf certificate. |
| `fullchain.pem` | The leaf, followed by the intermediate certificates needed for its chain. |
| `privkey.pem` | The matching private key. |

These names are conventions, not special file types. Your provider may use other names. A chain file starts with the leaf. Each following intermediate certifies the certificate before it. The root is normally omitted: clients establish trust in it separately. [Node.js defines this order for its `cert` option](https://nodejs.org/docs/latest-v22.x/api/tls.html#tlscreatesecurecontextoptions).

Certificates can be public. The private key must remain secret. Give access only to the processes and operators that need it. Keep it out of Git, frontend bundles, and logs. Use your deployment platform's secret storage and access controls. [NGINX's HTTPS guidance also separates certificate access from private-key access](https://nginx.org/en/docs/http/configuring_https_servers.html#configuration).

## Check that the key matches

Before loading the files, compare the certificate's public key with the public part of the private key. On macOS with OpenSSL v3+, run these commands in the directory containing your issued files:

```sh
openssl x509 -in cert.pem -pubkey -noout > certificate-public.pem
openssl pkey -in privkey.pem -pubout > key-public.pem
cmp certificate-public.pem key-public.pem
```

Both OpenSSL commands must succeed. Then `cmp` succeeds silently when the files match. A difference means you should stop and locate the correct pair. This approach works with RSA and elliptic-curve keys; it does not compare an RSA-specific modulus. Only public keys are written. See the OpenSSL references for [`x509 -pubkey`](https://docs.openssl.org/3.5/man1/openssl-x509/#certificate-printing-options) and [`pkey -pubout`](https://docs.openssl.org/3.5/man1/openssl-pkey/#options).

Matching keys do not establish browser trust. Names, dates, and the certificate chain still need to pass the checks from the previous lessons.

## Load the files in Node.js

This macOS example uses Node.js v22+. It assumes you already have `fullchain.pem` and an unencrypted `privkey.pem` for local development. The certificate must cover `localhost`, and its local CA must already be trusted by your browser. A certificate for a production domain does not normally cover `localhost`.

Save this as `server.mjs` in the same directory:

```js
import { createServer } from 'node:https';
import { readFileSync } from 'node:fs';

const credentials = {
  key: readFileSync('privkey.pem'),
  cert: readFileSync('fullchain.pem'),
};

createServer(credentials, (req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('HTTPS is working.\n');
}).listen(8443, '127.0.0.1', () => {
  console.log('Listening at https://localhost:8443');
});
```

Run it from that directory:

```sh
node server.mjs
```

Open `https://localhost:8443` in your browser. The listener accepts connections only on your Mac's IPv4 loopback address. Node loads the key and chain when the process starts. During the handshake, it presents the chain and proves possession of the private key. The request handler runs after TLS is established. [The Node.js HTTPS reference explains `createServer`](https://nodejs.org/download/release/latest-v22.x/docs/api/https.html#httpscreateserveroptions-requestlistener).

## Choose a certificate before HTTP routing

Several domains can share one IP address. `Server Name Indication (SNI)` carries the intended hostname in the TLS handshake. The server can use it to choose a certificate before it receives an HTTP request. Selecting a route from the HTTP `Host` header happens later. [RFC 6066 defines SNI and certificate selection](https://www.rfc-editor.org/rfc/rfc6066.html#section-3).

SNI does not replace hostname checking. The browser still checks the selected certificate's SAN against the requested hostname. A correct SNI configuration paired with the wrong certificate still fails.

## Practice

A CDN terminates browser TLS and forwards requests to your Node.js application over HTTPS. You replace the application's certificate, but browsers still report an expired certificate. Where should you look?

**Answer:** check the certificate served by the CDN. It is the browser's TLS endpoint. The application's certificate belongs to the separate upstream connection. Check that connection too, using the CDN's trust and hostname rules. The next lesson explains how to keep certificates valid over time.
