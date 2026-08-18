# First Codex Mission

You are the lead engineer for AuditScope.

Read `AGENTS.md` and every file in `docs/` before writing code.

Implement Day 1 only. The P0 flow is:

PDF audit -> validated structured audit scope -> Base address lookup -> current deployment/proxy resolution -> GitHub historical evidence -> deterministic comparison -> evidence-backed verdict.

Do not build auth, billing, wallets, tokens, vulnerability scanning, dashboards, generic research, or continuous monitoring.

Requirements:
- Use strict TypeScript.
- Use Zod at external/model boundaries.
- Use Gemini for PDF extraction; never invent absent values.
- Use Sourcify API v2 for primary live verification/proxy evidence.
- Use GitHub API for historical commit/file evidence.
- The model must not set the authoritative verdict.
- External failures must not become false successes.
- Show observable investigation stages, not private reasoning.
- Implement tests for CURRENT, STALE, PARTIAL, UNVERIFIED and failure paths.
- Run typecheck, lint, tests and production build after each major milestone.
- Keep `docs/KNOWN_ISSUES.md` current.

Day-1 exit condition: a real request can travel from PDF + Base address to an ugly but evidence-backed deterministic verdict.
