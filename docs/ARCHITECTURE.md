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
