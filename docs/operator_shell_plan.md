# Operator Shell Plan

## Goal

Introduce `/operator/**` as the canonical operator product surface while preserving current operator functionality during the transition away from `research-dashboard/**`.

## Current Audit

- Operator pages currently live under `research-dashboard/**`:
  - `/research-dashboard/status`
  - `/research-dashboard/reviews`
  - `/research-dashboard/runs`
  - `/research-dashboard/publications`
  - `/research-dashboard/bottlenecks`
  - `/research-dashboard/routing`
- Those routes are mixed into a product area that also hosts research-facing surfaces:
  - `/research-dashboard`
  - `/research-dashboard/dashboard`
  - `/research-dashboard/world`
- Current auth/session assumptions are investor-shaped:
  - [InvestorAuthGate](/Users/isaacentebi/Desktop/stack-intelligence-portal/components/ui/InvestorAuthGate.tsx) guards the research dashboard shell.
  - [investor-login/page.tsx](/Users/isaacentebi/Desktop/stack-intelligence-portal/app/investor-login/page.tsx) writes `sessionStorage["investor_auth"]`.
  - `/proprietary-data-login` is still aliased to the research dashboard root.
- There is no dedicated operator shell, operator login route, or operator navigation model.
- Backend/API contracts are already sufficient for the first shell migration and should stay unchanged.

## Recommended Route Map

Canonical operator routes:

- `/operator`
- `/operator/login`
- `/operator/status`
- `/operator/reviews`
- `/operator/runs`
- `/operator/publications`
- `/operator/bottlenecks`
- `/operator/routing`

Temporary research routes that stay as research-facing surfaces:

- `/research-dashboard`
- `/research-dashboard/dashboard`
- `/research-dashboard/world`

Temporary research routes that should redirect to canonical operator routes:

- `/research-dashboard/status` -> `/operator/status`
- `/research-dashboard/reviews` -> `/operator/reviews`
- `/research-dashboard/runs` -> `/operator/runs`
- `/research-dashboard/publications` -> `/operator/publications`
- `/research-dashboard/bottlenecks` -> `/operator/bottlenecks`
- `/research-dashboard/routing` -> `/operator/routing`

## Auth Boundary Recommendation

First cut:

- add an operator-specific auth gate for `/operator/**`
- add `/operator/login` as the canonical operator entry
- use `sessionStorage["operator_auth"]` as the canonical operator session marker
- temporarily honor `sessionStorage["investor_auth"]` in the operator gate as a compatibility bridge
- temporarily set both `operator_auth` and `investor_auth` on operator login so legacy research surfaces still work during transition

Explicit non-goals in this slice:

- no backend auth redesign
- no cookie/session server model
- no deployment or middleware expansion
- no deck or investor presentation route changes

## First Implementation Slice

1. Add an operator shell with coherent navigation.
2. Add `/operator/login` and an operator-specific auth gate.
3. Add canonical `/operator/**` pages for:
   - status
   - reviews
   - runs
   - publications
   - bottlenecks
   - routing
4. Convert the corresponding `research-dashboard/**` operator routes into redirects.

## Success Criteria

- operator functionality has a coherent home under `/operator/**`
- old operator-like research routes still work through redirects
- auth/session behavior is no longer branded or framed as investor-first for operator surfaces
- backend/API contracts remain unchanged
