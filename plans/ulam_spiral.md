# Ulam Spiral — Implementation Plan

Depends on: [infra.md](infra.md), [visualize.md](visualize.md)

## Overview

Place consecutive integers on a 2D grid in a clockwise spiral starting from a center value. Highlight primes — diagonal patterns emerge that are not fully explained by number theory. Support zooming, panning, and overlay of other sequences.

## Backend

### Endpoints

```
GET /api/ulam?size=201&center=1
GET /api/ulam?size=201&center=1&overlay=twin_primes
```

- `size`: side length of the square grid (odd integer; centered spiral).
- `center`: the starting value at the center (default 1).
- `overlay`: optional, one of `primes` (default), `twin_primes`, `sophie_germain`, `fibonacci`.

### Response Shape

```json
{
  "data": {
    "size": 201,
    "center": 1,
    "highlighted": [2, 3, 5, 7, 11, ...],
    "grid_bounds": { "min": -100, "max": 100 }
  }
}
```

Return only the list of highlighted positions (not the full grid) to keep payload small. The frontend computes (x, y) from the sequence index using the spiral formula.

**Alternative for large grids:** Return a binary bitmap (base64-encoded) so the frontend can blit it directly onto a canvas. This avoids JSON overhead for size > 1000.

### Service Logic (`services/ulam.py`)

```python
def spiral_coords(index: int) -> tuple[int, int]:
    """Map linear index (0-based) to (x, y) offset from center."""
    # Closed-form or iterative spiral walk

def generate_primes(limit: int) -> set[int]:
    """Sieve of Eratosthenes up to limit."""

def ulam_highlighted(size: int, center: int, overlay: str) -> list[int]:
    """Return indices of highlighted cells."""
```

- **Sieve of Eratosthenes** for prime generation. For `size=2001` (4M cells), the sieve runs in ~50 ms.
- Cache the sieve result in SQLite keyed by max value, so repeated requests with the same or smaller range are instant.

### Input Validation

- `size` must be odd, 3 ≤ size ≤ 4001 (16M cells max — beyond this, send bitmap).
- `center` must be a positive integer.

## Frontend (`tools/UlamSpiral.tsx`)

### Parameters

| Param | Control | Default | Range |
|-------|---------|---------|-------|
| `size` | Slider | 201 | 51 – 2001 |
| `center` | Numeric input | 1 | 1 – 1,000,000 |
| Overlay | Dropdown | Primes | primes, twin_primes, sophie_germain |
| Color scheme | Dropdown | White-on-black | several palettes |

### Visualization

- **Canvas rendering.** Each cell is 1–4 pixels depending on zoom.
- Highlighted cells are drawn in the accent color; background cells are dark.
- **Pan & zoom:** `wheel` to zoom, click-drag to pan. Zoom recalculates visible region and re-renders only visible cells.
- On zoom-in past a threshold, show the actual integer value inside each cell.

### Interaction

- **Hover:** Show the number at the cursor position and whether it's prime.
- **Click:** Select a number → show its factorization in a side tooltip (reuse prime tree service).

## Implementation Steps

1. Implement sieve and spiral coordinate math in `services/ulam.py` with tests.
2. Create `routers/ulam.py`.
3. Build `tools/UlamSpiral.tsx` with static canvas render.
4. Add pan & zoom.
5. Add overlay selector and color schemes.
6. Optimize: bitmap response for large grids, offscreen canvas, Web Workers for pixel mapping.

## Open Questions

1. **Client-side vs server-side prime computation?** For moderate sizes (≤ ~500K) a JS sieve is fast enough and avoids a round-trip. We could compute primes client-side and only use the backend for overlay sequences or very large ranges. This would make zoom/pan feel instant.
2. **WebGL?** For grids > 2000×2000, a fragment shader could render millions of cells at 60fps. Worth the complexity?
3. **Diagonal line overlay?** Should we draw faint diagonal guide lines to help the user see the alignment patterns, or let them discover it naturally?
