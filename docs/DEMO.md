# AuditScope 90-Second Demo

## 0-10s — Problem
Show an "AUDITED" badge. Explain that audits cover specific code at a specific point in time.

## 10-20s — Action
Open AuditScope, upload the controlled demo scope report, paste the Base Sepolia proxy address, and select Verify.

## 20-48s — Investigation
Show visible stages: parsing audit, resolving commit, resolving proxy, identifying implementation, comparing evidence.

## 48-65s — Wow moment
Display STALE. Show that the supplied scope covers VaultV1 while the live proxy points to VaultV2.

## 65-78s — Technical credibility
Open evidence. Explain that AI handles messy document understanding, while GitHub/Sourcify/onchain evidence and deterministic TypeScript rules determine the verdict.

## 78-90s — Close
"AuditScope doesn't claim a protocol is safe. It answers a narrower question exchanges, launchpads and users should be able to ask instantly: does this audit still cover what I'm using?"

## Demo reliability
Use two real Base Sepolia fixtures: one CURRENT and one STALE. Cache previously retrieved real evidence as a fallback, clearly identified as cached evidence.
