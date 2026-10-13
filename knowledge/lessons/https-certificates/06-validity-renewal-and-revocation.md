---
slug: https-certificates/validity-renewal-and-revocation
title: Validity, Renewal, and Revocation
description: Keep HTTPS certificates in service through timely renewal, verified deployment, key rotation, and revocation.
tags:
  - https
  - tls
  - certificates
  - acme
---

A certificate deployment can work today and fail next week without any application change. The certificate has a limited lifetime. Keeping HTTPS working means managing issuance, deployment, and the next replacement as one process.

## Understand the validity interval

The certificate's `validity period` runs from `notBefore` to `notAfter`. These are UTC times. During certificate validation, the client checks its current time against that interval. A wrong client clock can make a certificate look expired or not yet valid. [RFC 5280 defines these dates](https://www.rfc-editor.org/rfc/rfc5280.html#section-4.1.2.5).

Expiry does not erase the private key or change the certificate's bytes. It means the certificate no longer passes the date check. Read the actual dates instead of assuming every certificate has the same lifetime.

## Separate renewal from key rotation

`Renewal` obtains a new certificate to replace the old one. It does not extend the old certificate's dates. Those dates are signed, so editing them would break the CA signature. The replacement has its own validity period and serial number.

`Key rotation` replaces the key pair as well. Routine renewal can reuse an existing key or create a new one, depending on the client's configuration and policy. For example, [Certbot supports both choices](https://eff-certbot.readthedocs.io/en/stable/using.html#certbot-command-line-options). Check which behavior your automation uses.

A new certificate with the same public key does not solve a leaked private key. An attacker still holds the matching secret.

## Schedule replacement before expiry

Run certificate automation regularly and leave time for retries and deployment failures. Avoid a fixed rule such as “renew every two months”: certificate lifetimes can change.

`ACME Renewal Information (ARI)` lets a CA suggest a renewal window for a certificate. When both the CA and client support it, the client checks for updated advice and chooses when to renew within that window. The CA can suggest earlier renewal before a planned revocation. [RFC 9773 defines ARI](https://www.rfc-editor.org/rfc/rfc9773.html).

Keep a fallback schedule based on the certificate's actual lifetime. ARI requests can fail, and some clients or CAs do not support ARI. The [Let's Encrypt integration guide](https://letsencrypt.org/docs/integration-guide/#when-to-renew) describes scheduling and retries.

## Finish renewal at the TLS endpoint

Treat renewal as complete only after clients receive the replacement:

1. **Obtain it.** The ACME client requests and downloads the new certificate and intermediate chain. Any required domain validation must still work.
2. **Deploy it.** Put the certificate, chain, and matching private key at every point that terminates TLS, including proxies or managed services.
3. **Activate it.** Make each service load the replacement. Some services reload automatically; others need a reload or an update through their management interface.
4. **Verify it.** Open fresh TLS connections using the intended hostname. Check the certificate being served, its names, expiry, and chain. Cover all replicas and regions; one successful connection can miss a stale server.
5. **Monitor it.** Alert on issuance or deployment failures and on the remaining lifetime of the certificate clients actually receive. Allow enough time for someone to fix the problem.

Certbot, for example, has [deployment hooks that run after successful renewal](https://eff-certbot.readthedocs.io/en/stable/using.html#renewing-certificates). Obtaining a new file alone does not prove that a running server has loaded it.

![Renewal repeats five steps before expiry: obtain a new certificate, deploy it, activate it, verify it, and monitor it.](./validity-renewal-and-revocation/renewal-cycle.png)

## Revoke an unsafe certificate

`Revocation` is the CA's declaration that a certificate should no longer be trusted before it expires. A private-key leak or incorrect issuance can require revocation. Request it through the CA's supported process; an ACME client can usually handle the request. [Let's Encrypt describes authorized revocation requests](https://letsencrypt.org/docs/revoking/).

If a certificate's private key is exposed, respond promptly:

- Restore secure control of the affected systems so a replacement key will stay secret.
- Generate a new key pair and obtain a certificate for its public key.
- Deploy and verify the replacement at every affected TLS endpoint.
- Request revocation of every still-valid certificate using the compromised key. Do not wait for normal expiry.

Removing a leaked file from a repository does not make its contents secret again. Replacing the certificate on your server also does not invalidate an attacker's copy.

## Understand how clients learn about revocation

A `Certificate Revocation List (CRL)` is a signed list of revoked certificates. `Online Certificate Status Protocol (OCSP)` provides signed status responses for identified certificates. These are different ways to publish status, described in [RFC 5280](https://www.rfc-editor.org/rfc/rfc5280.html#section-3.3) and [RFC 6960](https://www.rfc-editor.org/rfc/rfc6960.html#section-2).

Clients use different policies, caches, and status sources, including lists distributed by browser vendors. Revocation does not instantly block a certificate in every client. Do not assume a browser sends a live OCSP request for every connection. [Chrome's FAQ explains its revocation approach](https://chromium.googlesource.com/chromium/src/+/main/net/data/ssl/chrome_root_store/faq.md).

Support also differs between CAs. Let's Encrypt [ended its OCSP service in August 2025](https://letsencrypt.org/2025/08/06/ocsp-service-has-reached-end-of-life) and publishes revocation information through CRLs.

## Check the operation

Two frontends serve `api.example.com`. The old certificate expires in six days. Automation obtains a replacement and copies it to both frontends. The first loads it, but the second keeps serving the old certificate. The issuance job reports success. Is renewal complete? What changes if the old private key also appeared in a public repository?

**Answer:** renewal is incomplete. Verify both frontends through fresh TLS connections and activate the replacement on the stale frontend. Monitor the certificate served to clients, not only the issuance job. If the key leaked, use a new key pair, deploy its certificate everywhere, and promptly revoke affected certificates using the old key. A routine renewal that reuses the leaked key leaves the attacker able to authenticate with it.
