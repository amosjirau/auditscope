# AuditScope Product Specification

## Thesis
AuditScope verifies whether a published Web3 security audit actually covers the smart-contract code running onchain today.

## Target users
Exchanges, launchpads, investors, DeFi users, protocol teams, auditors, and security teams.

## Core question
Does the supplied audit still map to the current live deployment?

## V1 user flow
1. User uploads an audit PDF.
2. User selects Base Mainnet or Base Sepolia.
3. User enters a contract address.
4. AuditScope extracts the audit scope.
5. AuditScope investigates the live deployment and referenced repository.
6. Deterministic rules produce CURRENT, PARTIAL, STALE, or UNVERIFIED.
7. UI displays the verdict, confidence, evidence, and limitations.

## V1 exclusions
No auth, billing, wallet login, vulnerability scanning, generic crypto due diligence, sentiment analysis, token, DAO, social feed, or continuous monitoring.

## Product claim boundary
AuditScope does NOT state that a contract is secure or vulnerability-free. It only assesses audit-to-deployment coverage using available evidence.
