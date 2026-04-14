import cache
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api", tags=["modular-web"])


@router.get("/modular-web")
def modular_web(
    n: int = Query(default=200, ge=2, le=500),
    m: int = Query(default=2),
):
    if m < 0 or m > n - 1:
        raise HTTPException(status_code=422, detail="m must be between 0 and n-1")

    key = f"modular:{n}:{m}"
    data = cache.get(key)
    if data is not None:
        return data

    lines = [
        {"from": k, "to": (k * m) % n}
        for k in range(n)
        if k != (k * m) % n
    ]

    data = {"n": n, "m": m, "lines": lines}
    cache.set(key, data)
    return data
