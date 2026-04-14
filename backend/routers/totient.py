import cache
import numpy as np
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api", tags=["totient"])


def totient_sieve(n: int) -> np.ndarray:
    phi = np.arange(n + 1, dtype=np.int64)
    for p in range(2, n + 1):
        if phi[p] == p:  # p is prime (untouched)
            phi[p::p] -= phi[p::p] // p
    return phi


@router.get("/totient")
def totient(limit: int = Query(default=10000, ge=1, le=100000)):
    key = f"totient:{limit}"
    data = cache.get(key)
    if data is not None:
        return data

    phi = totient_sieve(limit)
    data = [{"n": i, "phi": int(phi[i])} for i in range(1, limit + 1)]
    cache.set(key, data)
    return data
