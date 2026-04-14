import cache
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api", tags=["recaman"])


def compute_recaman(terms: int) -> dict:
    sequence = [0] * terms
    seen = {0}

    for n in range(1, terms):
        prev = sequence[n - 1]
        candidate = prev - n
        if candidate > 0 and candidate not in seen:
            sequence[n] = candidate
        else:
            sequence[n] = prev + n
        seen.add(sequence[n])

    arcs = []
    for n in range(1, terms):
        prev = sequence[n - 1]
        curr = sequence[n]
        if curr < prev:
            direction = "backward"
        else:
            direction = "forward"
        arcs.append({"from": prev, "to": curr, "direction": direction, "step": n})

    return {
        "sequence": sequence,
        "arcs": arcs,
        "max_value": max(sequence),
        "terms": terms,
    }


@router.get("/recaman")
def recaman(terms: int = Query(default=100, ge=5, le=5000)):
    key = f"recaman:{terms}"
    data = cache.get(key)
    if data is not None:
        return data

    data = compute_recaman(terms)
    cache.set(key, data)
    return data
