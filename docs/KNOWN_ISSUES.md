# Known Issues

- A live PDF-to-Gemini run and the five-consecutive-run demo check have not been executed in this workspace because `GOOGLE_GENERATIVE_AI_API_KEY` is not configured. The extraction endpoint fails explicitly until a key is provided; it does not substitute mock scope data.
- No controlled CURRENT/STALE Base Sepolia PDF fixtures or cached real-evidence fallback are bundled yet. The deterministic pipeline is covered with injected fixture evidence, while live Sourcify v2 response structure was checked against Base Mainnet.
- Audit PDFs vary widely in how they identify scope. Missing values, citations, repository refs, or source paths remain unresolved and can produce PARTIAL or UNVERIFIED.
- V1 supports ordinary contracts and proxies resolved by Sourcify or the EIP-1967 implementation slot. Other proxy architectures return unresolved evidence.
- Source comparison is deliberately exact after newline/trailing-whitespace normalization. Renamed or generated source files remain unresolved rather than being matched semantically.
- GitHub source retrieval is bounded to the first 20 audited source files. A token is optional for public repositories but recommended to avoid anonymous API rate limits.
- The P0 endpoint limits PDFs to 12 MB and holds each accepted PDF in server memory during extraction. Application-level rate limiting is not included in Day 1.
