# Implementation Plan: Continued Fraction Expansions

## 1. Math Background

### What Is a Continued Fraction?

Every real number x can be expressed as a **simple continued fraction** (SCF):

```
x = a₀ + 1 / (a₁ + 1 / (a₂ + 1 / (a₃ + ...)))
```

Written compactly as `[a₀; a₁, a₂, a₃, ...]`. The integers `a₀, a₁, a₂, ...` are called the **partial quotients** (or CF coefficients). For a positive real number, all terms after `a₀` are positive integers. Rational numbers have finite CFs; irrational numbers have infinite ones.

**Computing the CF of x** follows Euclidean-algorithm style steps:
1. `a₀ = floor(x)`, then `x₁ = 1 / (x - a₀)`
2. `a₁ = floor(x₁)`, then `x₂ = 1 / (x₁ - a₁)`
3. Repeat indefinitely (or until desired depth).

### Convergents and the Recurrence Relation

Truncating the CF at depth `n` gives the **n-th convergent**: the best rational approximation `p_n / q_n` to x using a denominator of size at most `q_n`. Convergents are computed by the recurrence:

```
p_{-1} = 1,  p_0 = a_0
q_{-1} = 0,  q_0 = 1

p_n = a_n * p_{n-1} + p_{n-2}
q_n = a_n * q_{n-1} + q_{n-2}
```

Each successive convergent alternately overshoots and undershoots the true value, "ping-ponging" toward it: even-indexed convergents approach from below, odd-indexed from above (for x > 0).

### Why the Golden Ratio Is Special

The golden ratio φ = (1 + √5) / 2 = [1; 1, 1, 1, 1, ...] — every partial quotient is 1, the smallest possible positive integer. By a theorem in Diophantine approximation (related to Hurwitz's theorem), larger partial quotients allow better rational approximations. A CF full of 1s makes φ the **hardest real number to approximate by rationals** — its convergents (the Fibonacci ratios: 1/1, 2/1, 3/2, 5/3, 8/5, 13/8, ...) converge more slowly than those of any other irrational. This is directly connected to the ubiquity of Fibonacci numbers in nature.

### What Makes a CF Interesting to Visualize?

| Property | Why it's interesting |
|---|---|
| Large partial quotients | The convergent makes a dramatic jump, "snapping" the approximation much closer in one step |
| Periodic CF | Indicates the number is a quadratic irrational (e.g. √2 = [1; 2, 2, 2, ...]) |
| All-1s CF | The golden ratio; slowest possible convergence |
| Unpredictable, non-repeating | π and e — no known pattern in their CF coefficients |
| Fast convergence | Some constants (e.g. e = [2; 1, 2, 1, 1, 4, 1, 1, 6, ...]) have a structured pattern that produces rapid convergence |

---

## 2. Backend Implementation

### File: `backend/routers/cont_fraction.py`

**Endpoint:** `GET /api/continued-fraction`

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `number` | `str` | Key from the preset constants map (see below) |
| `depth` | `int` | Number of CF terms / convergents to return (1–50; default 10) |

**Validation:** Return HTTP 400 if `number` is not in the preset list, or if `depth` is outside [1, 50].

### Preset Constants

The following 10 constants form a compelling and mathematically diverse set:

| Key | Constant | SymPy Expression | CF interest |
|---|---|---|---|
| `pi` | π | `sympy.pi` | No known pattern; famous transcendental |
| `e` | Euler's number | `sympy.E` | Structured pattern: [2; 1,2,1,1,4,1,1,6,...] |
| `sqrt2` | √2 | `sympy.sqrt(2)` | Periodic: [1; 2,2,2,...] — simplest non-trivial periodic |
| `sqrt3` | √3 | `sympy.sqrt(3)` | Periodic: [1; 1,2,1,2,...] |
| `sqrt5` | √5 | `sympy.sqrt(5)` | Periodic: [2; 4,4,4,...] |
| `phi` | Golden ratio φ | `(1 + sympy.sqrt(5)) / 2` | All 1s — hardest to approximate |
| `ln2` | ln(2) | `sympy.log(2)` | No known pattern; converges slowly |
| `gamma` | Euler-Mascheroni γ | `sympy.EulerGamma` | Mysterious; unknown if rational |
| `apery` | Apéry's constant ζ(3) | `sympy.zeta(3)` | Proved irrational (1978); CF unknown pattern |
| `plastic` | Plastic constant | Real root of x³ - x - 1 | Tribonacci analogue to φ; [1; 3, 12, 1, 1, 3, 2, ...] |

> **Note on the Plastic constant:** SymPy can express it as `sympy.real_root(sympy.Rational(1,2) + sympy.sqrt(sympy.Rational(23,108)), 3) + sympy.real_root(sympy.Rational(1,2) - sympy.sqrt(sympy.Rational(23,108)), 3)`, or more cleanly via `sympy.CRootOf(x**3 - x - 1, 0)` with `x = sympy.Symbol('x')`.

### Computing CF Coefficients and Convergents with SymPy

```python
from sympy import continued_fraction_iterator, continued_fraction_convergents, N
from itertools import islice

def compute_cf(sympy_expr, depth: int):
    cf_iter = continued_fraction_iterator(sympy_expr)
    coefficients = list(islice(cf_iter, depth))

    convergents_iter = continued_fraction_convergents(coefficients)
    convergents = []
    for p, q in convergents_iter:
        convergents.append({
            "p": int(p),
            "q": int(q),
            "decimal_approx": float(N(p / q, 15)),
        })

    true_value = float(N(sympy_expr, 15))
    return coefficients, convergents, true_value
```

**Important note on `continued_fraction_iterator`:** For irrational numbers, SymPy evaluates the expression symbolically where possible (quadratic surds get exact periodic CFs) and falls back to high-precision numerical evaluation otherwise. For transcendental constants like π, γ, ζ(3), and ln(2), SymPy uses its `mpmath` backend (which ships with SymPy). Depth up to 50 terms is reliably fast for all 10 presets.

### JSON Response Shape

```json
{
  "number": "phi",
  "display_name": "Golden Ratio φ",
  "true_value": 1.6180339887498949,
  "coefficients": [1, 1, 1, 1, 1, 1, 1, 1],
  "convergents": [
    { "index": 0, "p": 1, "q": 1, "decimal_approx": 1.0 },
    { "index": 1, "p": 2, "q": 1, "decimal_approx": 2.0 },
    { "index": 2, "p": 3, "q": 2, "decimal_approx": 1.5 },
    { "index": 3, "p": 5, "q": 3, "decimal_approx": 1.6666666666666667 },
    { "index": 4, "p": 8, "q": 5, "decimal_approx": 1.6 },
    { "index": 5, "p": 13, "q": 8, "decimal_approx": 1.625 },
    { "index": 6, "p": 21, "q": 13, "decimal_approx": 1.6153846153846154 },
    { "index": 7, "p": 34, "q": 21, "decimal_approx": 1.619047619047619 }
  ]
}
```

- `index` is 0-based (the 0th convergent is just `a₀/1`).
- `p` and `q` are the numerator and denominator as plain integers (they stay manageable up to depth 50 for all presets).
- `decimal_approx` is the float value of `p/q`.
- `true_value` is included so the frontend can draw the target line without computing it separately.

---

## 3. Frontend Implementation

**File:** `frontend/views/contFraction.js`  
**Exports:** `render(data, container)`

### Controls

- **Dropdown** (`<select>`) — lists all 10 preset constants by display name. On change, re-fetches and re-renders.
- **Depth slider** — range input from 1 to 50, default 10. Debounce re-fetch by ~300 ms to avoid hammering the backend while the user drags.
- **View toggle** — two radio buttons or a tab row: "Number Line" and "Stern-Brocot Tree".

### Visualization A: Number Line (Priority 1 — implement first)

This is the simpler and more immediately intuitive view. It is fully reasonable in plain D3 without TypeScript.

**Layout:**
- A horizontal SVG axis spanning the visible range around the true value.
- The true value is marked with a vertical dashed line and a label.
- Each convergent `p/q` is plotted as a labeled point on the axis. Alternate convergents are colored differently (e.g. blue for even-index, orange for odd-index) to show the above/below ping-pong pattern visually.
- Connecting the points in sequence with a zigzag line (polyline) makes the oscillation explicit.
- Hovering a convergent dot shows a tooltip: `p/q = decimal_approx`, `error = |true - p/q|`.

**D3 specifics:**
- Use `d3.scaleLinear` to map decimal values to pixel x-positions.
- The domain should auto-fit to include `true_value` and all convergent values, with a small padding.
- For deeply converged sequences, the last several points will be visually indistinguishable at normal zoom. Consider a log-error secondary view (see "Additional Ideas" below) or simply show the tooltip for fine-grained info.
- Animate the convergents appearing one by one with `d3.transition` and a staggered delay, so the user can see the path build up step by step on each render.

### Visualization B: Stern-Brocot Tree (Priority 2 — implement after the number line)

The Stern-Brocot tree is a binary tree containing every positive rational exactly once, in lowest terms, in sorted order. Finding a real number x in the tree traces a binary search path — and each node visited is exactly a convergent (or a mediant along the way) of x.

**Complexity flag:** Rendering the full tree as a D3 tree layout gets crowded quickly and the labels become unreadable past depth ~6 in plain HTML/SVG without a zoom/pan library. **Recommended simpler alternative:** rather than drawing the full tree, draw only the **path** taken through the tree to reach each convergent, as a top-down binary path diagram (like a left/right decision tree). Each node shows the mediant fraction at that step and is highlighted if it is a true convergent. This is readable at any depth and requires only a straightforward D3 tree layout with 1 branch per level.

If you want to show more of the tree context, add `d3.zoom()` behavior to the SVG — this is a single D3 call and works well without TypeScript or a build step.

### Recommendation: Offer Both, Number Line First

Implement the number line view first — it directly illustrates the "ping-pong" convergence described in the spec and is a natural match for the data shape. The Stern-Brocot path view is a beautiful complement that shows the structural reason the convergents are optimal, and adds depth for interested users. A simple radio-button toggle between the two views is appropriate; there is no need for separate pages.

---

## 4. Additional Visualization Ideas

### A. Step-by-Step Animation

Add a "Play" button that advances the depth from 1 to the current slider value one step at a time (e.g. every 800 ms), redrawing the number line so the user watches the convergents accumulate and the zigzag narrow. This is easy with `setInterval` + `render()` and requires no D3-specific features.

### B. Nested Fraction Display

Show the CF as a formatted nested fraction equation in the info panel below the chart:

```
π ≈ 3 + 1/(7 + 1/(15 + 1/(1 + 1/292)))
```

This is pure HTML string construction — build it with a recursive template literal and insert it into a `<div>`. No D3 needed. This gives users immediate intuition for what a CF actually is before they engage with the chart.

### C. Error Plot (Log Scale)

A secondary small chart below the number line, plotting `|true_value - decimal_approx|` on a log scale against convergent index. This makes it easy to compare how quickly different constants converge. For the golden ratio, the error decreases slowly and steadily; for π, it occasionally makes a dramatic leap (when a large partial quotient like 292 appears). This can be a lightweight `d3.scaleLog` bar chart or line chart added beneath the main SVG.

### D. Side-by-Side Comparison

Two instances of the number line rendered together, each with its own dropdown, so the user can directly compare φ vs. π convergence speed. This is achievable in plain D3 by calling `render()` twice into two separate container `<div>` elements. The `render(data, container)` signature already supports this cleanly.

---

## 5. MCP Suggestions

- **`fetch` / browser MCP** — useful for pulling reference values from OEIS or Wolfram Alpha during development to sanity-check that SymPy's CF output is correct for each preset constant, especially for γ and ζ(3) where the CFs are less well-known.
- **`filesystem` MCP** — no special benefit here beyond the standard file editing workflow.
- No other MCPs are specifically valuable for this visualization's development.

---

## 6. Additional Packages Needed

No new Python packages are required. All computation uses:
- `sympy` — `continued_fraction_iterator`, `continued_fraction_convergents`, symbolic constants
- `sympy`'s bundled `mpmath` — high-precision numerical evaluation for transcendental constants (already a SymPy dependency; no separate install needed)

The standard packages listed in `infra_plans.md` (`fastapi`, `uvicorn`, `sympy`, `numpy`) are sufficient. `numpy` is not directly used by this router but is already in the environment.

---

## 7. Open Questions — Resolve Before Implementing

1. **Plastic constant SymPy expression.** `sympy.CRootOf` works but requires importing `CRootOf` and defining a symbol, which is slightly more setup than the other constants. Confirm whether to keep it or swap it for another constant (e.g. Champernowne's constant, the Liouville constant, or Gauss's constant) that has a simpler SymPy expression. The Plastic constant is mathematically compelling (it's the tribonacci analogue of φ) but if it causes implementation friction, replace it.

2. **Depth upper bound for γ and ζ(3).** These constants are computed numerically by mpmath. At depth 50, computation is fast on any modern machine, but has not been benchmarked in this repo's environment. If the endpoint is slow (> ~1 second) for depth 50 on γ or ζ(3), cap the slider at a lower value (e.g. 30) for those constants only — this requires passing a `max_depth` field back in the response so the frontend can adjust the slider accordingly.

3. **Number line domain at high depth.** For deeply converged constants (φ at depth > 15, √2 at depth > 10), all convergents cluster so tightly around the true value that they are indistinguishable on a linear axis at normal zoom. Decide before implementing: (a) auto-zoom the axis to the visible spread of the last 5 convergents only, (b) always show the error plot instead of trying to display all points on one axis, or (c) just accept that late convergents overlap and rely on the tooltip for their exact values. Option (c) is simplest; option (a) gives the clearest visual.

4. **Integer display of large p and q.** At depth 50, denominators can exceed JavaScript's safe integer range (2^53 - 1) for fast-converging constants. For example, √2's denominator at depth 50 is roughly 2^35 — safely within range. But for π, depth 50 produces denominators with ~25+ digits. Decide whether to return `p` and `q` as strings (safe but requires BigInt or string display on the frontend) or as floats (lossy but sufficient for display). Recommended: return them as strings and display them as-is; only `decimal_approx` (a float) is used for axis positioning.
