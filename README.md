# MathWiz-Workshop
<p align="center">
  <img src="https://github.com/user-attachments/assets/2eff0e7f-49db-45d8-9f7a-f52789303722" width="300" />
</p>

MathWiz is a demo project for showing how coding with LLM Agents is done. It's a local web application that lets you explore seven number theory concepts through interactive visualizations.

## Prerequisites

- **Python 3.11+**
- **[uv](https://docs.astral.sh/uv/)** — Python package manager (`pip install uv` or see uv docs)
- A modern browser (Chrome, Firefox, Edge)

## Install

```bash
cd backend
uv sync
```

That's it — no frontend build step.

## Launch

You need two terminals running simultaneously.

**Terminal 1 — API server:**
```bash
cd backend
uv run uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
python -m http.server 5173
```

Then open **http://localhost:5173** in your browser.

## Visualizations

| # | Name | What it shows |
|---|------|---------------|
| 1 | **Prime Trees** | Recursive factorization tree for a number and its ±1 neighbors — consecutive integers share no prime factors, so their trees look completely different |
| 2 | **Ulam Spiral** | Integers on a clockwise grid with primes highlighted — mysterious diagonal patterns emerge. Click a prime to trace its diagonal |
| 3 | **Collatz Conjecture** | Forward trajectories converging on shared nodes, or a reverse Collatz tree rendered as an organic plant shape with angle sliders |
| 4 | **Totient φ(n)** | Scatter plot of Euler's totient function for 1–10,000 — spikes at primes, floors at highly composite numbers |
| 5 | **Continued Fractions** | Convergents of π, e, √2, φ and 6 other constants on a number line or Stern-Brocot tree path |
| 6 | **Recamán's Sequence** | Arc diagram of the OEIS sequence A005132 — a sequence with huge jumps that loops back on itself |
| 7 | **Modular Webs** | Circle diagrams of `k → (k×m) mod n` — watch polygons morph into cardioids and nephroid curves as you move the slider |

## Project layout

```
backend/          Python / FastAPI API
  main.py         App entry point, CORS, startup cache pre-warm
  cache.py        In-memory SQLite3 key-value cache (stdlib)
  routers/        One file per visualization
  pyproject.toml

frontend/         Plain HTML + JavaScript (no build step)
  index.html      Nav bar + visualization container
  api.js          Fetch wrappers for all API endpoints
  views/          One JS file per visualization

plans/            Implementation specs and design decisions
```
