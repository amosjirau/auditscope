# Known Issues

- Live PDF extraction was validated with `gemini-3.5-flash` against ChainSecurity's public Polkadot Claims report; the sanitized result is stored under `fixtures/live-extraction/`. The five-consecutive-run full verdict demo check has not been executed.
- The previous `gemini-2.5-flash` default is unavailable for this API account, and `gemini-3.6-flash` timed out through the current AI SDK even for a minimal text request. `gemini-3.5-flash` completed both the SDK compatibility probe and the audit PDF extraction.
- No controlled CURRENT/STALE Base Sepolia full-verdict fixtures or cached real-evidence fallback are bundled yet. The deterministic pipeline is covered with injected fixture evidence, while live Sourcify v2 response structure was checked against Base Mainnet.
- Audit PDFs vary widely in how they identify scope. Missing values, citations, repository refs, or source paths remain unresolved and can produce PARTIAL or UNVERIFIED.
- Address exclusivity is extracted only when the report explicitly states that deployment identity is a scope boundary. Ambiguous wording leaves the address mismatch informational and makes exact source evidence authoritative.
- V1 supports ordinary contracts and proxies resolved by Sourcify or the EIP-1967 implementation slot. Other proxy architectures return unresolved evidence.
- Source comparison is deliberately exact after newline/trailing-whitespace normalization. Renamed or generated source files remain unresolved rather than being matched semantically.
- Sourcify `match` responses are insufficient for authoritative source equivalence even when returned source text hashes equally. Only `exact_match` can promote source correspondence to strong covered or mismatched evidence.
- PDF citations are displayed for inspection, but AuditScope does not independently verify that Gemini copied every excerpt faithfully against a separate PDF text layer in Day 1. Downstream GitHub/Sourcify/RPC corroboration remains required for a strong verdict.
- GitHub source retrieval is bounded to the first 20 audited source files. A token is optional for public repositories but recommended to avoid anonymous API rate limits.
- The P0 endpoint limits PDFs to 12 MB and holds each accepted PDF in server memory during extraction. Application-level rate limiting is not included in Day 1.
