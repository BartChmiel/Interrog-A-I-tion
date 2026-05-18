# Static UI Prototype

Open `index.html` directly in a browser.

This prototype is intentionally dependency-light. It validates the live interview workflow before the React/Vite implementation.

When the local API is running at `http://127.0.0.1:8000`, the prototype starts a synthetic session, records new answers through the API, and refreshes the deterministic live review after each answer. If the API is unavailable, it falls back to static demo data.

Current screens:

- live interview workspace,
- question queue,
- answer transcript,
- assistant suggestions,
- decision-support indicators,
- findings and audit preview,
- Polish/English UI toggle.
