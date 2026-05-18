# InterigA(I)tion Frontend App

React + TypeScript + Vite application shell for the local investigative interviewing assistant.

## Requirements

Install Node.js with `npm`, then run:

```powershell
npm install
npm run dev
```

The development server defaults to:

```text
http://127.0.0.1:5173
```

## Local API

Start the backend from `backend/`:

```powershell
python -m interigaition.api.app
```

The app uses `http://127.0.0.1:8000` by default. You can override it with:

```text
http://127.0.0.1:5173/?api=http://127.0.0.1:8000&case=case-001&session=demo-session&participant=person-001
```

Supported runtime query parameters:

- `api`: local API base URL,
- `case`: synthetic case id,
- `session`: session id to create or resume,
- `participant`: participant id.

## Scripts

- `npm run dev` - local Vite server,
- `npm run build` - TypeScript check and production build,
- `npm run preview` - preview production build,
- `npm run typecheck` - TypeScript check only.
