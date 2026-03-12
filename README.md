# stack-intelligence-portal

Frontend repo for Stack Intelligence.

Live site:

- portal: `https://thestack.capital`

## What This Repo Owns

- the public/investor-facing Next.js site
- the operator UI under `/operator/**`
- server-side operator session handling in the portal
- API proxy routes that call `stack-intelligence-engine`
- Vercel deployment for the frontend

## What This Repo Does Not Own

- canonical registry, layer mapping, or research framework data
- workflow execution, review mutations, or operator run history generation
- backend business logic or operator read-model generation

Those belong to:

- `stack-knowledge` for canon
- `stack-intelligence-engine` for backend/runtime

## Current Route Surface

Public and investor-facing routes:

- `/`
- `/deck-react`
- `/deck-react-short`
- `/updates`
- `/data-room`
- `/investor-login`
- `/research-dashboard`

Operator routes:

- `/operator/login`
- `/operator/status`
- `/operator/world`
- `/operator/reviews`
- `/operator/runs`
- `/operator/publications`
- `/operator/bottlenecks`
- `/operator/routing`

Legacy operator-like `research-dashboard/*` routes now redirect to `/operator/*`.

## Local Development

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run typecheck
npm run lint
npm run build
```

## Environment

Local template:

- `.env.example`

Production ownership:

- Vercel Production environment owns real portal secrets
- this repo only owns committed templates and documentation

Required production vars:

- `NEXT_PUBLIC_API_BASE_URL=https://api.thestack.capital`
- `OPERATOR_ACCESS_HASH`
- `OPERATOR_SESSION_SECRET`

Optional production var:

- `ENGINE_OPERATOR_API_TOKEN` if engine bearer auth is enabled

Production rule:

- operator auth must not rely on `NEXT_PUBLIC_INVESTOR_ACCESS_HASH` or hard-coded defaults

## Canonical Doc

- `docs/current_state.md`
