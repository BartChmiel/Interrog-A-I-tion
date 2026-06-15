# ADR 0005: Static UI prototype before React implementation

## Status

Accepted.

## Context

The project needs a serious operational UI, but the backend and environment are still changing. Node is currently blocked in the local sandbox, and FastAPI dependency loading also needs cleanup. Building a React/Vite application immediately would introduce tooling friction before validating the actual workflow.

## Decision

Create the first UI as a static HTML/CSS/JavaScript prototype.

The prototype should:

- open directly from `frontend/prototype/index.html`,
- use embedded synthetic data,
- show the live interview layout,
- support Polish and English labels,
- visualize numeric indicators with gradient bars,
- avoid network dependencies,
- avoid build tooling.

## Consequences

Positive:

- fastest possible UI feedback loop,
- no dependency installation required,
- easier product review,
- fewer moving parts before the workflow is validated.

Negative:

- duplicated data compared with backend output,
- no real API integration yet,
- later migration to React/Vite is still required.

## Follow-up

After the static prototype is accepted, migrate the UI to React + TypeScript + Vite and connect it to the local API.

