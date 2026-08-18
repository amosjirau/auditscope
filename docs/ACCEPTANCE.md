# AuditScope Acceptance Criteria

## P0 input
- [ ] PDF upload works.
- [ ] Base Mainnet/Base Sepolia selection works.
- [ ] EVM contract address is validated.

## P0 audit extraction
- [ ] PDF becomes a strict validated AuditScope object.
- [ ] Critical extracted values include evidence references and confidence.
- [ ] Missing values remain null; model must not invent them.

## P0 deployment evidence
- [ ] Contract lookup returns verification state.
- [ ] Normal contract flow works.
- [ ] EIP-1967/UUPS proxy detection works for demo fixture.
- [ ] Current implementation can be resolved for demo fixture.

## P0 GitHub evidence
- [ ] Repository URL is normalized.
- [ ] Referenced commit/tag is independently resolved.
- [ ] Relevant file can be fetched at the referenced commit when provided.

## P0 deterministic comparison
- [ ] Direct address comparisons work.
- [ ] Audited implementation vs live implementation works.
- [ ] Source comparison path works where strong evidence is available.
- [ ] LLM output alone can never produce a final verdict.

## P0 verdicts
- [ ] CURRENT supported.
- [ ] PARTIAL supported.
- [ ] STALE supported.
- [ ] UNVERIFIED supported.
- [ ] Confidence is separate from verdict.

## P0 UI
- [ ] Investigation tool/action progress is visible without exposing private chain-of-thought.
- [ ] Verdict is understandable in under 10 seconds.
- [ ] Evidence matrix is visible.
- [ ] Limitations/disclaimer are always visible.
- [ ] Mobile and desktop are usable.

## P0 reliability
- [ ] Invalid PDF fails safely.
- [ ] Invalid address fails safely.
- [ ] Missing audit scope becomes UNVERIFIED rather than guessed.
- [ ] Sourcify/GitHub/API failures do not become false successes.
- [ ] Production build passes.
- [ ] Demo fixture completes five consecutive times.
