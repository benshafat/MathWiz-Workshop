# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MathWiz-Workshop is a demo project for showing how LLM-assisted coding works. It builds an interactive web application for exploring number theory concepts through rich visualizations. The repo is currently in the planning phase — `plans/` contains specs but no application code exists yet.

## Planned Tech Stack

- **Backend**: Python with FastAPI
- **Frontend**: HTML / JavaScript / TypeScript
- **Package manager**: `uv` (not pip, poetry, or pdm)
- **Linting/formatting**: `ruff`
- **Testing**: `pytest`

## Commands (once the project is scaffolded)

```bash
uv sync                          # Install dependencies
uv run uvicorn main:app --reload # Start the FastAPI dev server
uv run pytest                    # Run all tests
uv run pytest tests/test_foo.py::test_bar -v  # Run a single test
uv run ruff check .              # Lint
uv run ruff format .             # Format
```

## Architecture

The app has two parts:

**Backend** — A FastAPI service that exposes endpoints for computing and returning data for each math visualization. Each visualization concept gets its own module/route. The backend is internal-use only, so simplicity and nice output matter more than scalability.

**Frontend** — A simple HTML/JS/TS page with a button-per-visualization menu. Selecting a concept sends a request to the backend and renders the result using a suitable visualization library (TBD in `plans/infra_plans.md`).

## Math Visualizations

Seven concepts are fully specced in `plans/fun_math.md`:

1. **Prime Factorization Trees** — branching tree for a number and its ±1 neighbors
2. **Ulam Spiral** — integers on a clockwise grid, primes highlighted, diagonal patterns; click a prime to trace its diagonal
3. **Collatz Conjecture** — forward trajectories converging on the same nodes, or a reverse Collatz tree rendered as an organic plant/coral shape with angle sliders
4. **Totient Function Graph (Euler's φ)** — scatter plot of φ(n) for 1–10,000 with hover tooltips
5. **Continued Fraction Expansions** — convergents of π, √2, golden ratio on a number line or Stern-Brocot tree
6. **Recamán's Sequence** — arc diagram of the OEIS sequence
7. **Modular Arithmetic Webs** — circle diagrams of `k → (k×m) mod n` with sliders for `m` and `n`

## Planning Documents

| File | Contents |
|------|----------|
| `plans/fun_math.md` | Detailed specs for each of the 7 visualizations |
| `plans/helpful_prompts.md` | Prompts for driving the infrastructure and per-concept planning steps |
| `plans/infra_plans.md` | Infrastructure blueprint (currently a placeholder — fill this out before implementing) |

Per-concept implementation plan files should be created in `plans/` (one `.md` per visualization), referencing the packages chosen in `infra_plans.md` and noting any open questions that must be resolved before coding begins.
