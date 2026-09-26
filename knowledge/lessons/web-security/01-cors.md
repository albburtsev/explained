---
slug: web-security/cors
title: CORS
description: Understand how browsers use CORS to share selected cross-origin responses, configure narrow permissions, and recognize its security limits.
tags:
  - web-security
  - browser-security
  - http
  - cors
---

A web application often loads its interface from one server and its data from another. For example, JavaScript at `https://app.example` might call an API at `https://api.example`. The browser treats these as different security boundaries even though their hostnames share a parent domain.

The **same-origin policy** normally prevents JavaScript from reading a response that belongs to another origin. **Cross-Origin Resource Sharing (CORS)** is the HTTP protocol through which the server can relax that restriction for selected origins. CORS is enforced by browsers; it is not an authentication system or a general network firewall.

## Identify an origin

An **origin** is the combination of a URL's scheme, host, and port. Paths do not participate.

Assume the page was loaded from `https://app.example`:

| URL | Same origin? | Reason |
| --- | --- | --- |
| `https://app.example/settings` | Yes | Scheme, host, and default port match. |
| `http://app.example` | No | Different scheme. |
| `https://api.example` | No | Different host. |
| `https://app.example:8443` | No | Different port. |

This boundary is stricter than “same site” or “same company.” When browser JavaScript uses `fetch()` across it, the response must pass a CORS check before the script can read it.

## Share a response deliberately

Suppose the application requests a public profile:

```js
const response = await fetch('https://api.example/profiles/42');
const profile = await response.json();
```

The browser adds the page's origin to the request:

```http
GET /profiles/42 HTTP/1.1
Host: api.example
Origin: https://app.example
```

If the API intends to share the response with that application, it returns:

```http
HTTP/1.1 200 OK
Content-Type: application/json
Access-Control-Allow-Origin: https://app.example
Vary: Origin

{"id":42,"name":"Ada"}
```

`Access-Control-Allow-Origin` names the origin whose code may read the response. If the header is absent or does not match, the API can still produce a `200` response, but the browser does not expose it to the calling JavaScript. This is why a CORS error can appear in the console even when the server log shows a successful request.

Use `Vary: Origin` when the allowed origin is selected dynamically from an allowlist. It tells HTTP caches that responses can differ by request origin. Do not copy an arbitrary `Origin` value into `Access-Control-Allow-Origin`; compare it with an explicit allowlist first.

For a resource that is genuinely public and does not use credentials, the server may allow every origin:

```http
Access-Control-Allow-Origin: *
```

The wildcard means any origin may read that response. It is suitable for public data, not private endpoints.

## Follow a preflight

Some cross-origin requests could not be produced by a basic HTML form. Before sending one, the browser usually makes an `OPTIONS` **preflight request**. For example, a `PUT` with JSON triggers a preflight:

```http
OPTIONS /profiles/42 HTTP/1.1
Host: api.example
Origin: https://app.example
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: content-type
```

The API can approve the proposed origin, method, and headers:

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example
Access-Control-Allow-Methods: PUT
Access-Control-Allow-Headers: Content-Type
Access-Control-Max-Age: 600
Vary: Origin
```

Only after a successful preflight does the browser send this `PUT`. `Access-Control-Max-Age` lets the browser cache the permission for a limited time.

Requests using CORS-safelisted methods and headers do not need a preflight. A cross-origin `GET` or a form-like `POST` may therefore reach the server before the browser checks whether its response can be shared. Never treat the presence of a preflight as authorization or rely on CORS alone to prevent state changes.

## Handle credentials cautiously

Cross-origin `fetch()` does not include credentials by default. If the application needs cookies or HTTP authentication, its code opts in:

```js
const response = await fetch('https://api.example/account', {
  credentials: 'include',
});
```

The response must opt in too:

```http
Access-Control-Allow-Origin: https://app.example
Access-Control-Allow-Credentials: true
Vary: Origin
```

For a credentialed request, `Access-Control-Allow-Origin: *` is not valid: the server must return a specific allowed origin. Normal cookie controls, including `SameSite` and browser third-party-cookie policies, still apply.

Allowing credentials gives the approved origin's scripts a way to read data in the user's authenticated context. Keep the origin allowlist as small as possible, and continue to authenticate the user and authorize every operation on the server.

## Keep the security boundary clear

CORS controls whether browser code can read a cross-origin response and, for preflighted requests, whether the browser proceeds with the proposed request. It does not solve every problem involving another website:

- **Authentication and authorization:** a non-browser client is not constrained by CORS. The server must still decide who the caller is and what they may do.
- **Cross-site request forgery (CSRF):** some cross-origin requests are sent without a preflight. Hiding the response does not undo a state change. Protect cookie-authenticated actions with measures such as suitable `SameSite` cookies, CSRF tokens, and server-side origin checks.
- **Cross-site scripting (XSS):** malicious code already running in an allowed origin receives that origin's authority. Prevent injection and use additional browser policies as defense in depth.
- **Clickjacking:** CORS does not control whether another page can frame your document. The next lesson uses CSP's `frame-ancestors` directive for that boundary.
- **Open redirects:** CORS does not validate a redirect destination. Application code must restrict destinations, commonly to known origins or local paths.

A useful question is not “Is CORS enabled?” but “Which response may which origin read, with which credentials?” That phrasing keeps the policy tied to a concrete trust decision.

## Design a narrow policy

Choose CORS behavior per resource instead of applying one permissive rule to the entire server:

| Resource | Intended caller | Suitable policy |
| --- | --- | --- |
| Public product catalogue | Any website, no credentials | `Access-Control-Allow-Origin: *` |
| Account API | `https://app.example`, with cookies | Exact allowed origin, `Access-Control-Allow-Credentials: true`, and `Vary: Origin` |
| Internal administration API | No browser-based cross-origin caller | Omit CORS headers; still require authentication and authorization |

Then allow only the methods and request headers the browser client actually needs. Broad CORS permissions are not a convenience setting: they enlarge the set of origins that can act as readers of your API.

## Diagnose a failed request

Use the browser's Network panel to follow the protocol:

1. Confirm the page and target URL really have different scheme, host, or port.
2. Inspect the request's `Origin` header.
3. If an `OPTIONS` request appears, verify its status and the matching `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers` values.
4. Inspect the actual response for one matching `Access-Control-Allow-Origin` value.
5. For a credentialed request, verify the exact origin and `Access-Control-Allow-Credentials: true`; do not replace the origin with `*`.

Changing the frontend request to `mode: 'no-cors'` is not a CORS fix. It normally gives JavaScript an opaque response whose body and most metadata cannot be read.

## Practice

Design the response headers for these two endpoints:

1. `GET https://api.example/timezones` contains public data that any website may read and never uses credentials.
2. `PUT https://api.example/account` accepts JSON only from `https://app.example` and uses a session cookie.

For each endpoint, decide the allowed origin, whether credentials are allowed, and whether a preflight is expected. You are done when your first policy uses the public wildcard without credentials and your second uses the exact application origin, permits `PUT` and `Content-Type` during preflight, returns `Access-Control-Allow-Credentials: true`, and retains normal server-side authentication, authorization, and CSRF protection.

## Official resources

- [Fetch Standard: CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol)
- [RFC 6454: The Web Origin Concept](https://www.rfc-editor.org/rfc/rfc6454.html)
- [MDN: Cross-Origin Resource Sharing](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
