# OTR Platform Constitution
<!-- Spec-Driven Development (SDD) & Engineering Principles for On The Rocks (OTR) -->

## Core Principles

### I. Spec-Driven First (NON-NEGOTIABLE)
No feature, overhaul, or architectural change is implemented through raw "vibe coding". Every non-trivial change must follow the SDD lifecycle:
1. **Specification (`spec.md`)**: Business problem, prioritized user journeys (P1, P2...), acceptance scenarios, edge cases, and success criteria.
2. **Plan (`plan.md`)**: Technical blueprint, database schema (Prisma), Fastify routes, React UI components, security, and backward compatibility.
3. **Tasks (`tasks.md`)**: Granular, test-checkable execution items for autonomous and safe agent execution.
4. **Implement & Verify**: Implementation backed by automated tests, verification against the spec, and recording in Notion / Bitácora.

### II. Test-First & Quality Gates (NON-NEGOTIABLE)
Every bugfix and new domain logic MUST have automated test coverage using Vitest and React Testing Library:
- **Red-Green cycle**: Reproduce bug with a test → Fix → Verify test passes 100%.
- **Zero regressions**: Run `pnpm test` prior to deploying or marking tasks as done.
- **Explicit communication**: Whenever code is delivered, notify what tests were created or updated and what invariants they protect.

### III. Backend Performance & Async Invariants
- **Non-blocking responses (Sub-100ms)**: Side effects, notifications (`prisma.notification.createMany`), background metrics sync, and AI extraction workflows must **NEVER** block synchronous HTTP responses. Use `setImmediate(async () => { ... })` or dedicated workers.
- **Defensive persistence**: Payload sanitization, version handling, and conflict avoidance when updating multi-channel content (`contentPerCanal`).

### IV. Pragmatic Simplicity (YAGNI & "De Menos a Más")
- Start with the minimal solid foundation (e.g. clean relational models, hybrid queries) before introducing speculative abstractions (no premature microservices, rigid DB taxonomies, or heavy standalone vector DBs when PostgreSQL suffices).
- Maintain documentation integrity: Preserve existing comments and docstrings.

### V. Single Source of Truth & Governance (Notion & Bitácora)
1. **Notion Backlog (`Backlog OTR`)**: The absolute source of truth for task tracking and status.
   - Every task must be mapped to Notion before or during execution.
   - Upon completion, transition to `Done`, assign `Fecha de terminado`, and position at the top of the `Done` column.
2. **Bitácora (`docs/BITACORA.md`)**: Formal historical log and changelog of completed epics, architectural decisions, and release test results.
3. **Project Memory (`/memory/`)**: Architectural knowledge base referenced at session start and updated upon completing new capabilities.

## Technology Stack Standards
- **Monorepo**: pnpm workspaces (`apps/web`, `apps/api`, `apps/mcp`, `packages/types`, `packages/schemas`).
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + `@tanstack/react-query`.
- **Backend**: Node.js + Fastify + Prisma ORM + PostgreSQL (Railway/Supabase).
- **MCP Server**: `@modelcontextprotocol/sdk` in `apps/mcp` communicating with `apps/api` via internal REST/Bearer auth.
- **AI Models**: Claude 3.5 Sonnet / GPT-4o with streaming and structured XML tag delimiters (`<content>`, `<summary>`, `<response>`).

## Governance
This Constitution establishes the engineering baseline for OTR. Any deviation must be explicitly justified, agreed upon with the engineering lead, and documented.

**Version**: 1.0.0 | **Ratified**: 2026-10-29 | **Last Amended**: 2026-10-29
