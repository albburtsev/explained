---
slug: https-certificates/diagnosing-certificate-errors
title: Diagnosing Certificate Errors
description: Use curl and OpenSSL on macOS to trace hostname, chain, trust, validity, and deployment errors.
tags:
  - https
  - tls
  - certificates
  - debugging
---

A certificate error tells you that a check failed. It does not always tell you which component needs repair. Start with the failing client, then inspect the certificate that client actually receives.

## Start with the client and endpoint

Record the exact URL, the error, and whether other clients or networks reproduce it. Confirm where TLS ends: a CDN, load balancer, proxy, or your application.

On macOS, make a fresh request with curl:

```sh
curl -v --output /dev/null https://example.com/
```

`-v` shows connection details and request and response headers. Look for the selected address, certificate verification error, and whether an HTTP response arrived. curl checks the certificate and hostname by default. Its trust source depends on its build; it can differ from your browser's. See the [curl option reference](https://curl.se/docs/manpage.html#-v) and [certificate verification guide](https://curl.se/docs/sslcerts.html).

On a fresh connection, a server certificate failure stops TLS authentication before an ordinary HTTP request reaches the application. Changing CORS headers cannot repair it. A browser may report a network or TLS failure as a failed CORS request; [MDN lists invalid certificates among these causes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS/Errors/CORSDidNotSucceed).

## Inspect the handshake and certificate

These macOS commands use OpenSSL v3+. Work in a practice directory: the commands create `tls-session.txt` and `server.pem`. The connection needs internet access.

```sh
openssl s_client -connect example.com:443 \
  -servername example.com -verify_hostname example.com \
  -verify_return_error -showcerts </dev/null > tls-session.txt
```

The options have separate jobs:

- `-connect` chooses the network endpoint.
- `-servername` sends SNI so the server can select a certificate.
- `-verify_hostname` checks the expected hostname.
- `-verify_return_error` stops on certificate verification errors. Without it, this diagnostic tool can continue after those errors.
- `-showcerts` records the certificates the server sent, in their sent order. This list is not a verified chain.

Read the terminal errors and saved file. A completed TLS connection alone is insufficient evidence of successful verification. [OpenSSL documents these options](https://docs.openssl.org/3.0/man1/openssl-s_client/#options).

If the server sent a certificate, extract the first one, the leaf, and print its useful fields:

```sh
openssl x509 -in tls-session.txt -out server.pem
openssl x509 -in server.pem -noout -subject -issuer -dates \
  -ext subjectAltName
```

Check the SAN against the requested hostname and the dates against the client's current time in UTC. Inspect the other certificates in `tls-session.txt` when investigating a chain failure. Printing or saving a certificate does not verify it. Real certificate values change, so no fixed issuer or dates are expected. The [OpenSSL X.509 reference](https://docs.openssl.org/3.0/man1/openssl-x509/#certificate-printing-options) explains the fields.

## Separate the address from the hostname

To test one server in your deployment, replace the hostname and documentation IP address below with your own values:

```sh
curl -v --resolve example.com:443:203.0.113.10 \
  --output /dev/null https://example.com/
```

`--resolve` changes the connection address while keeping the URL hostname for SNI and certificate checking. Repeat with each server's address to find a stale replica. [curl documents this address override](https://curl.se/docs/manpage.html#--resolve).

Opening `https://203.0.113.10/` instead asks the client to authenticate that IP address. Adding an HTTP `Host` header cannot restore the earlier TLS hostname check. DNS sending you to the wrong endpoint, or incorrect SNI configuration there, can produce a valid certificate for the wrong site. [Service Identity in TLS defines the expected identity](https://www.rfc-editor.org/rfc/rfc9525.html#section-6).

## Match the evidence to the repair

Exact messages vary between clients. Use them to choose the next check:

| Failure | Symptom | Likely cause | Repair |
| --- | --- | --- | --- |
| DNS or connection | Host cannot be resolved, or connection fails before a certificate arrives. | Wrong address, unavailable listener, or network failure. | Check DNS, port, and reachability first. |
| Name mismatch | Certificate SAN does not cover the requested hostname. | Wrong certificate, endpoint, or SNI mapping. | Fix routing or deploy a certificate covering that hostname. |
| Dates | Certificate is expired or not yet valid. | Served certificate is outside its validity period, or the client clock is wrong. | Check UTC time; deploy a valid replacement or correct the clock. |
| Missing intermediate | Issuer cannot be found and the sent list has a gap. | Server sends an incomplete chain. | Serve the leaf followed by the correct intermediates. |
| Untrusted root | A complete path ends at a CA the client does not trust. | Private CA, unsupported public chain, or different trust store. | Check the intended trust source and choose the appropriate chain. |
| Key mismatch | Server rejects certificate configuration at startup or reload. | Wrong private key or wrong first certificate in the chain file. | Compare the public keys and put the leaf first. |

An error such as `unable to get local issuer certificate` does not uniquely identify a missing intermediate. An absent trusted root can also prevent path building. Compare the sent chain with the client's trusted roots. [NGINX explains incomplete chains and key mismatches](https://nginx.org/en/docs/http/configuring_https_servers.html#chains); [OpenSSL explains trusted certificate inputs](https://docs.openssl.org/3.0/man1/openssl-verification-options/#trusted-certificate-options).

## Test an intended private CA

For the local server from the deployment lesson, use your intended private CA's root, obtained through a trusted source. Save it as `private-root.pem`:

```sh
curl -v --cacert private-root.pem https://localhost:8443/
```

For the same test with `s_client`, supply `-CAfile private-root.pem` along with the hostname and error-checking options. These flags provide trust input for that invocation. They do not add system-wide trust. Do not treat a root received from an unknown server as trusted merely to make its error disappear. [curl describes custom CA files](https://curl.se/docs/sslcerts.html).

OpenSSL, curl, and browsers can use different trust stores and validation policies. Success here does not prove browser acceptance, including its transparency and revocation rules. Recheck with the client that originally failed.

## Practice

Two servers answer for `api.example.com`. Requests sometimes fail with an expired certificate. Testing each address with `--resolve` shows that one serves the replacement and the other serves the old certificate. The replacement file exists on both. What should you repair?

**Answer:** activate the replacement on the stale TLS endpoint, then test both addresses again using the intended hostname. A file on disk does not prove that the running service loaded it. Changing application headers cannot fix the certificate it presents.
