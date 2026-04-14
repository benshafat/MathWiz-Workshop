# Recamán's Sequence — Implementation Plan

## 1. Math Background

### The Rule

Recamán's sequence (OEIS [A005132](https://oeis.org/A005132)) is defined by a deceptively simple rule:

```
a(0) = 0
a(n) = a(n-1) - n   if  a(n-1) - n > 0  AND  (a(n-1) - n) not yet in the sequence
a(n) = a(n-1) + n   otherwise
```

In plain English: start at 0. At each step `n`, try to jump *backward* by `n`. If the landing spot is positive and hasn't been visited before, take that backward jump. Otherwise, jump *forward* by `n`.

The first several terms (n = 0..15):

```
0, 1, 3, 6, 2, 7, 13, 20, 12, 21, 11, 22, 10, 23, 9, 24, ...
```

### Why It Is Fascinating

- **Unpredictability.** Despite the completely deterministic rule, consecutive terms can jump by large amounts (forward) or double back sharply (backward). There is no closed-form formula.
- **The open problem.** It is unknown whether every positive integer eventually appears in the sequence. Empirically the sequence seems to cover all integers, but this has never been proved.
- **Self-avoiding arcs.** Consecutive pairs `(a(n-1), a(n))` trace arcs on a number line. The backward arcs nest inside each other in surprising ways, and the diagram rewards close inspection.
- **Musical interpretation.** If each term is mapped to a MIDI pitch (or a frequency), the resulting melody is surprisingly pleasant — it sounds composed rather than random. Numberphile's video on this sequence popularised the musical reading.

---

## 2. Backend Implementation

### Algorithm

No SymPy or NumPy is needed. The algorithm is a single loop with a Python set for O(1) membership tests.

```python
def recaman(n: int) -> list[int]:
    seq = [0]
    visited = {0}
    for i in range(1, n):
        candidate = seq[-1] - i
        if candidate > 0 and candidate not in visited:
            seq.append(candidate)
        else:
            candidate = seq[-1] + i
            seq.append(candidate)
        visited.add(seq[-1])
    return seq
```

Time complexity: O(n). Memory: O(n). For `terms` up to ~5 000, this runs in well under a millisecond on any modern machine.

### Router File

`backend/routers/recaman.py`

### Endpoint

```
GET /api/recaman?terms=<int>
```

**Query parameter**

| Param | Type | Default | Validation |
|---|---|---|---|
| `terms` | int | 50 | Reject if < 1 or > 5 000 (prevents accidental very large allocations; 5 000 terms is more than enough for an interesting diagram). |

**Response shape**

Return both the raw sequence values *and* the arc pairs pre-computed on the backend. The arc pairs (`arcs`) spare the frontend from reconstructing them and make the direction flag explicit.

```json
{
  "terms": 50,
  "sequence": [0, 1, 3, 6, 2, 7, 13, 20, 12, 21, 11, 22, 10, 23, 9, 24, ...],
  "arcs": [
    { "from": 0, "to": 1,  "direction": "forward",  "step": 1 },
    { "from": 1, "to": 3,  "direction": "forward",  "step": 2 },
    { "from": 3, "to": 6,  "direction": "forward",  "step": 3 },
    { "from": 6, "to": 2,  "direction": "backward", "step": 4 },
    ...
  ],
  "max_value": <int>,
  "visited_set": [0, 1, 2, 3, 6, 7, ...]
}
```

Field notes:

- `sequence` — the raw ordered list; useful for the audio sonification feature.
- `arcs` — each arc has `from`, `to`, `direction` (`"forward"` or `"backward"`), and `step` (the index `n` at which the jump was taken). The frontend uses `direction` for colour coding and `step` for animation ordering.
- `max_value` — the largest value in the sequence; the frontend needs this to set the number line scale without a separate pass.
- `visited_set` — sorted list of all integers that have appeared, so the frontend can highlight covered vs uncovered integers on the number line without recomputing.

### Pydantic Response Model

```python
from pydantic import BaseModel

class Arc(BaseModel):
    from_: int = Field(alias="from")
    to: int
    direction: str   # "forward" | "backward"
    step: int

class RecamanResponse(BaseModel):
    terms: int
    sequence: list[int]
    arcs: list[Arc]
    max_value: int
    visited_set: list[int]

    model_config = {"populate_by_name": True}
```

---

## 3. Frontend Implementation

### File

`frontend/views/recaman.js` — exports `render(data, container)`.

### Arc Diagram Approach

The arc diagram places integers on a horizontal number line and draws a semicircular arc for each consecutive pair `(a(n-1), a(n))`.

**Number line scale**

`max_value` from the response sets the domain. Use a D3 linear scale:

```js
const x = d3.scaleLinear()
    .domain([0, data.max_value])
    .range([margin.left, width - margin.right]);
```

Early terms can jump to large values (term 7 is already 20, term 9 is 21). Because of this, the arc for step 1 (`0 → 1`) and the arc for step 7 (`13 → 20`) will look very different in radius. This is fine and actually illustrates the character of the sequence. The number line should always span `[0, max_value]` so every arc fits without clipping.

If the term count is large and `max_value` becomes very large (e.g. > 1 000), consider hiding the individual tick marks and only showing every Nth integer on the axis, to avoid overplotting. The `visited_set` dots (below) still render at their true positions.

**Drawing arcs**

Each arc is a D3 path using `d3.arc` or a manual SVG `<path>` with an elliptical arc command. A semicircle connecting `from` to `to` has:

- Centre x: `(x(from) + x(to)) / 2`
- Radius: `Math.abs(x(to) - x(from)) / 2`
- Sweep: top of the SVG (above the line) for backward steps, bottom (below) for forward steps.

SVG path snippet for one arc:

```js
const cx = (x(arc.from) + x(arc.to)) / 2;
const r  = Math.abs(x(arc.to) - x(arc.from)) / 2;
const sweep = arc.direction === "backward" ? 1 : 0;  // 1 = clockwise = above the line
const d = `M ${x(arc.from)} ${lineY}
           A ${r} ${r} 0 0 ${sweep} ${x(arc.to)} ${lineY}`;
```

Adjusting `sweep` so backward arcs appear *above* the number line and forward arcs appear *below* is the conventional Recamán rendering that makes the "looping back" nature obvious.

**Colour coding**

| Arc type | Suggested colour |
|---|---|
| Forward (add n) | Teal / `#2a9d8f` |
| Backward (subtract n) | Coral / `#e76f51` |

Use `fill: none` and `stroke-opacity: 0.7` so overlapping arcs remain legible.

**Visited integers**

Render `visited_set` as small dots (r ≈ 3px) on the number line in a distinct colour (e.g. gold `#e9c46a`). Unvisited integers in `[0, max_value]` can optionally be shown as lighter dots to make gaps visually obvious. For term counts > 200 this becomes dense; consider toggling it with a checkbox.

**Controls**

A single range slider:

```
Terms: [slider 10 – 200, default 50]  →  current value label
```

On slider change: call `fetch('/api/recaman?terms=N')`, then re-render. Debounce the fetch by ~150 ms to avoid flooding the backend while dragging.

**Complexity flag (plain HTML + D3)**

The arc diagram is well within what plain D3 can handle. No flags needed for this visualization.

---

## 4. Additional Visualization Ideas

### 4a. Animated Arc Reveal

Animate arcs appearing one at a time in sequence order (using `step` from the arc objects). Use a D3 transition with `stroke-dasharray` / `stroke-dashoffset` to "draw" each arc as a growing stroke.

Implementation sketch:

```js
path.attr("stroke-dasharray", function() { return this.getTotalLength(); })
    .attr("stroke-dashoffset", function() { return this.getTotalLength(); })
    .transition()
    .delay(d => d.step * 120)   // 120 ms per step
    .duration(100)
    .attr("stroke-dashoffset", 0);
```

Add Play / Pause buttons. This is a crowd-pleasing feature for demos and straightforward with D3 transitions — recommended to implement.

### 4b. Musical Sonification (Web Audio API)

Map each term in `sequence` to a musical pitch and play them in order when the user clicks a "Play Audio" button.

**Mapping strategy:**

1. Take the sequence values modulo 24 (two octaves of chromatic scale) to get a pitch class.
2. Map to frequencies using equal temperament: `f = 261.63 * 2^(semitone/12)` (middle C as the root).
3. Use the Web Audio API `OscillatorNode` with type `"sine"` or `"triangle"`. Schedule each note with `oscillator.start(ctx.currentTime + step * noteDuration)`.

This requires no external library — pure Web Audio API. The implementation is self-contained in `recaman.js`.

Simple example:

```js
function playSequence(sequence, bpm = 120) {
    const ctx = new AudioContext();
    const noteDuration = 60 / bpm;
    sequence.forEach((val, i) => {
        const semitone = val % 24;
        const freq = 261.63 * Math.pow(2, semitone / 12);
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.connect(ctx.destination);
        osc.start(ctx.currentTime + i * noteDuration);
        osc.stop(ctx.currentTime + i * noteDuration + noteDuration * 0.9);
    });
}
```

Add a BPM slider (range 60–240, default 120) alongside the terms slider.

### 4c. Visited vs Unvisited Integer Highlighting

Show an interactive tooltip or panel listing the first integer (if any) in `[0, max_value]` that has NOT yet been visited. This directly surfaces the open conjecture: "Does every positive integer eventually appear?" As the user increases `terms`, they can watch the gaps fill in — or persist.

---

## 5. MCP Suggestions

- **Fetch / Browser MCP**: Useful for pulling the live OEIS page for A005132 (`https://oeis.org/A005132`) to grab known terms for validation, or the b-file (first 10 000 values) to cross-check the backend implementation during development.
- **Sequential Thinking MCP**: The Recamán algorithm is simple enough that this is not needed here, but could help if debugging subtle off-by-one errors in the arc direction logic.

---

## 6. Additional Packages Needed

None beyond the base set. The algorithm uses only Python built-ins (a `list` and a `set`). FastAPI and Pydantic (already a FastAPI dependency) are sufficient for the router and response model.

**Python packages required:** `fastapi`, `uvicorn[standard]` — same as the rest of the project.

**JS packages required:** `d3` (CDN, already loaded globally). Web Audio API is native to all modern browsers.

No changes to `infra_plans.md` are needed for this visualization.

---

## 7. Open Questions — Resolve Before Implementing

1. **Arc overlap handling.** When many arcs share the same `from` or `to` endpoint they visually collide. Two options: (a) accept the overlap with transparency (simplest, workable for ≤ 100 terms), or (b) vary the arc height slightly based on step index so nested arcs are distinguishable. Which is preferred? Recommendation: start with (a) and treat (b) as a polish step.

2. **Terms upper limit.** The plan caps `terms` at 5 000 on the backend. The slider is proposed to cap at 200 for the initial UI (beyond that the arc diagram becomes unreadably dense). Should there be a separate "high-density mode" (e.g. a separate input for power users who want to generate raw data without the diagram), or is 200 the hard UI cap?

3. **Audio and animation interplay.** If the user starts the animated arc reveal AND clicks "Play Audio" simultaneously, the UX could become confusing. Should these two features be mutually exclusive (playing audio auto-starts animation; starting animation disables audio button), or are they independent?

4. **Number line lower bound.** The sequence always starts at 0 and all known values are non-negative, so the domain is `[0, max_value]`. Confirm that the backend guarantee `a(n) >= 0` for all n holds (it does by construction — the `candidate > 0` guard ensures this), so no negative-axis padding is needed.

5. **Visited-set rendering threshold.** For large term counts, rendering a dot for every visited integer may clutter the diagram. Suggested threshold: show visited dots only when `terms <= 150`. Should this be a user-controlled toggle instead?
