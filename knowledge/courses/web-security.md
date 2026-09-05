---
slug: web-security
title: Web Security
catalogOrder: 70
description: Learn how CORS, CSP, and layered CSRF defenses define trust boundaries and reduce common web security risks.
tags:
  - web-security
  - browser-security
  - http
lessons:
  - web-security/cors
  - web-security/csp
  - web-security/csrf
---

Browsers enforce several web standards that help applications limit what other origins can read, which resources a page can load, and where a document may be embedded. These controls form useful defense layers, but each addresses a specific trust boundary rather than every web vulnerability.

This course introduces two important browser-enforced policies: Cross-Origin Resource Sharing (CORS) and Content Security Policy (CSP). It then applies the same trust-boundary thinking to Cross-Site Request Forgery (CSRF), where browser controls and server-side checks work together. You will learn what each defense controls, how to configure it deliberately, and how to recognize problems that still require application-level protection. For example, CSP can help prevent clickjacking, while an open redirect still requires careful validation of redirect destinations.

## What you will learn

- How the same-origin policy and CORS govern cross-origin response access.
- How CSP restricts page capabilities and adds defenses against attacks such as script injection and clickjacking.
- How CSRF abuses ambient credentials and how to protect state-changing requests with layered defenses.
- How to distinguish a browser policy from a vulnerability that must be fixed in application logic.
