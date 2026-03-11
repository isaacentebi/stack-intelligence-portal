# Operator World-Model Redesign Plan

## Goal

Redesign the world-model experience as an operator tool, not a presentation artifact or a lightly polished taxonomy browser.

The operator surface should help a human answer:

- what node am I looking for
- what is the current accepted state for that node
- which companies matter in that node
- what bottleneck or routing state is attached to it
- what depends on it upstream and downstream
- what pending review context exists around it

## Current Audit

Current route and component shape:

- route: [app/research-dashboard/world/page.tsx](/Users/isaacentebi/Desktop/stack-intelligence-portal/app/research-dashboard/world/page.tsx)
- main UI: [components/world-model/WorldModel.tsx](/Users/isaacentebi/Desktop/stack-intelligence-portal/components/world-model/WorldModel.tsx)
- data adapters:
  - [app/api/world-model/summary/route.ts](/Users/isaacentebi/Desktop/stack-intelligence-portal/app/api/world-model/summary/route.ts)
  - [app/api/world-model/nodes/[nodeId]/route.ts](/Users/isaacentebi/Desktop/stack-intelligence-portal/app/api/world-model/nodes/[nodeId]/route.ts)
  - [app/api/world-model/company/[ticker]/route.ts](/Users/isaacentebi/Desktop/stack-intelligence-portal/app/api/world-model/company/[ticker]/route.ts)

### What is structurally wrong

1. It is not in the operator product shell.
   The page still lives under `research-dashboard/**` and is not part of the canonical `/operator/**` surface.

2. It is a monolithic browse view, not an operator workflow.
   One component owns summary loading, node loading, company loading, selection state, and presentation. There is no separation between navigation, inspection, and operational overlays.

3. The primary interaction is taxonomy browsing, not fast targeting.
   The left rail is a long layer/node list. There is no first-class search, no direct jump to node ID, and no way to prioritize “problem nodes” or “nodes with pending work.”

4. Node inspection is underpowered for operator use.
   The node panel shows description and company list, but not a deliberate operator summary of:
   - pending review context
   - bottleneck state
   - routing state
   - adjacency as a navigable dependency tool
   - latest accepted judgment provenance

5. Company inspection is detached from the operator question.
   The company panel only shows appearances across nodes. It does not help answer why the company matters in the currently selected node or how its accepted state relates to pending changes.

6. Dependency following is present in data but absent in the UX.
   Node payloads already include adjacency, but the UI does not treat dependencies as a first-class task.

7. The visual grammar is still slide-adjacent.
   The current page reads like a static “world model viewer” with soft cards and generic panels. It is not structured around operator decisions or investigation flow.

8. The route boundary is wrong for auth and product shape.
   World-model reads are not yet part of the protected operator proxy boundary, and the route still inherits research-dashboard framing.

## Operator Jobs

The redesigned world-model surface should support these jobs directly:

1. Find a node fast.
   Search by node ID, node name, company ticker, or company name.

2. Inspect node state.
   See the accepted node definition, scope, signals, moat/bottleneck profile, and last accepted state in one place.

3. Inspect companies in a node.
   See the most important companies in the selected node with role, relevance, revenue exposure, and accepted provenance.

4. Inspect bottleneck and routing state.
   See whether the node is currently bottlenecked, whether routing actions exist, and whether either state is open or binding.

5. Follow dependencies.
   Move quickly to upstream/downstream adjacent nodes from the node detail view.

6. See pending changes and review context.
   Surface pending review counts and recent review/routing/bottleneck context near the selected node, not as a separate mental model.

## Current Data Grounding

Available now from engine-backed portal adapters:

- `GET /v1/world-model/summary`
- `GET /v1/world-model/nodes/{node_id}`
- `GET /v1/world-model/companies/{ticker}`
- `GET /v1/operator/bottlenecks/active`
- `GET /v1/operator/routing/ledger`
- `GET /v1/operator/reviews/queue`

Important note:

- node payloads already contain adjacency, which is enough for a first dependency-following slice
- there is not yet a dedicated portal/engine dependency-graph endpoint in the current landed slice
- a dedicated `GET /v1/world-model/dependency-graph` would be a small later addition if a broader graph navigator is needed

## Proposed Information Architecture

Canonical route:

- `/operator/world`

Temporary compatibility:

- keep `/research-dashboard/world` working temporarily
- move it to a redirect or alias after the new operator route exists

Primary layout:

- left rail: search and node index
- center pane: selected node detail
- right rail: operational overlays and related context

### Left Rail

Purpose:

- find and select nodes quickly

Contents:

- search input
- layer filters
- quick filters:
  - all nodes
  - nodes with pending review
  - nodes with bottlenecks
  - nodes with open routing
- compact node result list

### Center Pane

Purpose:

- make the selected node the main object of work

Contents:

- node header: node ID, node name, layer
- operator summary strip:
  - company count
  - pending review count
  - bottleneck status
  - routing status
- tabs or stacked sections:
  - overview
  - companies
  - dependencies

Overview section:

- description
- scope includes/excludes
- signals
- moat profile
- bottleneck profile

Companies section:

- ranked company list for the node
- select a company inline to inspect its node appearances and accepted role data

Dependencies section:

- upstream adjacent nodes
- downstream adjacent nodes
- each adjacent node is clickable

### Right Rail

Purpose:

- surface operational state without leaving the selected node

Contents:

- pending review context for the selected node
- current bottleneck item if present
- latest routing entries for the selected node
- selected company detail when a company is chosen

## Proposed Route And Component Structure

Routes:

- `/operator/world`
- `/research-dashboard/world` -> temporary alias or redirect to `/operator/world`

Portal API adapters for the world surface:

- keep existing:
  - `/api/world-model/summary`
  - `/api/world-model/nodes/[nodeId]`
  - `/api/world-model/company/[ticker]`
- likely add thin protected operator proxies for:
  - `/api/operator/bottlenecks/active`
  - `/api/operator/routing/ledger`
  - `/api/operator/reviews/queue`

Recommended component split:

- `components/operator/world/OperatorWorldModelPage.tsx`
- `components/operator/world/WorldModelSearchRail.tsx`
- `components/operator/world/NodeWorkspace.tsx`
- `components/operator/world/NodeOverviewPanel.tsx`
- `components/operator/world/NodeCompaniesPanel.tsx`
- `components/operator/world/NodeDependenciesPanel.tsx`
- `components/operator/world/NodeOperationsRail.tsx`
- `components/operator/world/CompanyDetailCard.tsx`

State model:

- route-level selected node in search params
- optional selected company in search params
- summary loaded once
- node detail loaded by selected node
- overlays joined client-side in the first slice from existing operator endpoints

## First Narrow Implementation Slice

Do first:

1. introduce `/operator/world` inside the operator shell
2. replace the monolithic `WorldModel` operator page with a three-pane operator layout
3. add search and direct node selection
4. add node dependency navigation from current node adjacency data
5. join bottleneck/routing/review overlays for the selected node only

Do not do yet:

- full graph visualization
- presentation-grade animation or slide styling
- backend redesign
- deck/world-model presentation cutover
- broad company analytics beyond the selected node workflow

## Recommended Tiny API Addition Only If Needed

Not required for the first slice:

- `GET /v1/world-model/dependency-graph`

Use it only if the first operator slice proves that node-local adjacency is insufficient for navigation.

## Success Criteria

- world-model lives in the operator shell
- a node can be found quickly
- a selected node shows accepted state plus operator overlays
- dependencies are navigable
- pending review, bottleneck, and routing context are visible without leaving the node
- the implementation stays narrow and grounded in current engine APIs
