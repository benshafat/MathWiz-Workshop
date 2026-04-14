import cache
import numpy as np
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api", tags=["ulam-spiral"])

ULAM_CAP = 250_000
MAX_HALF = 249


def prime_sieve(limit: int) -> np.ndarray:
    sieve = np.ones(limit + 1, dtype=bool)
    sieve[0:2] = False
    for i in range(2, int(limit**0.5) + 1):
        if sieve[i]:
            sieve[i * i :: i] = False
    return sieve


def compute_spiral(size: int) -> dict:
    size = max(1, min(size, MAX_HALF))
    max_value = (2 * size + 1) ** 2
    sieve = prime_sieve(max_value)

    points = []
    x, y = 0, 0
    dx, dy = 1, 0
    seg_len, seg_steps, turns = 1, 0, 0

    for val in range(1, max_value + 1):
        points.append({"x": x, "y": y, "value": val, "is_prime": bool(sieve[val])})
        x += dx
        y += dy
        seg_steps += 1
        if seg_steps == seg_len:
            seg_steps = 0
            dx, dy = -dy, dx  # rotate 90° clockwise
            turns += 1
            if turns % 2 == 0:
                seg_len += 1

    return {"size": size, "total_points": len(points), "points": points}


@router.get("/ulam-spiral")
def ulam_spiral(size: int = Query(default=10, ge=1, le=MAX_HALF)):
    size = max(1, min(size, MAX_HALF))
    key = f"ulam:{size}"
    data = cache.get(key)
    if data is not None:
        return data

    data = compute_spiral(size)
    cache.set(key, data)
    return data
