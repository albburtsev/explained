---
slug: https-certificates/browser-chain-of-trust
title: How Browsers Verify the Chain of Trust
description: Follow a server certificate to a trusted root and understand the checks that establish server identity.
tags:
  - https
  - tls
  - certificates
  - web-security
---

A certificate contains a public key and domain names. Its signature shows who signed those claims. A browser must also decide whether to trust that signer. It does this through a `chain of trust`: a sequence of certificates that connects the server to an authority the client already trusts.

## From the server to a trusted root

A `certificate authority (CA)` signs certificates. A typical HTTPS chain has three roles:

- The `leaf certificate` identifies the server, such as `api.example.com`. It contains the server's public key.
- An `intermediate certificate` belongs to a CA that signs the leaf certificate. There can be several intermediate levels.
- A `root certificate` represents an authority that the client accepts as a starting point for trust.

The browser uses the intermediate's public key to check the leaf's signature. It uses the root's public key to check the intermediate's signature. Matching issuer names alone is not enough: the signatures must verify.

The root serves as a `trust anchor`, an authority accepted independently of this connection. Root certificates are commonly `self-signed`: their signature is made with their own private key. That self-signature does not create trust. The client accepts the root because its software vendor or administrator established trust separately. Sending an unfamiliar root with a server certificate does not make it trusted. [RFC 5280 explains this independent trust decision.](https://www.rfc-editor.org/rfc/rfc5280.html#section-6.1.1)

## What the server sends

The server sends its leaf certificate first, followed by the intermediate certificates needed for the chain. Each intermediate should certify the certificate before it. The root is usually omitted because the client already has its trust anchor. This is the chain format described by [TLS 1.3](https://www.rfc-editor.org/info/rfc9846/).

For an imaginary deployment:

1. The server sends a leaf for `api.example.com`, signed by `Intermediate I`.
2. It then sends `Intermediate I`, signed by `Root R`.
3. The browser independently trusts `Root R` and can build the path.

![A trusted root signs an intermediate CA certificate, which signs the server certificate. The server sends the intermediate and leaf; the client verifies their path to an independently trusted root.](./browser-chain-of-trust/chain-of-trust.png)

If the server sends only the leaf, the client may lack the intermediate's public key. Some clients can fetch missing intermediates or reuse cached ones. This can hide an incomplete server configuration. Do not assume every client can fill the gap; [Chromium's verification tests](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/net/cert/cert_verify_proc_unittest.cc) cover both successful and failed retrieval.

## Checks beyond the signatures

Building a path is only part of validation. The browser also checks:

- **CA permission.** Intermediate certificates must be allowed to sign certificates. Their `Basic Constraints` extension identifies CA status with `CA:TRUE`. Limits on chain length and permitted names must also hold.
- **Dates.** The leaf and intermediate certificates must be within their validity periods. The client's current time matters.
- **Purpose and strength.** Key Usage must permit the intended TLS operation. Extended Key Usage must permit server authentication when that restriction is present. Keys and signature algorithms must meet the client's security policy.
- **Critical extensions.** The client must reject a certificate if it cannot process a required critical extension.

These checks follow [X.509 path validation](https://www.rfc-editor.org/rfc/rfc5280.html#section-6), with additional [browser rules](https://chromium.googlesource.com/chromium/src/+/main/net/data/ssl/chrome_root_store/faq.md).

The browser separately checks the requested hostname against the leaf's `Subject Alternative Name (SAN)`. For `https://api.example.com`, a certificate containing only `www.example.com` fails even with a trusted chain. DNS resolving both names to the same IP address does not change that check. The expected name comes from the URL, not from the certificate or a DNS alias. [RFC 9525 defines service identity matching.](https://www.rfc-editor.org/rfc/rfc9525.html#section-6)

## Trust depends on the client

A `trust store` holds the client's accepted trust anchors. On macOS, browsers and other applications can use different stores and policies. Chrome has its own root store; Apple provides trusted roots for system trust evaluation. Success in one application does not guarantee success in another. See [Chrome's root store FAQ](https://chromium.googlesource.com/chromium/src/+/main/net/data/ssl/chrome_root_store/faq.md) and [Apple's certificate trust overview](https://support.apple.com/guide/deployment/depb5eff8914/web).

A private CA can serve internal applications when its clients independently trust it. An untrusted self-signed server certificate has no accepted trust anchor merely because its signature is valid.

## Additional browser policies

Browsers can require `Certificate Transparency (CT)`, evidence that a publicly trusted certificate was submitted to public logs. This helps make issuance visible. It does not replace the trusted chain or hostname check. [Chrome's CT documentation](https://chromium.googlesource.com/chromium/src/+/main/net/docs/certificate-transparency.md) describes its scope.

`Revocation` invalidates a certificate before its expiry date. Clients apply different revocation policies and use different sources of status information. Do not assume every browser makes a fresh online status request for every connection. [Chrome's FAQ](https://chromium.googlesource.com/chromium/src/+/main/net/data/ssl/chrome_root_store/faq.md) describes its approach.

## Check your reasoning

Assume all dates, constraints, and browser policies pass. The browser trusts `Root R`. The server sends the leaf for `api.example.com` and `Root R`, but omits `Intermediate I`. The browser has no cached intermediate and cannot fetch it.

Can it validate the chain? Would including more copies of the root help?

**Answer:** no. The leaf was signed by `Intermediate I`, not by `Root R`. The intermediate's certificate is missing, so the signature path has a gap. Sending the leaf and the correct intermediate repairs that gap. Opening `https://www.example.com` would still fail if the leaf covers only `api.example.com`.
