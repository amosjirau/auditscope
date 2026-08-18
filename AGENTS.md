# AuditScope Agent Instructions

AuditScope verifies whether a supplied Web3 security audit covers the smart-contract code currently running onchain.

## Source of truth
Read these files before changing code:
1. docs/PRODUCT.md
2. docs/ARCHITECTURE.md
3. docs/ACCEPTANCE.md
4. docs/DESIGN.md
5. docs/DEMO.md
6. docs/SECURITY.md
7. docs/KNOWN_ISSUES.md

## Non-negotiable architecture
- LLMs may extract and interpret evidence.
- LLMs MUST NOT directly set the final coverage verdict.
- Final verdicts are deterministic TypeScript outputs from validated evidence.
- AuditScope verifies audit-to-deployment coverage; it does not declare contracts safe.
- Never silently mock a P0 integration.

## P0 critical path
PDF audit -> structured scope -> chain/address lookup -> live implementation -> GitHub/audit evidence -> deterministic comparison -> CURRENT/PARTIAL/STALE/UNVERIFIED -> evidence UI.

## Build priorities
1. Types/schemas
2. Verification form
3. Audit PDF extraction
4. Sourcify adapter
5. GitHub adapter
6. Comparison/verdict engine
7. Result UI
8. Tests
9. Deployment hardening

## Engineering discipline
After each major milestone run: typecheck, lint, tests, production build. Fix failures before adding features.
