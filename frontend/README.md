# Frontend

The frontend now has two tracks:

- `prototype/` - dependency-light static prototype kept as a workflow reference,
- `app/` - React + TypeScript + Vite application foundation for the product UI.

Run the static prototype:

```text
frontend/prototype/index.html
```

Run the React application:

```powershell
cd frontend\app
npm install
npm run dev
```

The app reads the local API from `VITE_API_BASE_URL` or the `api` query parameter. Default: `http://127.0.0.1:8000`.

Expected future path:

1. Static prototype.
2. Workflow review.
3. React + TypeScript + Vite implementation.
4. Hardening the local API integration.
5. Tauri desktop wrapper.
