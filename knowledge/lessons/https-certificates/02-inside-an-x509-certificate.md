---
slug: https-certificates/inside-an-x509-certificate
title: Inside an X.509 Certificate
description: Read the names, dates, keys, signatures, and usage constraints in an HTTPS certificate, and distinguish PEM from DER.
tags:
  - https
  - tls
  - certificates
  - x509
---

`X.509` defines the structure of the certificates used in HTTPS. A certificate contains public information and a digital signature. It never contains the matching private key. The server's own certificate is often called a `leaf certificate`, to distinguish it from certificates belonging to its issuer.

## Read a real certificate

For this exercise on macOS, use OpenSSL v3+. Run the commands in a practice directory: they create `server.pem`. The first command needs an internet connection.

```sh
openssl s_client -connect example.com:443 \
  -servername example.com -showcerts </dev/null \
  | openssl x509 -out server.pem
```

`s_client` opens a TLS connection. `-servername` sends the intended hostname through `Server Name Indication (SNI)`. This helps a server hosting several sites choose the right certificate. `-showcerts` prints the certificates sent by the server. `x509` reads the first certificate and saves it in PEM format.

This command collects a certificate for inspection. It does not prove that a browser would trust the connection. By default, `s_client` can continue after certificate verification errors, and this command does not request hostname verification. [OpenSSL documents this diagnostic behavior](https://docs.openssl.org/3.0/man1/openssl-s_client/#notes).

Print a short view, then the complete contents:

```sh
openssl x509 -in server.pem -noout -subject -issuer -serial -dates
openssl x509 -in server.pem -noout -text
```

`-noout` hides the encoded certificate. `-text` shows its fields and extensions. The certificate served by `example.com` changes over time, so use your current output rather than expecting fixed values. These options are described in the [OpenSSL certificate printing reference](https://docs.openssl.org/3.0/man1/openssl-x509/#certificate-printing-options).

## Separate the subject from the issuer

Read these fields in your output:

| Field | Meaning |
| --- | --- |
| `Subject` | Identifies the entity associated with the certificate's public key. It may include a common name or organization. |
| `Issuer` | Names the entity that signed the certificate, usually a `certificate authority (CA)`. Its name alone does not prove trust. |
| `Serial Number` | Identifies the certificate within that issuer's certificates. It is not a globally unique ID by itself. |
| `Not Before` | The start of the validity period. |
| `Not After` | The end of the validity period. |

Validity dates use UTC. OpenSSL normally displays them with `GMT`, so do not read them as your Mac's local time. The client checks its current time against this interval. See the [X.509 certificate fields in RFC 5280](https://www.rfc-editor.org/rfc/rfc5280.html#section-4.1.2).

## Find the names the certificate covers

`Subject Alternative Name (SAN)` is an extension listing identities covered by the certificate. For a website, look for `DNS:` entries. Modern HTTPS hostname checking uses SAN, without falling back to the subject's `Common Name (CN)`. A matching CN cannot repair a missing or incorrect SAN.

Print SAN alone:

```sh
openssl x509 -in server.pem -noout -ext subjectAltName
```

A `wildcard` covers one complete leftmost DNS label. For example, `*.example.com` covers `api.example.com` and `www.example.com`. It covers neither `example.com` nor `v2.api.example.com`. The bare domain needs its own SAN entry. Names do not include a URL path or port. An HTTPS URL using an IP address needs a matching `IP Address` SAN entry instead of a DNS entry. These rules come from [Service Identity in TLS](https://www.rfc-editor.org/rfc/rfc9525.html#section-6).

## Distinguish the key from the signature

`Subject Public Key Info (SPKI)` contains the subject's public key, its algorithm, and relevant parameters. In the full output, find `Public Key Algorithm` under this section. RSA and elliptic-curve keys have different parameters.

`Signature Algorithm` describes how the issuer signed this certificate. It belongs to a different operation. A CA can use an RSA signing key to sign a certificate containing an elliptic-curve public key. The two algorithm names do not have to match.

The certificate signature protects the signed fields from changes. It is checked with the issuer's public key. It is distinct from the server's handshake signature made with the server's private key. See [RFC 5280 on signature algorithms](https://www.rfc-editor.org/rfc/rfc5280.html#section-4.1.1.2) and [SPKI](https://www.rfc-editor.org/rfc/rfc5280.html#section-4.1.2.7).

## Read the usage constraints

Extensions also restrict what a certificate can do:

- `Basic Constraints` with `CA:FALSE` identifies a certificate that cannot act as a CA. A website's leaf certificate is not allowed to issue other certificates.
- `Extended Key Usage (EKU)` lists allowed purposes. `TLS Web Server Authentication`, also called `serverAuth`, allows server authentication. `clientAuth` is a separate purpose for authenticating clients.
- `Key Usage` restricts cryptographic operations, such as `Digital Signature`. It works together with EKU.

A correct hostname and valid dates do not override these restrictions. OpenSSL's [extension reference](https://docs.openssl.org/3.0/man5/x509v3_config/#standard-extensions) explains the field names.

![An X.509 certificate contains SAN names, a public key, validity dates, usage constraints, and a CA signature. The matching private key stays outside the certificate on the server.](./inside-an-x509-certificate/certificate-structure.png)

## Recognize PEM and DER

`DER` is a binary encoding. `PEM` stores encoded data as Base64 text between labelled boundaries. A PEM certificate starts with `-----BEGIN CERTIFICATE-----` and ends with `-----END CERTIFICATE-----`. Encoding changes how the certificate is stored, not its meaning. See [RFC 7468 on certificate encoding](https://www.rfc-editor.org/rfc/rfc7468.html#section-5).

Extensions such as `.crt`, `.cer`, and `.pem` do not guarantee the file's format. A PEM file can also contain several blocks, including separate certificates or a private key. A private-key block is a separate object, not part of a certificate.

To read a certificate you know is DER, specify the input format:

```sh
openssl x509 -inform DER -in server.der -noout -text
```

## Practice

Inspect `server.pem`. Find its SAN names, expiry time in UTC, subject public-key algorithm, and certificate signature algorithm.

Then consider a hypothetical certificate whose only DNS SAN is `*.example.com`. Which names match: `shop.example.com`, `example.com`, or `admin.shop.example.com`?

**Answer:** only `shop.example.com` matches. The wildcard replaces exactly one label. This establishes a name match; trust, validity, and permitted usage still need their own checks.
