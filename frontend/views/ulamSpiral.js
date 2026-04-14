window.Views = window.Views || {};

window.Views.ulamSpiral = (function () {
  // Tier sizes: half-width of spiral grid
  const TIERS = [10, 50, 150, 249];
  const CELL = 8; // pixels per cell at zoom k=1

  // Module state (reset on each mount)
  let currentPoints = [];
  let currentTierIdx = 0;
  let currentTransform = d3.zoomIdentity;
  let canvasEl = null;
  let isFetching = false;
  let highlightDiag = null; // { type: 'sum'|'diff', val: number } for clicked-prime diagonal

  function drawCanvas(ctx, points, transform, canvasW, canvasH) {
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const cx = canvasW / 2, cy = canvasH / 2;
    const k = transform.k, tx = transform.x, ty = transform.y;
    const cellSize = CELL * k;

    for (const pt of points) {
      const px = cx + pt.x * cellSize + tx;
      const py = cy + pt.y * cellSize + ty;
      if (px < -cellSize || px > canvasW + cellSize ||
          py < -cellSize || py > canvasH + cellSize) continue;

      if (highlightDiag && pt.is_prime) {
        const onSum  = (pt.x + pt.y) === highlightDiag.sumVal;
        const onDiff = (pt.x - pt.y) === highlightDiag.diffVal;
        if (onSum || onDiff) {
          ctx.fillStyle = '#facc15';
          ctx.fillRect(px - cellSize / 2, py - cellSize / 2, cellSize - 1, cellSize - 1);
          continue;
        }
      }

      ctx.fillStyle = pt.is_prime ? '#f97316' : '#1e293b';
      ctx.fillRect(px - cellSize / 2, py - cellSize / 2, cellSize - 1, cellSize - 1);
    }
  }

  // Return the spiral half-width that corresponds to a visible radius in canvas px
  function visibleRadiusToCellRadius(transform, canvasW, canvasH) {
    const k = transform.k;
    const cellSize = CELL * k;
    // How many cells fit from centre to edge?
    return Math.ceil(Math.max(canvasW, canvasH) / (2 * cellSize));
  }

  async function fetchTier(idx, container) {
    if (isFetching) return;
    isFetching = true;
    try {
      const size = TIERS[idx];
      const data = await window.API.fetchUlamSpiral(size);
      currentPoints = data.points || data; // handle {points:[]} or flat array
      currentTierIdx = idx;
      if (canvasEl) {
        const ctx = canvasEl.getContext('2d');
        drawCanvas(ctx, currentPoints, currentTransform, canvasEl.width, canvasEl.height);
      }
    } catch (err) {
      console.error('Ulam fetch error:', err);
    } finally {
      isFetching = false;
    }
  }

  // Hit-test a canvas click → find nearest prime within 1 cell
  function hitTestPrime(clickX, clickY, transform, canvasW, canvasH) {
    const cx = canvasW / 2, cy = canvasH / 2;
    const k = transform.k, tx = transform.x, ty = transform.y;
    const cellSize = CELL * k;

    let best = null, bestDist = Infinity;
    for (const pt of currentPoints) {
      if (!pt.is_prime) continue;
      const px = cx + pt.x * cellSize + tx;
      const py = cy + pt.y * cellSize + ty;
      const dist = Math.abs(px - clickX) + Math.abs(py - clickY);
      if (dist < cellSize && dist < bestDist) {
        bestDist = dist;
        best = pt;
      }
    }
    return best;
  }

  return {
    async mount(container) {
      // Reset state
      currentPoints = [];
      currentTierIdx = 0;
      currentTransform = d3.zoomIdentity;
      highlightDiag = null;
      isFetching = false;

      // Hint label
      const hint = document.createElement('div');
      hint.textContent = 'Scroll to zoom • Click a prime to highlight its diagonals • Orange = prime, Dark = composite';
      Object.assign(hint.style, {
        color: '#64748b', fontSize: '13px', marginBottom: '10px', paddingLeft: '4px'
      });
      container.appendChild(hint);

      // Canvas
      const wrapper = document.createElement('div');
      Object.assign(wrapper.style, { position: 'relative', width: '100%' });
      container.appendChild(wrapper);

      canvasEl = document.createElement('canvas');
      const W = container.clientWidth || 900;
      const H = Math.max(500, window.innerHeight - 160);
      canvasEl.width = W;
      canvasEl.height = H;
      Object.assign(canvasEl.style, { display: 'block', cursor: 'crosshair' });
      wrapper.appendChild(canvasEl);

      const ctx = canvasEl.getContext('2d');

      // D3 zoom
      const zoom = d3.zoom()
        .scaleExtent([0.2, 30])
        .on('zoom', (event) => {
          currentTransform = event.transform;
          drawCanvas(ctx, currentPoints, currentTransform, W, H);

          // Upgrade tier if we zoomed out far enough to need more data
          const visR = visibleRadiusToCellRadius(currentTransform, W, H);
          const nextIdx = currentTierIdx + 1;
          if (nextIdx < TIERS.length && visR > TIERS[currentTierIdx] && !isFetching) {
            fetchTier(nextIdx, container);
          }
        });

      d3.select(canvasEl).call(zoom);

      // Click handler for prime diagonal highlight
      canvasEl.addEventListener('click', (e) => {
        const rect = canvasEl.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const hit = hitTestPrime(mx, my, currentTransform, W, H);
        if (hit) {
          if (highlightDiag && highlightDiag.sumVal === hit.x + hit.y && highlightDiag.diffVal === hit.x - hit.y) {
            highlightDiag = null; // toggle off
          } else {
            highlightDiag = { sumVal: hit.x + hit.y, diffVal: hit.x - hit.y };
          }
        } else {
          highlightDiag = null;
        }
        drawCanvas(ctx, currentPoints, currentTransform, W, H);
      });

      // Initial data fetch (tier 0 = size 10)
      await fetchTier(0, container);

      // Initial draw (fetchTier already draws, but ensure blank canvas is shown fast)
      drawCanvas(ctx, currentPoints, currentTransform, W, H);
    },

    render(data, container) {
      currentPoints = data.points || data;
      if (canvasEl) {
        const ctx = canvasEl.getContext('2d');
        drawCanvas(ctx, currentPoints, currentTransform, canvasEl.width, canvasEl.height);
      }
    }
  };
})();
