# Operator Auth And Session Plan

## Goal

Replace the temporary client-side `sessionStorage` gate on `/operator/**` with a narrow server-backed operator session flow, while adding the first real workflow trigger commands through the engine.

## Current Problem

- `/operator/**` is currently protected only by client-side `sessionStorage`.
- `/api/operator/**` proxy routes are not protected by a server session boundary.
- portal-to-engine calls do not have a dedicated operator authentication contract.
- workflow visibility exists, but workflow trigger commands do not.

## Narrow v1 Approach

### Portal operator session

- use an HTTP-only signed cookie as the canonical operator session
- validate login server-side in the portal
- protect `/operator/**` in server components, not client-only gates
- protect `/api/operator/**` route handlers with the same session check

Session payload in the cookie:

- `email`
- `issued_at`
- `expires_at`

This is intentionally small and reversible. It is not RBAC and it is not a full identity system.

### Portal to engine authentication

- portal server-side calls to engine attach `Authorization: Bearer <ENGINE_OPERATOR_API_TOKEN>` when configured
- engine operator endpoints require that bearer token only when the env var is configured
- this keeps local development runnable without deployment work while giving the operator boundary a real server-to-server contract

### What is protected now

Protect now:

- `/operator/**`
- `/api/operator/**`
- operator workflow trigger commands
- operator review actions

Leave for later:

- investor/deck auth redesign
- shared identity across investor and operator products
- RBAC
- external SSO
- engine-side persistent session storage

## First Workflow Command Slice

Add the first two operator-triggered workflow commands:

- `refresh-cycle`
- `build-review-queue`

For this slice, these remain narrow local worker shims:

- API creates a durable file-backed workflow run record
- API starts a background runner process
- runner updates the run record as steps execute
- existing operator runs page reads those run records back

The first `refresh-cycle` command is intentionally control-plane-only:

- build refresh state
- build review queue
- build review dashboard

It does not expand into full heavy queue execution, bottleneck runs, or routing runs yet.

## Success Criteria

- `/operator/**` is protected by a real server-backed session
- `/api/operator/**` is no longer callable without an operator session
- portal can trigger `refresh-cycle` and `build-review-queue`
- engine run status remains visible through the existing operator runs page
- the slice stays narrow and does not broaden into full auth platform or worker/scheduler infrastructure
