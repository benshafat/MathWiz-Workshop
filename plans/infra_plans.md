# Infra Plans

## Overview

Two-part system: a Python/FastAPI backend that computes mathematical data and returns JSON, and an HTML/JS frontend that handles all rendering and interactivity. This split keeps the backend stateless and simple, while giving the frontend full control over animation, sliders, and canvas drawing.

---

## Backend

### Stack

| Concern | Choice | Reason |
|---|---|---|
| Framework | FastAPI | Async, auto-docs, simple routing |
| Server | Uvicorn | Standard ASGI server for FastAPI |
| Package mgmt | uv | Project preference |
| Math | SymPy | Primes, factorization, totient, continued fractions — batteries included |
| Numerics | NumPy | Array operations for sequence generation |
| Data models | Pydantic | Ships with FastAPI, validates response shapes |

### Directory Structure

```
backend/
├── main.py               # FastAPI app, CORS config, router registration
├── routers/
│   ├── prime_tree.py     # /api/prime-tree
│   ├── ulam_spiral.py    # /api/ulam-spiral
│   ├── collatz.py        # /api/collatz
│   ├── totient.py        # /api/totient
│   ├── cont_fraction.py  # /api/continued-fraction
│   ├── recaman.py        # /api/recaman
│   └── modular_web.py    # /api/modular-web
└── pyproject.toml
```

### API Endpoints

Each endpoint returns pure JSON data — no server-side image rendering. The frontend owns all visualization.

| Route | Key params | Returns |
|---|---|---|
| `GET /api/prime-tree/{n}` | `n`: integer | Recursive factorization tree for n, n-1, n+1 as nested JSON nodes |
| `GET /api/ulam-spiral` | `size`: grid half-width; backend caps total points at 250 000 (≈ 500×500) | List of `{x, y, value, is_prime}` objects |
| `GET /api/collatz/{n}` | `n`: starting integer; `k`: number of starting values for multi-path mode | Per-path sequences + convergence nodes; each step labelled `"even"` or `"odd"` — `even_angle`/`odd_angle` are frontend-only so sliders redraw instantly without a round-trip |
| `GET /api/totient` | `limit`: upper bound (default 10 000) | List of `{n, phi}` pairs |
| `GET /api/continued-fraction` | `number`: key from a preset list of ~10 interesting constants (π, e, √2, φ, etc.); `depth`: number of terms | Coefficients + convergents as `{p, q, decimal_approx}` |
| `GET /api/recaman` | `terms`: how many terms to generate | Ordered list of values |
| `GET /api/modular-web` | `n`: points on circle; `m`: multiplier | List of `{from, to}` pairs |

### CORS & Security

All code runs locally for the workshop, so no authentication, authorization, or HTTPS is needed. Enable `CORSMiddleware` in `main.py` with `allow_origins=["*"]` and leave it that way — this is intentional, not a TODO. Input validation only needs to be enough to prevent crashes (e.g. reject non-integers where an integer is required); do not add defensive validation beyond that.

### Running

```bash
cd backend
uv sync
uv run uvicorn main:app --reload --port 8000
```

API docs auto-available at `http://localhost:8000/docs`.

---

## Frontend

### Stack

| Concern | Choice | Reason |
|---|---|---|
| Language | Plain JavaScript | No build step; LLM handles type safety |
| Build tool | None | Load D3 and scripts via `<script>` tags in `index.html` |
| Visualization | D3.js (CDN) | Handles everything: SVG trees, arc diagrams, scatter plots, canvas wrappers |
| HTTP | Native `fetch` | No extra dependency needed |
| Dev server | `python -m http.server` | Already available since Python is installed for the backend |

D3.js is the single visualization dependency — it covers SVG manipulation, scales, force layouts, and arc paths, which is sufficient for all 7 visualizations. No need for a separate charting library.

### Directory Structure

```
frontend/
├── index.html            # Shell: nav bar, visualization container, all <script> tags
├── api.js                # fetch wrappers for each backend route
└── views/
    ├── primeTree.js
    ├── ulamSpiral.js
    ├── collatz.js
    ├── totient.js
    ├── contFraction.js
    ├── recaman.js
    └── modularWeb.js
```

### UI Structure

`index.html` has two regions:
1. **Nav bar** — one button per visualization (7 total). Clicking a button calls the backend, then hands data to the matching view module.
2. **Visualization pane** — a single `<div id="viz">` that each view module clears and re-renders into. Views may use `<svg>` or `<canvas>` as appropriate.

Each view exports a single `render(data, container)` function. `main.js` is the only file that knows about the DOM structure; views are pure render functions.

The Ulam spiral view starts the user at a 10×10 visible grid and fetches larger `size` values as they zoom, up to the backend cap of 250 000 points.

### Running

```bash
cd frontend
python -m http.server 5173   # serve on http://localhost:5173
```

---

## Packages Summary

**Python (`backend/pyproject.toml`)**
```
fastapi
uvicorn[standard]
sympy
numpy
```

**JS (CDN, no package.json needed)**
```
d3 — loaded via <script src="https://cdn.jsdelivr.net/npm/d3@7/...">
```

---

## Questions & Answers

1. **Ulam spiral size limit** — a 101×101 grid is ~10 000 points; a 501×501 is ~250 000. Should the backend cap this, or should the frontend request progressively larger grids as the user zooms?

   Answer: BE should have a cap (ULAM_CAP=250 000), have the FE start at a zoom of 10x10, and as the user zoom display more. you can decide if to compute all at once or responsive to zoom.

2. **Collatz multi-path layout algorithm** — the "organic plant" layout requires assigning angles per step direction. Should the angle parameters (even-step turn, odd-step turn) be hardcoded defaults or exposed as query params so the frontend slider can drive them?

    Answer: expose them so the slider can drive them.

3. **Continued fraction number input** — should users be able to type an arbitrary decimal (e.g. `2.718...`) or only pick from a preset list (π, √2, φ)? Arbitrary input requires careful parsing on the backend.

    Answer: for now, have a preset list of ~10 fun numbers 

4. **Frontend build vs. no-build** — Vite + TS is recommended above, but if the priority is absolute simplicity for the workshop, plain HTML + D3 via CDN (no build step) is viable. Decide before scaffolding.

    Answer: plain HTML + D3 via CDN. This is a vibe-coding workshop so the LLM handles type safety. If HTML + D3 becomes unreasonable because of one of the specs, when then user asks for that math function to be implemented, point this out and suggest ways to reduce complexity in the request rather than requiring changing infra mid-workshop. you may add this point in the per-function files when they are created.