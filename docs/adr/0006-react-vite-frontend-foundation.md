# ADR 0006: React and Vite Frontend Foundation

## Status

Accepted.

## Context

The static prototype validated the first live interview workflow and local API integration. The next UI step needs component structure, typed API contracts, maintainable state, and a path toward a desktop wrapper.

## Decision

Create `frontend/app` as a React + TypeScript + Vite application while keeping `frontend/prototype` as a workflow reference.

The first React application keeps the same product boundaries:

- local-first API integration,
- PL/EN UI switching,
- live session answer capture,
- deterministic review refresh,
- visible decision-support indicators,
- no automated truthfulness or guilt verdicts.

## Consequences

- Future UI work should target `frontend/app`.
- The static prototype remains useful for fast comparisons and manual workflow review.
- Node.js with `npm` is now required for the React app development workflow.
- The app is ready for later Tauri evaluation, but no desktop wrapper is introduced yet.
