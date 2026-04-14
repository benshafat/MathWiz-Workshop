# Ulam Spiral — Implementation Plan

## 1. Math Background

### What the Ulam Spiral Is

The Ulam spiral was discovered by mathematician Stanislaw Ulam in 1963, reportedly while doodling during a boring meeting. The construction:

1. Write the integer **1** at the centre of a grid.
2. Spiral outward in a **clockwise** direction, placing each successive integer on the next cell.
3. Highlight (or colour) every cell whose value is **prime**.

When you do this for a large grid, unmistakable diagonal lines of primes leap out of the noise. The diagonals run at 45-degree angles (both / and \ directions), forming streaks that stretch for dozens of cells.

### Why Diagonal Patterns Appear (and Why We Don't Fully Understand Them)

Along any diagonal in the spiral, the values follow a **quadratic polynomial** in one variable. For example, the main north-east diagonal starting from 1 generates values `1, 9, 25, 49, ...` (all odd squares), while nearby diagonals generate sequences like `5, 17, 37, 65, ...` — which happen to be the values of `4n² + 2n + 5`.

It has been known since Euler that some quadratic polynomials `an² + bn + c` produce primes with unusual density. The classic example is `n² + n + 41`, which yields primes for all n from 0 to 39. Because the Ulam spiral maps diagonals to quadratic polynomials, a diagonal corresponding to a "prime-rich" polynomial will appear bright in the visualisation.

What is **not** understood: there is no proven theorem explaining why certain quadratic forms are more prime-rich than others, or fully characterising which diagonals will be bright. The Hardy-Littlewood Conjecture B (1923) gives a probabilistic prediction for how many primes a quadratic polynomial produces, and it fits the data well — but it remains unproven. The Ulam spiral is a vivid, visual reminder that prime distribution is simultaneously highly structured and deeply mysterious.

### Twin Primes

A **twin prime pair** is a pair of primes `(p, p+2)` — two primes separated by exactly 2 (e.g. 11 & 13, 17 & 19, 41 & 43). The **Twin Prime Conjecture** states there are infinitely many such pairs; like many prime conjectures, it is unproven. In the spiral, twin primes tend to cluster on the same diagonals as regular primes, so overlaying them makes those diagonals even brighter.

### Other Overlayable Sequences

| Sequence | Definition | Visual interest |
|---|---|---|
| Twin primes | `p` and `p+2` both prime | Clusters on the prime diagonals |
| Cousin primes | `p` and `p+4` both prime | Similar clustering, slightly offset |
| Sexy primes | `p` and `p+6` both prime | Denser overlay |
| Gaussian primes | Primes in the Gaussian integers `a + bi` | Form their own 2-D pattern, fully different diagonals |
| Sophie Germain primes | `p` prime and `2p+1` also prime | Relevant to cryptography; interesting sparse overlay |
| Numbers with a fixed smallest prime factor | e.g. "divisible by 3 but not 2" | Colour-code by SPF to see compositeness texture |

---

## 2. Backend Implementation

### File

`backend/routers/ulam_spiral.py`

### Spiral Walk Algorithm

The canonical approach is to walk the grid in a **clockwise outward spiral**, keeping track of (x, y) and a direction state machine. The direction cycle is: **right → down → left → up → right → ...**, with each straight run growing by 1 cell every two turns.

```
Pseudo-code:

x, y = 0, 0
value = 1
dx, dy = 1, 0          # start moving right
segment_length = 1
segment_steps = 0
turn_count = 0

while value <= max_value:
    emit(x, y, value)
    value += 1
    x += dx
    y += dy
    segment_steps += 1

    if segment_steps == segment_length:
        segment_steps = 0
        # rotate 90° clockwise: (1,0)->(0,-1)->(−1,0)->(0,1)->(1,0)
        dx, dy = -dy, dx
        turn_count += 1
        if turn_count % 2 == 0:
            segment_length += 1
```

Note on coordinate convention: use **y increasing downward** (screen coordinates) so the rendering layer does not need to flip. This means the spiral goes right → down → left → up when viewed on canvas.

For a grid of half-width `size`, the spiral covers a `(2*size+1) × (2*size+1)` area, producing `(2*size+1)²` points. The cap `ULAM_CAP = 250_000` limits `size` to `floor((sqrt(250_000) - 1) / 2) = 249`, i.e. a 499×499 grid (249,001 points — just under the cap).

### Primality with SymPy

SymPy's `isprime` uses a combination of trial division, Baillie-PSW, and Miller-Rabin — it is deterministic and exact for all integers in the range we need (up to ~250,000). No additional math packages are required.

```python
from sympy import isprime
```

For performance at large grids, pre-generate primality with a **Sieve of Eratosthenes** up to `max_value` rather than calling `isprime` per point. NumPy makes this efficient:

```python
import numpy as np

def prime_sieve(limit: int) -> np.ndarray:
    """Return boolean array where index i is True if i is prime."""
    sieve = np.ones(limit + 1, dtype=bool)
    sieve[0:2] = False
    for i in range(2, int(limit**0.5) + 1):
        if sieve[i]:
            sieve[i*i::i] = False
    return sieve
```

Using the sieve drops primality checking from O(n · sqrt(n)) to O(n log log n) — material for the largest grids.

### Endpoint Signature

```
GET /api/ulam-spiral?size=<int>
```

**Parameters:**
- `size` (int, required): half-width of the grid. The total grid is `(2*size+1) × (2*size+1)`. Clamped to `[1, 249]` server-side.

**ULAM_CAP enforcement:**

```python
ULAM_CAP = 250_000
MAX_HALF = int((ULAM_CAP**0.5 - 1) // 2)  # == 249

@router.get("/ulam-spiral")
def ulam_spiral(size: int = 10):
    size = max(1, min(size, MAX_HALF))
    ...
```

### JSON Response Shape

```json
{
  "size": 10,
  "points": [
    {"x": 0,  "y": 0,  "value": 1,   "is_prime": false},
    {"x": 1,  "y": 0,  "value": 2,   "is_prime": true},
    {"x": 1,  "y": -1, "value": 3,   "is_prime": true},
    {"x": 0,  "y": -1, "value": 4,   "is_prime": false},
    {"x": -1, "y": -1, "value": 5,   "is_prime": true},
    ...
  ],
  "total_points": 441
}
```

`x` and `y` are signed integers relative to the centre (1 = value 1). The frontend uses `x` and `y` directly with a linear scale anchored at the canvas centre.

**Why return `value`?** The frontend needs it for tooltips and for the diagonal-highlight feature (finding the quadratic polynomial a diagonal corresponds to). Transmitting `value` as an integer costs nothing at these scales.

**Payload size estimate:** At 249,001 points, a compact JSON payload is roughly 10-15 MB (each object ~45 chars). This is fine for a local dev server but worth being aware of. If it becomes slow, switch to a flat array encoding (see Open Questions).

---

## 3. Frontend Implementation

### File

`frontend/views/ulamSpiral.js`

### Canvas vs SVG

At 500×500 = 250,000 points, SVG is **not viable** — each point would be a DOM element, making pan/zoom glacially slow. Use **`<canvas>`** for rendering.

D3 is still used for:
- Building and updating the linear scales (`d3.scaleLinear`) that map grid coordinates to pixel coordinates.
- Handling zoom/pan via `d3.zoom`, which provides the transform object used to update the canvas render.
- Driving the colour scale for overlays.

The canvas pixel draw loop is plain JavaScript — D3's canvas support is minimal, and a tight `for` loop calling `ctx.fillRect` per point is the fastest approach.

### Zoom Strategy: Single Fetch, Frontend Clipping

**Decision: fetch up to the current size in one request; re-fetch when the user zooms past the current data boundary.**

Rationale: the frontend maintains a `currentData` array. When the user loads the view, it fetches `size=10` (441 points). As the user zooms out (more of the grid becomes visible), the frontend checks whether the requested viewport would exceed the data already fetched; if so, it fetches the next tier. Suggested tier sizes:

| Tier | `size` param | Points | When to fetch |
|---|---|---|---|
| 1 | 10 | 441 | Initial load |
| 2 | 50 | 10,201 | Zoom covers > 10 radius |
| 3 | 150 | 90,601 | Zoom covers > 50 radius |
| 4 | 249 | 249,001 | Zoom covers > 150 radius |

This avoids streaming complexity. Each tier replaces the previous dataset entirely (the larger dataset is a superset). A loading spinner is shown during the fetch.

The frontend does **not** pass a viewport rect to the backend; it clips to the visible canvas area in the render loop using the D3 zoom transform to skip out-of-bounds points.

### Render Loop

```javascript
function drawSpiral(ctx, data, transform, options) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  const cx = width / 2, cy = height / 2;
  const scale = transform.k * CELL_SIZE; // CELL_SIZE = pixels per cell at k=1

  for (const pt of data.points) {
    const px = cx + (pt.x * scale) + transform.x;
    const py = cy + (pt.y * scale) + transform.y;

    // Frustum cull: skip points outside the canvas
    if (px < -scale || px > width + scale || py < -scale || py > height + scale) continue;

    ctx.fillStyle = getColor(pt, options);
    ctx.fillRect(px - scale / 2, py - scale / 2, scale - 1, scale - 1);
  }
}
```

### Colour Scheme

| Cell type | Default colour |
|---|---|
| Prime | `#f97316` (orange) — visually "hot" |
| Composite | `#1e293b` (dark slate) — recedes |
| 1 (neither prime nor composite) | `#64748b` (grey) |
| Highlighted diagonal | `#facc15` (yellow) — draws the eye |
| Twin prime overlay | `#34d399` (green) |
| Hovered cell | White outline stroke |

Background: `#0f172a` (very dark navy), making the orange primes pop.

### Prime-Click Diagonal Highlight

When the user clicks a prime cell:

1. Determine which diagonal(s) pass through the clicked cell. Each cell `(x, y)` lies on two diagonals: the `/` diagonal (`x + y = const`) and the `\` diagonal (`x - y = const`).
2. Collect all points in `currentData` where `point.x + point.y === clickedX + clickedY` (for the `/` diagonal) or `point.x - point.y === clickedX - clickedY` (for the `\` diagonal).
3. Mark those points as "highlighted diagonal" in render state and redraw.
4. Show a small tooltip/sidebar panel listing: diagonal family, the quadratic polynomial it corresponds to (precomputed from the spiral geometry), and the count of primes on that diagonal.

**Complexity note (plain JS / no build step):** Deriving the exact quadratic polynomial for an arbitrary diagonal from scratch at runtime is moderately complex but doable without any library — it requires solving a 3-point system. However, a simpler alternative that still communicates the main idea is to skip the polynomial label and just highlight the diagonal cells visually with a count. This is recommended for the initial implementation; the polynomial label can be a stretch goal.

### Controls UI

- **Overlay checkboxes**: "Twin Primes", "Cousin Primes", "Sophie Germain Primes" — toggling these filters `currentData` client-side and redraws.
- **Colour mode radio**: "Primes only" / "Smallest prime factor" (SPF) — SPF mode assigns a hue per factor (2=red, 3=orange, 5=yellow, etc.), turning composites into a texture instead of uniform dark.
- **Zoom**: mouse wheel (via `d3.zoom`) + pan by drag.
- **Reset view** button: snaps back to 10×10 visible area.

---

## 4. Additional Visualization Ideas

### Colour-Code by Smallest Prime Factor (SPF)

Instead of binary prime/composite colouring, assign each composite a colour based on its smallest prime factor. This creates a richly textured background where the "roads" of small-factor composites wind between the prime diagonals. SPF is cheap to compute server-side — add a `spf` field to each JSON object (null for primes, 2/3/5/7/... for composites).

### Twin Prime Overlay Toggle

Filter `currentData` client-side: a cell is a "twin prime" cell if `is_prime && (data has value±2 that is also prime)`. Build a lookup `Set` of prime values on load, then check membership. No extra backend call needed.

### Gaussian Prime Overlay

A Gaussian integer `a + bi` is a Gaussian prime if it cannot be factored in `Z[i]`. Ordinary primes of the form `4k+3` are Gaussian primes; primes of the form `4k+1` split. Composites are generally not. The Gaussian prime pattern in 2D looks completely different from the Ulam diagonal pattern — overlaying both in different colours makes a striking contrasting image. This does require backend support (add an `is_gaussian_prime` field) since the classification logic is non-trivial to do client-side efficiently.

### Animation: Spiral Growth

Animate the spiral being drawn from the centre outward, revealing cells one by one (or in batches of 50 for speed). Use `requestAnimationFrame`. This communicates the construction algorithm and is visually satisfying. Start with the full dataset already fetched; animation is purely a rendering effect.

### Heatmap Mode: Prime Density by Region

Divide the grid into NxN macro-cells (e.g. 5×5 blocks). Colour each macro-cell by the fraction of its cells that are prime. This produces a smooth density map and makes the diagonal bands even more visible at a high level. Computable entirely client-side from `currentData`.

### "What Polynomial Is This Diagonal?" Tooltip

For a clicked diagonal, compute the quadratic `an² + bn + c` that generates its values, display it in a panel, and show how many primes it produces in the visible range vs. the expected count from Hardy-Littlewood heuristics. This is the highest-complexity feature — flag as a stretch goal.

---

## 5. MCP Suggestions

- **MCP Filesystem / Project Context**: useful for keeping the spiral router in sync with other routers as the project grows. No specific MCP is strictly required for this visualization.
- **MCP Browser / Puppeteer**: could be used to take screenshots of the canvas at different zoom levels for automated visual regression testing — a nice-to-have for a workshop demo that will be shown to an audience.
- **MCP Math / WolframAlpha**: if you want to auto-generate the Hardy-Littlewood density predictions for specific diagonals (the "how prime-rich is this polynomial?" tooltip), querying Wolfram Alpha via MCP would save implementing the formula from scratch.

---

## 6. Additional Packages Needed

No additional Python packages beyond the already-planned stack (`fastapi`, `uvicorn`, `sympy`, `numpy`) are required. The NumPy sieve covers all primality needs efficiently.

If the **Gaussian prime overlay** is implemented, no new package is needed — the classification rule (`a² + b²` is prime, or `p ≡ 3 mod 4`) is straightforward arithmetic.

**No new JS libraries** beyond D3 are needed. Plain canvas 2D API handles all rendering.

---

## 7. Open Questions — Resolve Before Implementing

1. **JSON encoding format for large payloads**: At tier 4 (249,001 points), the response is ~10-15 MB of JSON. For a local dev server this is likely acceptable, but if it causes noticeable lag, a flat array encoding (`[x, y, value, is_prime, ...]` packed into four parallel arrays) would cut payload size by ~40% and parse faster. Decide before implementing the backend to avoid a breaking API change.

2. **SPF field in response**: Should the backend always include a `spf` (smallest prime factor) field in every point object, or only when the client passes `?overlay=spf`? Always including it doubles the useful data per point at minimal compute cost (it falls out of the sieve naturally), but increases payload size. Recommendation: always include it and let the frontend ignore it when not in SPF mode — but confirm this is acceptable.

3. **Gaussian prime overlay scope**: Is the Gaussian prime overlay in scope for v1, or is it a future enhancement? It requires an `is_gaussian_prime` field in the response and client-side rendering logic. If deferred, the JSON schema should still reserve the field as `null` so adding it later is non-breaking.

4. **Cell size at initial zoom**: What should `CELL_SIZE` (pixels per cell at zoom level 1) be? A 10×10 grid visible on a ~800px canvas implies ~40px per cell. As the user zooms out to reveal a 499×499 grid, cells shrink to ~1.6px — at which point individual cells are sub-pixel and the rendering collapses to a density image. This is actually fine and arguably beautiful, but the team should know to expect it. Confirm that sub-pixel rendering (cells < 1px wide) is acceptable rather than switching to a density/heatmap view below a threshold.

5. **Click-to-highlight interaction on mobile / touch**: The diagonal-highlight feature uses a click event. On touch screens, `click` fires after `touchend`, which is usually fine — but if the workshop will be demoed on a tablet, test that the touch target (a single cell that may be 2-3px wide at high zoom) is large enough to be tappable. If not, consider enlarging the hit area to the nearest 10px.
