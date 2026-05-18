# Static UI Prototype

Open `index.html` directly in a browser, or serve this directory locally when testing API integration.

This prototype is intentionally dependency-light. It validates the live interview workflow before the React/Vite implementation.

When the local API is running at `http://127.0.0.1:8000`, the prototype starts a synthetic session, records new answers through the API, and refreshes the deterministic live review after each answer. If the API is unavailable, it falls back to static demo data and shows a reconnect action.

Local preview:

```powershell
python -m http.server 5500 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:5500/index.html?api=http://127.0.0.1:8000&case=case-001
```

Optional query parameters:

- `api`: local API base URL,
- `case`: synthetic case id,
- `session`: session id to create or resume,
- `participant`: participant id.

Current screens:

- live interview workspace,
- question queue,
- answer transcript,
- assistant suggestions,
- decision-support indicators,
- findings and audit preview,
- Polish/English UI toggle.
