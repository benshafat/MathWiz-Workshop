# Modular Arithmetic Webs — Implementation Plan

## 1. Math Background

### Modular Multiplication Tables

A modular multiplication table on a circle works as follows: place the integers 0 through n−1 equally spaced around a circle. For a fixed multiplier m, draw a line from each point k to the point (k × m) mod n. The full set of n lines constitutes the "web" for a given (m, n) pair.

The construction is sometimes called the "times table on a circle" or the "Mandelbrot times table" after a popular YouTube video. Every point participates as a source exactly once, so there are always exactly n line segments (including the degenerate case where k × m mod n = k itself, which produces a line of zero length — a dot).

**Why does m=2, n=200 produce a cardioid?**

The cardioid is a classic curve defined parametrically as:
```
x(t) = r(2cos(t) − cos(2t))
y(t) = r(2sin(t) − sin(2t))
```
The multiplication-by-2 map on a circle of n points is a discrete approximation of the angle-doubling map `θ → 2θ` on the unit circle. As n grows large, the envelope of the chords connecting θ to 2θ (mod 2π) converges to a cardioid. This is because the envelope of a family of chords `P(t) → P(2t)` on a circle traces a cardioid — a well-known result in envelope theory. At n=200 the approximation is already visually clean; at n=500 it is nearly indistinguishable from the smooth curve.

**What is a nephroid, and which (m, n) produces it?**

A nephroid is a two-cusped epicycloid. It is the envelope of chords connecting θ to 3θ (mod 2π) on a circle, i.e., the angle-tripling map. Set m=3 with large n (n=200 or more) and the chords form a nephroid. The general rule:

| m | Envelope curve |
|---|----------------|
| 2 | Cardioid (1 cusp, epicycloid of order 1) |
| 3 | Nephroid (2 cusps, epicycloid of order 2) |
| 4 | Epicycloid with 3 cusps |
| 5 | Epicycloid with 4 cusps |
| m | Epicycloid with m−1 cusps |

The pattern is: multiplying by m produces the envelope of an epicycloid with m−1 cusps. As m increases past n/2 the patterns reverse and fold back in (due to modular wrap-around), producing more complex or symmetric star-polygon patterns.

**How do patterns change as m increases?**

- m=1: Every point maps to itself. All lines are degenerate (dots). No pattern visible.
- m=2: Cardioid envelope. One cusp at the "top" of the circle.
- m=3: Nephroid. Two cusps.
- Small m (2–10): Clean epicycloid envelopes, increasing cusp count.
- m near n/2: Lines become densely packed and nearly parallel, producing star-burst or petal patterns depending on gcd(m, n).
- m = n/2 (when n is even): Lines from k always connect to the antipodal point (k + n/2) mod n. All lines pass through the center. A single "asterisk" shape.
- gcd(m, n) = d > 1: The points split into d independent orbits of size n/d. The web decomposes into d separate sub-webs, each looking like the (m/d, n/d) web but rotated — producing symmetric multi-fold patterns.
- m close to n: Nearly the same as m close to 0 (since (n−1) × k mod n = n−k mod n, the reflection of multiplying by 1). Produces a near-identity mapping that looks like a small "twist."

The most visually rewarding range is m from 2 to about 20 with n fixed at 200, where each increment reveals a new epicycloid. Sweeping m continuously (via animation) makes the morphing of curves viscerally clear.

---

## 2. Backend Implementation

### Router file: `backend/routers/modular_web.py`
### Endpoint: `GET /api/modular-web`

**Parameters:**
- `n` (int): number of points on the circle. Recommended range: 2–500.
- `m` (int): multiplier. Recommended range: 0–n.

#### Compute on Backend or Frontend?

**Recommendation: compute on the frontend.**

The computation is trivial: for each k in 0..n−1, compute `(k * m) % n`. This is a single loop of integer arithmetic — no math library is needed and the result for n=500 takes under a millisecond in JavaScript. Sending a request to the backend every time a slider moves (which can fire 10–30 times per second) would introduce noticeable latency and unnecessary network round-trips for a computation that is genuinely instantaneous client-side.

However, keeping the backend endpoint is still worthwhile for two reasons:
1. It fits the uniform API contract established by the rest of the project (all visualizations have a backend route).
2. It allows future extensions (e.g., filtering symmetry classes via gcd, returning metadata like cusp count) without changing the frontend data contract.

**Practical approach:** the frontend computes the `{from, to}` pairs locally for slider-driven live updates. The backend endpoint exists and is called once on initial page load (or when the user explicitly clicks a "Fetch" button), but slider interactions re-render using pure client-side computation.

#### Algorithm (backend)

```python
def compute_web(n: int, m: int) -> list[dict]:
    return [{"from": k, "to": (k * m) % n} for k in range(n)]
```

No SymPy or NumPy needed. Pure Python suffices. (NumPy could vectorize this but the gain is negligible for n ≤ 500.)

#### JSON Response Shape

```json
{
  "n": 200,
  "m": 2,
  "lines": [
    {"from": 0, "to": 0},
    {"from": 1, "to": 2},
    {"from": 2, "to": 4},
    {"from": 3, "to": 6},
    "...",
    {"from": 100, "to": 0},
    {"from": 101, "to": 2},
    "...",
    {"from": 199, "to": 198}
  ]
}
```

Fields:
- `n` — the number of points (echoed back for the frontend to use when placing points).
- `m` — the multiplier (echoed back).
- `lines` — array of `{from, to}` objects, one per point k in order k=0..n−1.

Note: lines where `from == to` are valid entries (they represent k mapping to itself) and should be included. The frontend may choose to skip drawing them (they contribute nothing visual) or draw them as tiny dots.

#### Input Limits and Validation

| Parameter | Valid range | Out-of-range response |
|-----------|-------------|----------------------|
| n | 2 ≤ n ≤ 500 | HTTP 422 with message |
| m | 0 ≤ m ≤ n−1 | HTTP 422 with message |

**Why n ≤ 500?** At n=500 the response contains 500 line-segment objects (~15 KB JSON). Above n=500, SVG rendering starts to degrade noticeably (see SVG vs Canvas section below). The cardioid at n=200 is already clean; n=500 is more than enough. Raising this cap is a one-line change if needed.

**Why m ≤ n−1?** The map k → (k × m) mod n is periodic with period n in m; accepting m ≥ n would return results identical to m mod n, which is confusing. Reject out-of-range values rather than silently wrap.

#### Full Router Skeleton

```python
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api", tags=["modular-web"])

N_MIN, N_MAX = 2, 500

@router.get("/modular-web")
def modular_web(
    n: int = Query(..., description="Number of points on the circle"),
    m: int = Query(..., description="Multiplier"),
):
    if not (N_MIN <= n <= N_MAX):
        raise HTTPException(
            status_code=422,
            detail=f"n must be between {N_MIN} and {N_MAX}."
        )
    if not (0 <= m <= n - 1):
        raise HTTPException(
            status_code=422,
            detail=f"m must be between 0 and n−1 ({n - 1})."
        )
    lines = [{"from": k, "to": (k * m) % n} for k in range(n)]
    return {"n": n, "m": m, "lines": lines}
```

---

## 3. Frontend Implementation

### File: `frontend/views/modularWeb.js`
### Exports: `render(data, container)`

#### Circular Point Layout

Points are placed on a circle of radius r centered at (cx, cy). The angle for point k is:
```
angle(k) = (2π × k / n) − π/2
```
The `−π/2` offset places point 0 at the top (12 o'clock), matching the conventional "times table" orientation.

Cartesian coordinates:
```javascript
function pointCoords(k, n, cx, cy, r) {
  const angle = (2 * Math.PI * k / n) - Math.PI / 2;
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}
```

#### Drawing Lines Between Pairs

Each `{from, to}` pair is drawn as a straight line (chord) between the two corresponding circle points. Lines where `from === to` are skipped.

#### SVG vs Canvas — Performance Tradeoff

At n=200 there are 200 line elements. At n=500 there are 500 line elements. At these scales SVG is perfectly adequate — modern browsers handle thousands of SVG elements without issue.

**However**, if the slider range for n is extended beyond 500 (e.g., to 1000 or 2000), SVG DOM manipulation becomes the bottleneck during live slider dragging. At n=1000 with continuous slider events, re-rendering 1000 SVG `<line>` elements per frame causes visible stutter.

**Recommendation: use SVG for the initial implementation** (it is simpler and integrates cleanly with D3), but structure the drawing code so the rendering step (the part that emits geometry) is isolated in a single function. If performance degrades, that function can be swapped to Canvas rendering without touching the rest of the UI code.

If n is later extended to ≥ 1000, switch the drawing step to Canvas:
```javascript
// Canvas version of the draw step
function drawLines(ctx, lines, n, cx, cy, r, color) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;
  for (const {from, to} of lines) {
    if (from === to) continue;
    const [x1, y1] = pointCoords(from, n, cx, cy, r);
    const [x2, y2] = pointCoords(to, n, cx, cy, r);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}
```
Canvas batches all drawing into one rasterize call per frame, which is 10–50× faster than DOM manipulation at high n. **Flag for implementer: if the slider range for n is extended beyond ~600, switch the drawing step to Canvas.**

#### Sliders for m and n — New API Call or Client-Side Recompute?

As established in section 2: **sliders recompute client-side, no API call per slider tick.**

The slider event handler recomputes the `{from, to}` pairs directly in JavaScript and calls the render function with the new data. This gives smooth, lag-free interaction.

```javascript
function computeLines(n, m) {
  const lines = [];
  for (let k = 0; k < n; k++) {
    lines.push({ from: k, to: (k * m) % n });
  }
  return lines;
}
```

The backend is called once on initial page load to populate the view. A "Reset to defaults" button can also trigger a backend call to re-fetch the canonical n=200, m=2 cardioid.

#### Slider UX Details

Two sliders, displayed above the circle:
- **n slider**: range 10–500, step 1, default 200. Label: "Points on circle: 200".
- **m slider**: range 1–n, step 1, default 2. Label: "Multiplier: 2".

When n changes, the m slider's max should update to n−1 (clamp m if it exceeds the new max). Both labels update in real time as the sliders move.

The `input` event (fires continuously while dragging) triggers client-side recompute and redraw. The `change` event (fires on release) triggers a backend API call to sync the canonical state — this is optional and can be omitted if desired.

#### Colour Options

Three options, selectable via a small radio group or dropdown:

1. **Single colour with opacity** (default): all lines drawn in a single hue (e.g., `rgba(30, 100, 220, 0.35)`). Low opacity allows the envelope curve to emerge visually from the density of overlapping lines. This is the "classic" look and the best default.

2. **Gradient by index**: each line k is coloured by its position in the sequence using a D3 colour scale (e.g., `d3.interpolateRainbow(k / n)`). Produces a vivid rainbow web. Works well for showcasing the structure; can be visually noisy for complex patterns.

3. **Gradient by chord length**: colour each line by `|from - to|` (the "distance" around the circle). Short chords get one colour, long chords get another. This highlights where the near-diagonal and far-diagonal connections concentrate, which visually separates the inner and outer structure of the pattern. Use a diverging scale (e.g., `d3.interpolateCool`).

To keep the UI simple, implement option 1 first. Add the colour selector as a follow-up once the core interaction works.

---

## 4. Additional Visualization Ideas

**a. Animation: sweep m from 1 to n**

A "Play" button starts an animation that increments m by 1 each frame (or every ~100ms), cycling from 1 to n−1 and looping. The user watches the cardioid, nephroid, and epicycloids morph continuously. Implementation: use `setInterval` or `requestAnimationFrame` with a counter; call `computeLines` and redraw each tick. A "Stop" button halts the animation. Complexity: low — this is a straightforward interval + redraw loop.

**b. Colour each line by chord distance `|from - to|`**

As described in section 3 (colour option 3). Visually distinguishes lines that "wrap around" the circle (long chords passing through the interior) from lines that stay near the perimeter (short chords that are nearly tangent to the envelope). The concentration of long chords forms the envelope curve very clearly. This is one of the most informative colourings for understanding why the cardioid emerges.

**c. Multiple m values simultaneously**

Allow the user to enter a comma-separated list of m values (e.g., "2, 3") and overlay the webs in different colours. This makes it easy to compare the cardioid and nephroid side by side on the same circle, or to see how two patterns interact. Implementation: maintain an array of active m values; compute and draw a separate set of lines per m value, each in its own colour. A small legend shows which colour corresponds to which m. Complexity: moderate — requires managing multiple overlay layers in SVG (or multiple Canvas draw passes with `globalAlpha`).

**d. Highlight the envelope curve**

Overlay the actual parametric cardioid (or epicycloid) curve in a contrasting colour on top of the chord web. For m=2 this is the true cardioid; for m=3 the nephroid. The overlay makes it immediately clear that the chords are forming the envelope of a smooth mathematical curve. Compute the parametric curve in JavaScript (no backend call needed) using 300–500 sample points and draw it as an SVG `<path>` or Canvas `polyline`. Complexity: low for the cardioid and nephroid (well-known parametric formulas); generalizing to arbitrary m requires the epicycloid formula `x(t) = r((m-1)cos(t) - cos((m-1)t))`.

**e. Dot labels on hover**

When the user hovers near a point on the circle, show a tooltip with the point's index k and its mapping target `(k × m) mod n`. Highlight the corresponding chord. This is most useful for small n where individual lines are visible. At large n the points are too close together to hover meaningfully, so implement this only when n < 50. Complexity: low.

---

## 5. MCP Suggestions

- **Browser / Puppeteer MCP**: Highly useful for this visualization. The visual output is the entire product — being able to take a screenshot, observe whether the cardioid is forming correctly, and iterate on opacity, stroke width, and colour with AI feedback dramatically speeds up the design loop. Strongly recommended for the slider-interaction and colour tuning phases.

- **Filesystem MCP**: Already in use for writing view files and router files directly. No change needed.

No specialized math MCPs are needed. The core computation is trivial arithmetic that runs entirely in plain JavaScript.

---

## 6. Additional Packages Needed

No new Python packages are required beyond those already listed in `infra_plans.md`:

```
fastapi
uvicorn[standard]
sympy
numpy
```

The backend for this visualization uses only built-in Python arithmetic — not even NumPy or SymPy are needed for the computation itself (they are included for other visualizations). No additional JS libraries are needed beyond D3.js (already on CDN), and D3 is only used for colour scales and SVG utilities — the geometry is computed with plain JS math.

---

## 7. Open Questions — Resolve Before Implementing

1. **Extend n beyond 500?** The plan caps n at 500 and uses SVG. If the intent is to allow n up to 1000 or 2000 (for even smoother envelopes), the drawing step should be implemented in Canvas from the start rather than refactoring it later. Decide the maximum n before writing the frontend render function.

2. **Slider range for m: 1..n or 1..floor(n/2)?** Because the pattern for multiplier m is the mirror image of n−m (i.e., `(k*(n-m)) mod n = n - (k*m mod n)`, the same pattern reflected), the second half of the m range is redundant for purely visual purposes. Limiting the m slider to 1..floor(n/2) halves the slider range and keeps the "interesting" region centred. This is a design preference — clarify whether the full 1..n−1 range is desired.

3. **Default colour scheme?** The plan defaults to single-colour with low opacity. If the workshop has a dark-themed UI (dark background), the default hue should shift (white or cyan lines on black background read much better than blue on white). Confirm background colour before finalising the default colour values.

4. **Should m=1 be accessible on the slider?** At m=1, every point maps to itself and nothing is drawn. This may confuse users who drag the slider to 1 and see a blank screen. Options: set the slider minimum to 2, or keep m=1 accessible but display a note "m=1: identity map — all points map to themselves."

5. **Dot markers for circle points?** The spec says "draw points 0–n on a circle." Should the n points be rendered as small visible dots on the circle perimeter, or should the circle simply be implied by the chord geometry? Small dots (r=2px SVG circles) reinforce the discrete structure but add visual clutter at large n. Recommend: show dots only when n ≤ 50, hide them for larger n. Confirm this threshold.

6. **Circle itself: draw or omit?** Should a faint circle outline be drawn as a visual guide? This helps users understand the geometry but adds a visual element not strictly required. Recommendation: draw a thin grey circle at low opacity — but confirm this is desired.
