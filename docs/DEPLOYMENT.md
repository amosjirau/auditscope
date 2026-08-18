# AuditScope Vercel deployment

AuditScope's public deployment is a Next.js Node.js application. The browser only sends a PDF, chain ID, and contract address to `/api/verify`; Gemini, GitHub, RPC, and Sourcify configuration is read inside server code.

## Required environment variables

Configure every variable in Vercel for Production and Preview. Add Development scope if using `vercel env pull` locally.

| Variable | Secret | Purpose |
|---|:---:|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | yes | Authenticates server-side Gemini PDF extraction |
| `GEMINI_MODEL` | no | Explicit model identifier; AuditScope never silently changes it |
| `GITHUB_TOKEN` | yes | Stabilizes GitHub commit and source retrieval; use minimum read-only access |
| `BASE_MAINNET_RPC_URL` | potentially | Server-side Base Mainnet JSON-RPC endpoint; URLs can contain credentials |
| `BASE_SEPOLIA_RPC_URL` | potentially | Server-side Base Sepolia JSON-RPC endpoint; URLs can contain credentials |
| `SOURCIFY_API_URL` | no | Sourcify server root, normally `https://sourcify.dev/server` |

None of these names may use a `NEXT_PUBLIC_` prefix. Do not add `BASE_SEPOLIA_FIXTURE_PRIVATE_KEY` or any deployer key: the controlled contracts are already deployed and the application never signs transactions.

## Vercel setup

1. Import `amosjirau/auditscope` as a Next.js project.
2. Keep the default Node.js runtime and enable Fluid compute.
3. Add the six required variables in Project Settings -> Environment Variables.
4. Scope production credentials to Production; use separate Preview credentials when possible.
5. Deploy and open the landing page.
6. Run the CURRENT and STALE controlled presets. Each must visibly traverse Gemini, GitHub, Base RPC, Sourcify, and deterministic comparison.

The route exports `maxDuration = 300`. AuditScope accepts PDFs up to 4 MB so multipart overhead remains under Vercel's 4.5 MB function request limit.

## Local environment

Copy `.env.example` to `.env.local` and populate values. `.env.local` is gitignored.

With the Vercel CLI:

```bash
vercel link
vercel env pull .env.local --environment=development
```

`vercel env pull` replaces the target file. Preserve intentional local-only overrides before pulling again.

## Fail-closed operations

- A missing environment variable returns a server-configuration error before PDF processing.
- Quota exhaustion, temporary rate limits, model timeouts, and schema-invalid Gemini output have distinct public messages.
- Model output must pass `auditScopeSchema`; rejected output cannot produce a verdict.
- AuditScope does not switch `GEMINI_MODEL` automatically.
- Demo presets cache only the public synthetic PDF asset in the browser. Evidence and verdicts are always retrieved live.
- No cached evidence or cached verdict fallback is implemented.
- External GitHub, Sourcify, or RPC failures remain visible as unresolved evidence and cannot become CURRENT.

## Pre-deploy checklist

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- Confirm no `NEXT_PUBLIC_` secret variable exists.
- Confirm no fixture private key exists in Vercel, `.env*`, logs, or the deployment bundle.
- Confirm the selected Gemini project has sufficient quota and paid billing if the demo expects sustained traffic.
- Confirm CURRENT and STALE presets state that the PDF is synthetic and still execute the live production pipeline.
