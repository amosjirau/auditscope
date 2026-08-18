# AuditScope Security & Trust Boundaries

1. Never expose API keys client-side.
2. Treat uploaded PDFs and extracted text as untrusted input.
3. Validate every model output using Zod/JSON schema.
4. The model cannot set authoritative coverage verdicts.
5. Weak evidence cannot be promoted to strong evidence by model confidence.
6. External API failures must fail closed to UNVERIFIED/error, never CURRENT.
7. Limit uploaded PDF size and accepted MIME types.
8. Apply timeouts and bounded retries to external calls.
9. Validate chain ID and EVM addresses.
10. Never describe CURRENT as "safe", "secure", or "vulnerability-free".
11. Do not execute arbitrary repository code.
12. Investigation agent tool loop must be bounded.
