---
slug: web-security/csrf
title: CSRF
description: Understand how CSRF abuses ambient credentials and protect state-changing requests with tokens, cookie controls, and request-context checks.
tags:
  - web-security
  - browser-security
  - http
  - csrf
---

**Cross-Site Request Forgery (CSRF)** is an attack in which another site causes a user's browser to send an unwanted request to an application where that user is authenticated. The browser may attach credentials automatically, so the server can mistake the attacker's request for the user's intent.

CSRF is about sending an authenticated action, not reading its response. This distinction explains why the same-origin policy and CORS are not complete CSRF defenses.

## Follow a forged request

Suppose `https://bank.example` authenticates a user with a session cookie that must support cross-site requests:

```http
Set-Cookie: __Host-session=abc123; Path=/; Secure; HttpOnly; SameSite=None
```

While the user is signed in, an attacker can place this form on `https://attacker.example`:

```html
<form action="https://bank.example/transfers" method="post">
  <input type="hidden" name="recipient" value="attacker">
  <input type="hidden" name="amount" value="500">
</form>
<script>
  document.querySelector('form').submit();
</script>
```

Submitting the form navigates to the bank and creates a form-like `POST` request. Because the session cookie is eligible for cross-site use, the browser attaches it even though the attacker cannot read its value:

```http
POST /transfers HTTP/1.1
Host: bank.example
Cookie: __Host-session=abc123
Content-Type: application/x-www-form-urlencoded
Origin: https://attacker.example

recipient=attacker&amount=500
```

If the server checks only the session cookie, it sees an authenticated request and may perform the transfer. The attacker does not need to see the response.

The `HttpOnly` attribute prevents JavaScript from reading the cookie, but the browser can still attach it to requests. CORS does not rescue this endpoint either: an HTML form can send this kind of request without a CORS preflight, and hiding the response does not undo the state change. CSP on the bank's pages cannot control a form created in the attacker's document.

## Keep safe methods free of side effects

Use `GET`, `HEAD`, and `OPTIONS` only for operations that do not change application state. A link such as this must not delete data:

```text
https://app.example/account/delete?id=42
```

This rule matters because `SameSite=Lax` allows cookies on some cross-site top-level navigations that use safe HTTP methods. If a `GET` performs a destructive action, an attacker may be able to trigger it with a link or navigation even when a cross-site `POST` would omit the cookie.

State-changing endpoints should use methods such as `POST`, `PUT`, `PATCH`, or `DELETE`, and they should reject requests that fail the application's CSRF checks. Choosing an unsafe method identifies the operation correctly; it does not protect the operation by itself.

## Limit ambient cookies with `SameSite`

Set `SameSite` explicitly on session cookies:

```http
Set-Cookie: __Host-session=abc123; Path=/; Secure; HttpOnly; SameSite=Lax
```

The modes make different tradeoffs:

| Value | Cross-site behavior | Typical effect |
| --- | --- | --- |
| `Strict` | Omits the cookie from cross-site requests, including top-level navigations. | Strong isolation, but following an external link can initially look signed out. |
| `Lax` | Omits the cookie from most cross-site subrequests and unsafe-method requests, but allows qualifying top-level navigations with safe methods. | A practical default for many sessions when safe methods have no side effects. |
| `None` | Allows the cookie in same-site and cross-site requests and requires `Secure`. | Necessary for some embedded or cross-site flows; requires stronger server-side CSRF defenses. |

`SameSite` uses the broader concept of a **site**, not the scheme-host-port origin boundary from the CORS lesson. A sibling subdomain can be same-site while still being cross-origin. Treat untrusted subdomains as part of the threat model, and do not use `SameSite` as the only defense for sensitive actions.

`Secure` protects cookie transport, and `HttpOnly` limits script access. Both are valuable, but neither independently proves that the user intended a request.

## Require a CSRF token

A **CSRF token** is an unpredictable value that the server associates with the user's session. The application places it in a legitimate page, and the client returns it with a state-changing request:

```html
<form action="/transfers" method="post">
  <input type="hidden" name="csrf_token" value="server-generated-random-value">
  <input name="recipient">
  <input name="amount" type="number">
  <button type="submit">Transfer</button>
</form>
```

Before changing state, the server verifies that the submitted token exists and matches the value associated with the current session. It rejects the request before performing any action when the token is missing or invalid.

The attacker's page can submit a form, but the same-origin policy prevents it from reading the legitimate page to discover the token. Generate tokens with a cryptographically secure random source, keep them secret, and never place them in a URL where logs, browser history, or referrer data may expose them. Prefer the CSRF protection built into your application framework over a custom implementation.

For a JavaScript client, send the token in a custom request header such as `X-CSRF-Token`. A plain cross-site form cannot set that header. The server must still validate the token, and the corresponding CORS policy must allow only trusted origins.

An XSS vulnerability can often read or submit a valid CSRF token from the trusted page. Output encoding, sanitization, safe DOM APIs, and the CSP defenses from the previous lesson therefore remain important.

## Verify where the request came from

For state-changing requests, the server can compare the `Origin` header with an exact allowlist of trusted origins:

```http
Origin: https://app.example
```

Compare the complete scheme, host, and port rather than using substring or suffix matching. If `Origin` is absent, a carefully parsed `Referer` header can be a fallback. Decide explicitly whether requests with missing, malformed, or `null` origins are valid for a particular endpoint; sensitive endpoints should fail closed unless a documented client flow requires an exception.

Reverse proxies can change the host information the application sees, so configure the expected target origin rather than trusting arbitrary forwarded headers. Origin validation complements a token: it supplies useful request context but can require exceptions for privacy-sensitive clients or legitimate cross-origin integrations.

Modern browsers can also send **Fetch Metadata** headers. `Sec-Fetch-Site` describes the relationship between the initiator and target:

```http
Sec-Fetch-Site: cross-site
```

Its defined values include `same-origin`, `same-site`, `cross-site`, and `none`. A server-side policy can reject a state-changing request when the value is `cross-site`:

```js
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

if (request.headers.get('Sec-Fetch-Site') === 'cross-site' &&
    !safeMethods.has(request.method)) {
  return new Response('Forbidden', { status: 403 });
}
```

Treat `same-site` cautiously when sibling subdomains are not equally trusted. Some clients may omit Fetch Metadata headers, so define a fallback based on CSRF tokens and origin validation instead of silently treating absence as proof of safety. Roll out a new metadata policy in logging mode first so legitimate integrations can be identified.

## Choose defenses for the endpoint

For a conventional application authenticated by a session cookie, a solid baseline is:

1. Keep safe HTTP methods free of state changes.
2. Set the session cookie's `Secure`, `HttpOnly`, and explicit `SameSite` attributes.
3. Require a framework-provided CSRF token on unsafe methods.
4. Validate `Origin` when present and define a strict fallback when it is absent.
5. Reject clearly cross-site unsafe requests using Fetch Metadata where supported.
6. Require fresh authentication or an explicit confirmation step for especially sensitive actions.

An API that accepts a bearer token only from an explicit `Authorization` header is less exposed to classic CSRF because browsers do not attach that header automatically. That design has different risks, especially around token storage and XSS, so base the decision on how credentials actually reach the server rather than on whether the endpoint returns JSON.

## Review an endpoint

Audit one state-changing endpoint by answering these questions:

1. Can another site trigger the request with a form, link, image, or script?
2. Which credentials does the browser attach automatically?
3. Does the endpoint misuse `GET` or another safe method for a state change?
4. What exact `SameSite` behavior does its session cookie declare?
5. Does the server verify a CSRF token before changing state?
6. How does it handle unexpected, missing, or `null` origin information?
7. Would it reject `Sec-Fetch-Site: cross-site` for an unsafe method?

The endpoint has a meaningful CSRF defense only when the server can distinguish a request produced by the legitimate application from one another site can cause the browser to send. Use multiple independent signals so one compatibility exception does not silently remove all protection.

## Official resources

- [OWASP: Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [HTTP Working Group: Cookies — SameSite](https://httpwg.org/http-extensions/draft-ietf-httpbis-rfc6265bis.html#name-the-samesite-attribute)
- [W3C: Fetch Metadata Request Headers](https://www.w3.org/TR/fetch-metadata/)
- [Fetch Standard: `Origin` header](https://fetch.spec.whatwg.org/#origin-header)
