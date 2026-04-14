# Modular Arithmetic Webs (Multiplication Tables mod n) — Implementation Plan

Depends on: [infra.md](infra.md), [visualize.md](visualize.md)

## Overview

Place points 0 through n−1 equally spaced on a circle. For a chosen multiplier m, draw a chord from each point k to (k × m) mod n. As m and n change via sliders, the web morphs between simple polygons, star patterns, cardioids, nephroids, and other epicycloid curves. The famous cardioid emerges at m=2, n≈200.

## Backend

### Endpoints

```
GET /api/modular-webs?n=200&m=2
```

### Response Shape

```json
{
  "data": {
    "n": 200,
    "m": 2,
    "chords": [
      [0, 0],
      [1, 2],
      [2, 4],
      ...
      [100, 0],
      ...
      [199, 198]
    ],
    "info": {
      "gcd_m_n": 2,
      "order_of_m": 100,
      "curve_type": "cardioid"
    }
  }
}
```

`chords[i]` = `[i, (i * m) % n]`. The `info` block provides mathematical context.

**Note:** The computation is trivial (n multiplications + modulos). This could be done entirely client-side. The backend endpoint exists for consistency with the shared architecture, but the frontend may bypass it for instant slider response.

### Service Logic (`services/modular_webs.py`)

```python
from math import gcd

def modular_web(n: int, m: int) -> dict:
    chords = [[k, (k * m) % n] for k in range(n)]
    g = gcd(m - 1, n) if m > 1 else n
    # Curve classification heuristic
    curve_type = classify_curve(m, n)
    return {
        "n": n, "m": m,
        "chords": chords,
        "info": {
            "gcd_m_n": gcd(m, n),
            "order_of_m": multiplicative_order(m, n),
            "curve_type": curve_type
        }
    }

def classify_curve(m: int, n: int) -> str:
    """Heuristic: m=2 → cardioid, m=3 → nephroid, etc."""
    if n < 10:
        return "polygon"
    if m == 2:
        return "cardioid"
    if m == 3:
        return "nephroid"
    if gcd(m, n) == n:
        return "point"
    return "epicycloid"
```

### Input Validation

- `n`: 3–2000.
- `m`: 1–n.

## Frontend (`tools/ModularWebs.tsx`)

### Parameters

| Param | Control | Default | Range |
|-------|---------|---------|-------|
| `n` | Slider | 200 | 10 – 1000 |
| `m` | Slider | 2 | 1 – n |
| Line opacity | Slider | 0.3 | 0.05 – 1.0 |
| Color mode | Dropdown | Monochrome | monochrome, rainbow (by source), gradient (by distance) |
| Animate m | Toggle + speed | off | — |

### Visualization

- **SVG with D3.**
- Draw a circle with n small dots equally spaced.
- For each k, draw a line (chord) from point k to point (k·m) mod n.
- Lines are semi-transparent (opacity 0.3 default) so overlapping chords create the envelope curve through density.

### Coordinate Math (Client-Side)

```typescript
function pointOnCircle(index: number, n: number, radius: number): [number, number] {
  const angle = (2 * Math.PI * index) / n - Math.PI / 2; // start at top
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}
```

Since computation is trivial, **compute chords client-side** and only call the API for the `info` block (or compute that client-side too for zero-latency slider response).

### Interaction

- **Slider drag:** Recompute and redraw instantly (no API call). D3 transitions smoothly morph chord positions as m or n changes.
- **Hover over a chord:** Highlight it and show "k → k·m mod n = result".
- **Hover over a point:** Highlight all chords connected to that point.
- **Info panel:** Shows curve classification, gcd(m,n), and multiplicative order.

### Animate m

When toggled, m increments by 1 on a timer (configurable speed). The web morphs continuously, cycling through all multipliers. This is visually mesmerizing — the patterns evolve fluidly.

- Use D3 transitions with short duration (100–300 ms) so chords slide rather than jump.
- Display current m prominently.

### Color Modes

- **Monochrome:** All chords are white (or a single accent color) on dark background. Classic look.
- **Rainbow:** Each chord colored by its source index k (HSL hue = k/n × 360).
- **Gradient:** Color by chord length (short = cool, long = warm), emphasizing the envelope structure.

## Implementation Steps

1. Implement `services/modular_webs.py` with classification logic. Test known cases.
2. Create `routers/modular_webs.py`.
3. Build `tools/ModularWebs.tsx` — static SVG rendering with points + chords.
4. Add client-side computation for instant slider response.
5. Add smooth D3 transitions on param change.
6. Add m-animation mode.
7. Add color modes and line opacity control.
8. Add hover interactivity.

## Open Questions

1. **Fractional m?** Mathematically m must be an integer for modular arithmetic, but interpolating between integer values of m during animation could create smooth morphing. We'd need to define what "fractional m" means visually — perhaps linearly interpolate chord endpoints? This is purely aesthetic, not mathematically meaningful.
2. **Multiple multipliers?** Overlay two webs (m₁ and m₂) with different colors to compare patterns. Adds visual complexity but could be insightful.
3. **SVG vs Canvas:** At n=1000, we draw 1000 lines. SVG handles this fine. At n=2000, consider switching to canvas for smoother animation. Where's the cutoff?
4. **Number labels:** Should we show numeric labels on the circle points? Useful at small n, cluttered at large n. Auto-hide above a threshold?
