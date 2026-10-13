---
slug: https-certificates
title: HTTPS Certificates
catalogOrder: 120
description: Understand how HTTPS certificates prove server identity, how they are issued and maintained, and how to diagnose certificate errors.
tags:
  - https
  - tls
  - certificates
  - web-security
lessons:
  - https-certificates/why-https-needs-certificates
  - https-certificates/inside-an-x509-certificate
  - https-certificates/browser-chain-of-trust
  - https-certificates/certificate-issuance-ca-and-acme
  - https-certificates/server-certificate-configuration
  - https-certificates/validity-renewal-and-revocation
  - https-certificates/diagnosing-certificate-errors
---

You already build web applications and use `HTTPS`. This course explains what happens before an HTTP request reaches your application. `TLS` protects the connection. A `certificate` links a server's public key to its domain names. The client checks that link and the server's proof that it holds the matching private key.

Start with the role of certificates in TLS, then read the fields of an X.509 certificate and follow a browser's chain of trust. Next, trace how a certificate authority issues a certificate through ACME. Finish with deployment, the certificate lifecycle, and practical diagnosis on macOS. The examples focus on the decisions a web developer needs to make, without cryptographic mathematics.

## What you will learn

- Why encryption also needs server authentication, and where certificates fit in a TLS handshake.
- How to read domain names, validity dates, public keys, and usage constraints in an X.509 certificate.
- How a browser connects a server certificate to a trusted root.
- How domain validation, a certificate signing request, and ACME lead to a signed certificate.
- Where to deploy the certificate, its intermediate chain, and the matching private key.
- How renewal, key rotation, and revocation keep a deployment working.
- How to identify name mismatches, incomplete chains, trust failures, and expired certificates.

## Official resources

- [TLS 1.3: protocol overview](https://www.rfc-editor.org/info/rfc9846/)
- [Service Identity in TLS](https://www.rfc-editor.org/rfc/rfc9525.html)
- [Let's Encrypt: how issuance works](https://letsencrypt.org/how-it-works/)
