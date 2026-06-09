# Architecture and Flow Diagrams

These diagrams describe the local-first prototype. They are versioned as Mermaid so
they stay in sync with the code and review history. AI is an assistant only; the
authorized human remains the decision-maker at every step.

## High-level architecture

```mermaid
flowchart LR
  subgraph Client["Frontend - React / Vite / TS"]
    UI["Live interview UI\nPL / EN language packs"]
    PANELS["Panels: session, materials,\naudit, evidence alignment"]
  end

  subgraph API["Backend - Python / FastAPI"]
    APP["Local API app\n(workspace + session endpoints)"]
  end

  subgraph Analysis["Analysis (deterministic)"]
    REVIEW["Interview review\n+ credibility indicators"]
    GROUND["Material grounding\n+ evidence map"]
    ALIGN["Evidence alignment\nindicator"]
  end

  subgraph AI["AI adapters"]
    MODEL["Model client\n(deterministic / fake / Ollama)"]
    SUGG["Grounded suggestion service\n(citations required)"]
  end

  subgraph Security["Security"]
    POLICY["Workspace access policy"]
    CHAIN["Append-only audit hash chain"]
    ENC["Encryption status / SQLCipher gate"]
  end

  subgraph Storage["Storage (local only)"]
    CASES["JSON case loader"]
    DB["SQLite session store"]
    MATREG["Material registry"]
  end

  UI --> APP
  PANELS --> APP
  APP --> Analysis
  APP --> AI
  APP --> Security
  APP --> Storage
  GROUND --> ALIGN
  CHAIN --> ALIGN
  SUGG --> MODEL
```

## Evidence Alignment data flow

Shows how human decisions, not the machine, drive the advisory indicator.

```mermaid
flowchart TD
  PROP["System proposes material-question links\n(deterministic, topic-based)"]
  HUMAN["Authorized human reviews each link"]
  EVENT["Decision recorded as append-only\naudit-chain event (accepted / rejected)"]
  READ["Read model: latest decision per link"]
  IND["Evidence Alignment Indicator\nscore + confidence + band + explanation"]
  PANEL["UI gradient bar + bullets\n(advisory, never a verdict)"]

  PROP --> HUMAN --> EVENT --> READ --> IND --> PANEL

  EVENT -. verifiable .-> CHAINOK["Audit hash chain stays valid"]
```

## Boundary reminder

```mermaid
flowchart LR
  AISIDE["AI / system\nsurfaces: gaps, low coherence,\ninconsistencies, links, indicators"]
  LINE{{"Advisory boundary"}}
  HUMANSIDE["Authorized human\ndecides: meaning, truth,\ncredibility, procedure"]

  AISIDE --> LINE --> HUMANSIDE
```
