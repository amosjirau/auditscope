# AuditScope Architecture

## Core pipeline
User -> Next.js UI -> Audit Scope Extractor (AI) -> Investigation Tools -> Evidence Package -> Deterministic Verdict Engine -> Evidence UI.

## AI responsibilities
- Parse heterogeneous audit PDFs.
- Extract repository, commit/tag, contract names, addresses, source files, dates, exclusions and uncertainties.
- Select bounded investigation tools based on available evidence.
- Explain final deterministic results in plain language.

## AI prohibitions
The model must never independently output CURRENT, PARTIAL, STALE, or UNVERIFIED as the authoritative system verdict.

## Evidence sources
- Audit PDF: historical scope claims.
- GitHub: historical commit/file evidence.
- Sourcify: live verification/source/proxy evidence.
- Base RPC: fallback for bytecode/proxy data where required.

## Supported V1 networks
- Base Mainnet, chainId 8453
- Base Sepolia, chainId 84532

## Supported V1 deployment patterns
- Normal contracts
- EIP-1967/UUPS proxy flows that can be resolved reliably
Other proxy architectures return UNVERIFIED unless explicitly supported.

## Evidence hierarchy
Strong: explicit audited/live address mapping; independently verified audit commit/source; exact verified live source; live proxy implementation.
Weak: matching filename, matching contract name, website audit badge, semantic similarity.
Weak evidence alone cannot produce CURRENT or STALE.

## Deterministic verdict semantics
- Gemini extraction is a citation-bearing audit claim, not independently verified evidence. Zod validation establishes shape only.
- A listed audit address is not automatically an exclusive scope boundary. An address mismatch is decisive only when the audit explicitly states, with a citation, that coverage is limited to that deployment/address.
- When address identity is not an explicit scope boundary, an exact redeployment of the audited source may still be CURRENT.
- Source equality or difference is authoritative only when Sourcify reports `exact_match` for the applicable live contract. For a proxy, the applicable contract is the resolved implementation.
- Source text returned under Sourcify `match` is non-decisive and remains unresolved for coverage. It cannot independently earn CURRENT or STALE.
- A complete set of exact historical/live source mismatches is decisive STALE; mixed or missing source evidence is PARTIAL or UNVERIFIED according to the other critical evidence.
