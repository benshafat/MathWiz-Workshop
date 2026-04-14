# Implementation Plan: Totient Function Graph (Euler's φ)

---

## 1. Math Background

### Definition

Euler's totient function φ(n) counts the positive integers up to n that are **coprime** to n — i.e., share no common factor with n other than 1.

Formally:

```
φ(n) = |{ k : 1 ≤ k ≤ n, gcd(k, n) = 1 }|
```

Examples:
- φ(1) = 1  (by convention; 1 is coprime to itself)
- φ(6) = 2  (only 1 and 5 are coprime to 6)
- φ(7) = 6  (7 is prime; all of 1–6 are coprime to it)
- φ(12) = 4 (1, 5, 7, 11)

### Why primes spike

For any prime p, every integer from 1 to p−1 is coprime to p. Therefore:

```
φ(p) = p − 1
```

On the scatter plot this produces a prominent upper "spine" that sits just below the diagonal y = n − 1. Prime clusters (twin primes, prime constellations) bunch together near this spine and are visually unmistakable.

### Why highly composite numbers have low φ

φ is multiplicative and satisfies:

```
φ(n) = n · ∏(p | n) (1 − 1/p)
```

A highly composite number (HCN) — one with more divisors than any smaller integer — tends to have many distinct small prime factors (2, 3, 5, 7, ...), each of which multiplies φ(n) by a fraction (1 − 1/p) < 1. The more small primes divide n, the further φ(n) is pulled below n, creating "floors" on the scatter.

For instance:
- φ(2) = 1 → ratio 0.5
- φ(12) = 4 → ratio ≈ 0.33  (factors 2, 3)
- φ(60) = 16 → ratio ≈ 0.27  (factors 2, 3, 5)
- φ(30030) = 5760 → ratio ≈ 0.19  (primorial 2·3·5·7·11·13)

### The ratio φ(n)/n

The ratio φ(n)/n is bounded:
- **Upper bound**: approaches 1 for primes (φ(p)/p = (p−1)/p → 1)
- **Lower bound**: the primorials 2, 6, 30, 210, 2310, ... give the global minimum ratio for each order of magnitude

The average value of φ(n)/n over 1..N converges to 6/π² ≈ 0.6079 — the same constant that governs the density of squarefree integers and the probability that two random integers are coprime. This is a deep connection to the Riemann zeta function: the average ratio equals 1/ζ(2).

### Beautiful identities worth knowing

| Identity | Notes |
|---|---|
| φ(1) = 1 | Base case |
| φ(p) = p − 1 | p prime |
| φ(p^k) = p^k − p^(k−1) | Prime power |
| φ(mn) = φ(m)φ(n) · d/φ(d), where d = gcd(m,n) | General multiplicativity |
| φ(mn) = φ(m)φ(n) when gcd(m,n) = 1 | Coprime inputs |
| Σ_{d\|n} φ(d) = n | Sum over divisors equals n |
| Σ_{k=1}^{N} φ(k) ≈ 3N²/π² | Asymptotic sum |
| avg(φ(n)/n) → 6/π² = 1/ζ(2) ≈ 0.6079 | Average ratio |

---

## 2. Backend Implementation

**File**: `backend/routers/totient.py`
**Endpoint**: `GET /api/totient`
**Param**: `limit` (integer, default 10,000)

### Computation strategy: sieve approach (recommended)

Computing φ per-number via `sympy.totient(n)` in a loop is correct but slower — each call does a full factorisation. For a range 1..N the right approach is a **sieve**, analogous to the Sieve of Eratosthenes.

The sieve works as follows:
1. Initialise `phi[i] = i` for all i.
2. For each prime p discovered, multiply `phi[multiples of p]` by `(1 − 1/p)`.

SymPy does not ship a range-totient sieve, but NumPy makes it trivial to implement:

```python
import numpy as np

def totient_sieve(n: int) -> np.ndarray:
    phi = np.arange(n + 1, dtype=np.int64)
    for p in range(2, n + 1):
        if phi[p] == p:          # p is prime (hasn't been touched yet)
            phi[p::p] -= phi[p::p] // p
    return phi
```

This runs in O(N log log N) time and O(N) space — essentially the same complexity class as a prime sieve.

### Performance note for limit = 10,000

- The sieve over 10,000 integers runs in well under 10 ms in Python with NumPy.
- Memory footprint: ~80 KB for a 10,000-element int64 array.
- No caching is needed at this scale; compute fresh on every request.
- For a `limit` of 100,000 the sieve still completes in under 100 ms. Cap `limit` at 100,000 to prevent obviously unreasonable requests.

### Input validation

- Reject non-integer `limit` (FastAPI handles this automatically with type annotation).
- Return HTTP 422 if `limit < 1` or `limit > 100_000`.

### Endpoint implementation sketch

```python
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import numpy as np

router = APIRouter()

class TotientPoint(BaseModel):
    n: int
    phi: int

@router.get("/api/totient", response_model=list[TotientPoint])
def get_totient(limit: int = Query(default=10_000, ge=1, le=100_000)):
    phi = totient_sieve(limit)
    return [{"n": i, "phi": int(phi[i])} for i in range(1, limit + 1)]
```

### JSON response shape

```json
[
  { "n": 1, "phi": 1 },
  { "n": 2, "phi": 1 },
  { "n": 3, "phi": 2 },
  { "n": 4, "phi": 2 },
  { "n": 5, "phi": 4 },
  { "n": 6, "phi": 2 },
  ...
  { "n": 10000, "phi": 4000 }
]
```

Total response size at limit=10,000: ~250 KB of JSON (each object ~25 bytes). This is well within comfortable browser limits.

---

## 3. Frontend Implementation

**File**: `frontend/views/totient.js`
**Export**: `render(data, container)`

### Data preprocessing (in the render function)

Before drawing, augment each data point:

```javascript
const points = data.map(d => ({
  ...d,
  ratio: d.phi / d.n,
  isPrime: d.phi === d.n - 1 && d.n > 1,
  // "highly composite" approximation: ratio below a threshold
  isLowRatio: d.ratio < 0.35
}));
```

Note on prime detection: `phi === n - 1` is true if and only if n is prime (for n > 1). This is a free primality test with no extra computation.

### SVG scaffold

```javascript
const margin = { top: 20, right: 20, bottom: 50, left: 60 };
const width  = container.clientWidth  - margin.left - margin.right;
const height = container.clientHeight - margin.top  - margin.bottom;

const svg = d3.select(container).append("svg")
    .attr("width",  width  + margin.left + margin.right)
    .attr("height", height + margin.top  + margin.bottom)
  .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
```

### Scales and axes

```javascript
const xScale = d3.scaleLinear().domain([1, limit]).range([0, width]);
const yScale = d3.scaleLinear().domain([0, limit]).range([height, 0]);

svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(xScale));
svg.append("g").call(d3.axisLeft(yScale));
```

### Rendering the dots

With 10,000 points, SVG circles render comfortably in all major browsers (no canvas fallback needed at this scale). Use a radius of 1.5–2 px.

```javascript
svg.selectAll("circle")
    .data(points)
  .join("circle")
    .attr("cx", d => xScale(d.n))
    .attr("cy", d => yScale(d.phi))
    .attr("r", 1.5)
    .attr("fill", d => d.isPrime ? "#f97316"   // orange — prime spike
                      : d.isLowRatio ? "#818cf8" // indigo — HCN floor
                      : "#94a3b8")               // slate — default
    .attr("opacity", 0.7);
```

Colour scheme summary:
- **Orange** (`#f97316`) — primes (φ = n−1). The upper spine.
- **Indigo** (`#818cf8`) — ratios below 0.35 (approximate highly composite numbers and their multiples). The low floors.
- **Slate** (`#94a3b8`) — everything else.

### Hover tooltip

Use a `<div>` absolutely positioned tooltip, not an SVG tooltip, for easier styling.

```javascript
const tooltip = d3.select(container).append("div")
    .style("position", "absolute")
    .style("background", "#1e293b")
    .style("color", "#f8fafc")
    .style("padding", "8px 12px")
    .style("border-radius", "6px")
    .style("font-size", "13px")
    .style("pointer-events", "none")
    .style("display", "none");

svg.selectAll("circle")
    .on("mouseover", (event, d) => {
        tooltip
          .style("display", "block")
          .html(`n = ${d.n}<br>φ(n) = ${d.phi}<br>φ(n)/n = ${d.ratio.toFixed(4)}
                 ${d.isPrime ? "<br><em>prime</em>" : ""}`);
    })
    .on("mousemove", (event) => {
        tooltip
          .style("left", (event.pageX + 12) + "px")
          .style("top",  (event.pageY - 28) + "px");
    })
    .on("mouseout", () => tooltip.style("display", "none"));
```

### Interactive controls

Add these controls as `<div>` elements above the SVG, driven by event listeners (no framework needed):

| Control | Type | Action |
|---|---|---|
| Limit slider | range 100–10,000, step 100 | Re-fetches `/api/totient?limit=N` and re-renders |
| Range inputs (n_min, n_max) | number inputs | Filters the already-fetched dataset and re-draws (no new fetch) |
| Colour toggle | checkbox set | Show/hide prime highlights, HCN highlights independently |
| Ratio mode toggle | button | Switches y-axis between φ(n) and φ(n)/n (see section 4) |

**Complexity note for plain HTML + D3**: These controls are all straightforward with vanilla JS event listeners and D3 `selection.join()`. No build-tool complexity arises here.

### Zoom into a range (without D3 zoom)

Rather than wiring D3's zoom behaviour (which can get complex without TypeScript tooling), use a simpler approach:

1. Fetch the full dataset (limit=10,000) once on load.
2. Provide `n_start` and `n_end` number inputs.
3. On input change, `xScale.domain([n_start, n_end])` and re-run the axis and circle update without re-fetching.

This is significantly simpler and sufficient for exploration.

---

## 4. Additional Visualization Ideas

### A. Ratio mode: plot φ(n)/n instead of raw φ(n)

Toggle the y-axis to show `ratio = phi/n`. The y-axis now runs 0–1 and the "prime spine" becomes a horizontal band near 1, while the HCN floors create horizontal bands near 0. The average line (6/π² ≈ 0.608) can be drawn as a dashed reference line with a label. This mode makes the multiplicative structure much clearer.

Implementation: swap `yScale.domain([0, 1])`, change `cy` to use `d.ratio`, add the reference line with `svg.append("line")`.

### B. Highlighting Carmichael numbers

Carmichael numbers (e.g., 561, 1105, 1729) are composite numbers where φ(n) divides n−1 — they are pseudoprimes. They appear on the scatter very close to the prime spine, making them easy to spot visually but easy to miss mathematically.

Implementation: include a precomputed small list of Carmichael numbers up to 10,000 in the frontend (there are only 19 of them up to 10,000). Mark them with a distinct symbol — e.g., a diamond shape using a D3 symbol generator — and add a "Show Carmichael" checkbox. No backend changes needed.

The 19 Carmichael numbers ≤ 10,000:
561, 1105, 1729, 2465, 2821, 6601, 8911 (and 12 more up to 10,000 — a full list can be hardcoded as a JS constant).

### C. Animate the scatter as n grows

On page load, render the dots sequentially using a D3 transition driven by `n`:

```javascript
svg.selectAll("circle")
    .data(points)
  .join("circle")
    .attr("cx", d => xScale(d.n))
    .attr("cy", d => yScale(d.phi))
    .attr("r", 0)
    .transition()
    .delay(d => d.n * 0.04)  // 0.04 ms per point → ~400 ms total for 10k points
    .duration(200)
    .attr("r", 1.5);
```

This makes the structure visually "build up" from left to right. The prime spine appears first, then the rest fills in. At 10,000 points with the delay scheme above the full animation runs in about 600 ms — quick enough to feel snappy. For larger limits (>5,000) consider reducing the delay multiplier.

**Complexity note for plain HTML + D3**: D3 transitions with `.delay()` are idiomatic D3 and work cleanly without a build step.

### D. Reference lines and annotations

- Draw the line `y = n − 1` (the prime boundary) as a thin dashed line.
- Draw the line `y = n · 6/π²` (the expected average) as a coloured dashed line.
- Annotate notable n values (e.g., n=2310, the 5-primorial) with a small vertical rule and label.

---

## 5. MCP Suggestions

- **browser-use or puppeteer MCP**: Useful for visually inspecting the rendered D3 scatter in a real browser during development, without manually opening a browser tab. If an MCP that controls a headless browser is available, it can verify that hover tooltips appear correctly and that colour coding is rendering as expected.
- **fetch/HTTP MCP**: Can be used to call `http://localhost:8000/api/totient?limit=100` directly from the Claude Code session to inspect the raw JSON response shape while writing the frontend, without switching to a terminal.

---

## 6. Additional Packages Needed

No additional Python packages beyond those already in `backend/pyproject.toml` are required:

| Package | Already listed? | Used for |
|---|---|---|
| `fastapi` | Yes | Router, Query params, HTTPException |
| `uvicorn` | Yes | ASGI server |
| `sympy` | Yes | Not needed here (NumPy sieve is faster) |
| `numpy` | Yes | Totient sieve implementation |
| `pydantic` | Yes (ships with FastAPI) | Response model validation |

No new JS CDN dependencies beyond D3 v7 are needed. The tooltip, controls, and animations are all achievable with vanilla D3.

---

## 7. Open Questions — Resolve Before Implementing

1. **Default `limit` on page load** — Should the view load with the full 10,000 points immediately, or start at a smaller limit (e.g., 1,000) and let the user increase it? Starting at 10k is visually richer immediately but takes a moment to fetch and render. Recommend: load at 10,000 (fast enough), but note the choice if initial load time becomes an issue.

2. **Ratio mode: separate view or same view with toggle?** — The spec asks for both raw φ(n) and the ratio φ(n)/n. These can be the same SVG with an axis swap, or two side-by-side panels. A single panel with a toggle button is simpler to implement in plain D3. Confirm the preferred layout before building.

3. **HCN detection threshold** — The frontend currently marks `ratio < 0.35` as "highly composite". This is an approximation; true highly composite numbers are a specific sequence. Should the frontend use the approximation (threshold-based, zero extra data), a hardcoded list of HCNs up to 10,000, or a backend-supplied flag in the response? A hardcoded list (there are ~100 HCNs up to 10,000) is more accurate and still simple. Decide before implementation to avoid rework on the colouring logic.

4. **Carmichael number highlight** — Section 4B proposes hardcoding the 19 Carmichael numbers ≤ 10,000 in the frontend JS. If the limit slider goes above 10,000 (the current backend cap is 100,000), this list would need to be extended or computed. Confirm whether Carmichael highlighting only needs to work within the default 10,000 range, or across the full slider range.

5. **Animation on re-render** — Should the grow-in animation (section 4C) play every time the limit slider changes (potentially distracting on repeated adjustments), or only on the initial page load? A simple flag (`hasAnimated`) can suppress it after the first render.
