# Syracuse / Stopping Time Heatmap — Implementation Plan

Depends on: [infra.md](infra.md), [visualize.md](visualize.md)

## Overview

For each integer in a 2D grid, compute the Collatz stopping time (number of steps to reach 1) and map it to a color. The result is a fractal-like heatmap with striking banded structure. This is a great exercise in caching, since computing stopping times for large ranges benefits heavily from memoization.

## Backend

### Endpoints

```
GET /api/syracuse/heatmap?width=500&height=500&start=1
GET /api/syracuse/stopping-time?n=27
```

- `width × height` defines the grid dimensions. Numbers are laid out row-by-row: cell (r, c) = start + r*width + c.
- Single-number endpoint for tooltip/detail use.

### Response Shape

**Heatmap (binary for performance):**
```json
{
  "data": {
    "width": 500,
    "height": 500,
    "start": 1,
    "max_steps": 350,
    "stopping_times": "<base64-encoded uint16 array>"
  }
}
```

Using uint16 (max 65535 steps) encoded as base64 keeps the payload compact (~500 KB for 500×500 vs ~5 MB as JSON array).

**Single number:**
```json
{
  "data": {
    "n": 27,
    "stopping_time": 111,
    "trajectory": [27, 82, 41, 124, 62, 31, ...]
  }
}
```

### Service Logic (`services/syracuse.py`)

```python
def collatz_stopping_time(n: int, cache: dict[int, int] | None = None) -> int:
    """Count steps until n reaches 1. Uses and populates cache."""
    steps = 0
    original = n
    visited = []
    while n != 1:
        if cache and n in cache:
            steps += cache[n]
            break
        visited.append(n)
        n = n // 2 if n % 2 == 0 else 3 * n + 1
        steps += 1
    # Backfill cache
    if cache is not None:
        for i, v in enumerate(visited):
            cache[v] = steps - i
    return steps

def heatmap_grid(width: int, height: int, start: int) -> list[int]:
    """Compute stopping times for start..start+width*height-1."""
    cache = {}
    # Load existing cache from SQLite
    # Compute, populate cache
    # Persist new entries to SQLite
    return [collatz_stopping_time(start + i, cache) for i in range(width * height)]
```

### SQLite Caching

Stopping times are deterministic, so cache aggressively:

```sql
CREATE TABLE IF NOT EXISTS collatz_cache (
    n           INTEGER PRIMARY KEY,
    stop_time   INTEGER NOT NULL
);
```

On request, load all cached values in `[start, start + w*h)`, compute missing ones, and batch-insert new results. This makes repeated/overlapping range queries near-instant.

### Input Validation

- `width`, `height`: 1–1000 each (max 1M cells per request).
- `start` ≥ 1.

## Frontend (`tools/SyracuseHeatmap.tsx`)

### Parameters

| Param | Control | Default | Range |
|-------|---------|---------|-------|
| `width` | Slider | 500 | 100 – 1000 |
| `height` | Slider | 500 | 100 – 1000 |
| `start` | Numeric input | 1 | 1 – 10,000,000 |
| Color map | Dropdown | Viridis | viridis, inferno, plasma, magma |

### Visualization

- **Canvas rendering.** Decode base64 uint16 array, map each stopping time to a color using the selected palette, draw pixel-by-pixel (or scaled blocks).
- Color mapping: normalize stopping times to `[0, 1]` using `max_steps`, then index into a 256-entry color LUT.
- **Zoom & pan** on the canvas (same pattern as Ulam spiral).

### Interaction

- **Hover:** Show the number at cursor, its stopping time, and a mini trajectory sparkline.
- **Click:** Expand to show the full Collatz trajectory as an animated line chart (fetched from `/api/syracuse/stopping-time?n=...`).

### Trajectory Detail View

When a number is clicked, overlay a small line chart showing the trajectory (value vs step). Animate the path drawing for dramatic effect — Collatz trajectories can spike to huge values before crashing down.

## Implementation Steps

1. Implement `services/syracuse.py` with memoized computation + SQLite cache layer. Unit tests with known stopping times (e.g., 27 → 111).
2. Create `routers/syracuse.py` with both endpoints. Binary encoding for heatmap response.
3. Build `tools/SyracuseHeatmap.tsx` — decode binary, render to canvas with a color palette.
4. Add hover tooltip with number + stopping time.
5. Add click → trajectory detail view.
6. Add pan/zoom and color map selector.

## Open Questions

1. **Grid layout meaning:** Numbers are laid out linearly (row-major). An alternative is a 2D grid where x = n mod width, y = n / width — which is the same thing. But should we also offer a spiral layout (like Ulam) colored by stopping time? That could be a cool crossover.
2. **Performance for very large starts:** Collatz trajectories for numbers near 10^7 can briefly reach ~10^9. The memoization cache could grow huge. Should we cap cache size (LRU) or accept unbounded growth within a session?
3. **"Total stopping time" vs "stopping time":** Stopping time = steps to reach a value less than n. Total stopping time = steps to reach 1. Most heatmaps use total stopping time. Should we offer both?
4. **Should the trajectory chart be its own reusable component?** It could be useful if we later add a "Collatz explorer" tool that's trajectory-focused rather than heatmap-focused.
