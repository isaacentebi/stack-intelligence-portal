# Portal Current State

`stack-intelligence-portal` is the deployed Next.js frontend for both the
public site and the operator UI.

## Product Split

Public and investor-facing pages stay in this repo as normal Next.js routes.

Operator tooling now lives under `/operator/**` and is the canonical operator
surface.

Legacy compatibility routes under `research-dashboard/*` redirect to the
matching `/operator/*` routes where applicable.

## Auth Boundary

Operator auth is already server-backed in the portal:

- login route: `/operator/login`
- session cookie: signed, HTTP-only cookie from `lib/operator-session.ts`
- protected route shell: `app/operator/(shell)/layout.tsx`
- protected API proxies: `app/api/operator/**`

## Engine Integration

The portal calls the engine through `lib/engine-api.ts`.

Current shape:

- browser calls portal route handlers
- portal route handlers call `stack-intelligence-engine`
- operator routes can attach `ENGINE_OPERATOR_API_TOKEN` for engine-side bearer
  auth

Current engine-backed surfaces include:

- `/api/world-model/**`
- `/api/research/live`
- `/api/operator/**`

## Deployment

- portal is deployed on Vercel at `https://thestack.capital`
- engine is deployed separately at `https://api.thestack.capital`

This repo should document UI routes, auth/session behavior, and engine
integration only. It should not describe backend architecture as if it lives
here.
