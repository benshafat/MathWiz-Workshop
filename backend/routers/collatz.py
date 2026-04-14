import cache
from fastapi import APIRouter, HTTPException, Query
from typing import Literal

router = APIRouter(prefix="/api", tags=["collatz"])


def collatz_sequence(n: int) -> list[dict]:
    """Return the list of steps from n down to 1 (exclusive)."""
    steps = []
    while n != 1:
        if n % 2 == 0:
            steps.append({"from": n, "to": n // 2, "type": "even"})
            n //= 2
        else:
            steps.append({"from": n, "to": 3 * n + 1, "type": "odd"})
            n = 3 * n + 1
    return steps


def _sequence_values(n: int) -> list[int]:
    """Return full value list including start and 1."""
    vals = [n]
    while n != 1:
        n = n // 2 if n % 2 == 0 else 3 * n + 1
        vals.append(n)
    return vals


def _build_reverse_tree(root: int, depth: int) -> dict:
    """Recursively build the reverse Collatz tree."""
    if depth == 0:
        return {"value": root, "children": []}

    children = []

    # Every node n always has child 2n
    children.append(_build_reverse_tree(2 * root, depth - 1))

    # Odd parent: (root - 1) / 3 if conditions are met
    candidate = (root - 1) // 3
    if (
        root > 1
        and (root - 1) % 3 == 0
        and candidate > 0
        and candidate % 2 == 1
    ):
        children.append(_build_reverse_tree(candidate, depth - 1))

    return {"value": root, "children": children}


def _compute_forward(n: int, k: int) -> dict:
    paths = []
    value_to_starts: dict[int, list[int]] = {}

    for start in range(n, n + k):
        steps = collatz_sequence(start)
        seq = _sequence_values(start)
        paths.append({
            "start": start,
            "sequence": seq,
            "steps": steps,
            "length": len(steps),
        })
        for val in seq:
            value_to_starts.setdefault(val, []).append(start)

    convergence_nodes = [
        {"value": val, "paths_meeting": sorted(starts)}
        for val, starts in value_to_starts.items()
        if len(starts) >= 2
    ]
    convergence_nodes.sort(key=lambda c: c["value"])

    return {"mode": "forward", "paths": paths, "convergence_nodes": convergence_nodes}


def _compute_reverse(depth: int) -> dict:
    tree = _build_reverse_tree(1, depth)
    return {"mode": "reverse", "depth": depth, "root": 1, "tree": tree}


@router.get("/collatz/{n}")
def collatz(
    n: int,
    k: int = Query(default=1, ge=1, le=20),
    mode: Literal["forward", "reverse"] = Query(default="forward"),
    depth: int = Query(default=20, ge=1, le=20),
):
    if n < 1:
        raise HTTPException(status_code=422, detail="n must be >= 1")

    k = max(1, min(k, 20))
    depth = max(1, min(depth, 20))

    key = f"collatz:{n}:{k}:{mode}:{depth}"
    data = cache.get(key)
    if data is not None:
        return data

    if mode == "forward":
        data = _compute_forward(n, k)
    else:
        data = _compute_reverse(depth)

    cache.set(key, data)
    return data
