# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MathWiz-Workshop is a demo project for showing how LLM-assisted coding works. It builds an interactive web application for exploring number theory concepts through rich visualizations. The application is fully implemented — `plans/` contains the per-visualization specs and open questions; `backend/` and `frontend/` contain the running code.

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, SymPy, NumPy. Package manager: `uv`.
- **Frontend**: Plain HTML + JavaScript. D3.js v7 via CDN. No TypeScript, no build step.
- **Cache**: `backend/cache.py` — in-memory SQLite3 key-value store (stdlib, no extra dependency).

## Commands

All backend commands run from `backend/`:

```bash
cd backend
uv sync                                      # Install / sync dependencies
uv run uvicorn main:app --reload --port 8001 # Start dev server
uv run pytest                                # Run tests (once written)
uv run pytest tests/test_foo.py::test_bar -v # Run a single test
uv run ruff check .                          # Lint
uv run ruff format .                         # Format
```

Frontend has no build step — serve with Python's built-in server:

```bash
cd frontend
python -m http.server 5173
```

Then open `http://localhost:5173`.

## Architecture

### Backend

`backend/main.py` — FastAPI app. Registers all 7 routers, enables fully open CORS (`allow_origins=["*"]` — intentional, local-only workshop), and runs a startup pre-warm that populates the cache for Ulam spiral tiers and all continued fraction presets.

`backend/cache.py` — module-level in-memory SQLite3 singleton. All routers import it with `import cache` and follow this pattern:

```python
def get_endpoint(params):
    key = f"prefix:{params}"
    data = cache.get(key)
    if data is not None:
        return data
    data = _compute(params)
    cache.set(key, data)
    return data
```

Cache keys: `prime_tree:{n}`, `ulam:{size}`, `collatz:{n}:{k}:{mode}:{depth}`, `totient:{limit}`, `cf:{number}:{depth}`, `recaman:{terms}`, `modular:{n}:{m}`.

`backend/routers/` — one file per visualization. Each exports a `router = APIRouter(prefix="/api")`. Two routers also export top-level compute functions for the startup pre-warm:
- `ulam_spiral.compute_spiral(size)` 
- `cont_fraction.compute_cf(number_key, depth)` and `cont_fraction.PRESETS`

### Frontend

`frontend/index.html` — shell page with nav bar (7 buttons) and `#viz-container`. Loads D3, `api.js`, all 7 view scripts, then an inline main script that wires buttons to views.

`frontend/api.js` — sets `window.API` with typed async fetch wrappers for all 7 endpoints. Base URL: `http://localhost:8001`.

`frontend/views/*.js` — each file sets `window.Views.{name} = { mount(container), render(data, container) }`. The `mount()` function is async: it builds the controls UI, fetches initial data, and calls `render()`. The `render()` function just draws. `main.js` calls `Views[name].mount(container)` when a nav button is clicked.

### Key implementation decisions

- **No TypeScript, no build step.** If a view is getting too complex for plain JS, simplify the spec rather than adding build tooling.
- **Global namespace.** Views attach to `window.Views`, the API to `window.API`. No ES modules (avoids `type="module"` complications in the workshop).
- **Collatz angles are frontend-only.** The backend returns `"even"`/`"odd"` step labels; `even_angle`/`odd_angle` are applied in the browser so the plant-layout slider redraws without a round-trip.
- **Modular web slider.** The `m` slider calls `computeLines(n, m)` in JS and re-renders without an API call. The API is only hit when `n` changes.
- **Ulam spiral.** Canvas-based (not SVG) for performance. Uses progressive tier loading: size 10 → 50 → 150 → 249. All 4 tiers are pre-warmed on startup.
- **Continued fractions.** `p` and `q` are returned as strings to avoid JS safe-integer overflow for deep convergents.
- **Input validation** is crash-prevention only — reject obviously bad values with HTTP 422; do not add defensive hardening.

## Planning Documents

| File | Contents |
|------|----------|
| `plans/fun_math.md` | Original specs for all 7 visualizations |
| `plans/infra_plans.md` | Infrastructure decisions and Q&A |
| `plans/prime_tree.md` … `plans/modular_web.md` | Per-visualization implementation plans with open questions |
