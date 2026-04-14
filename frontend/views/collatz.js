window.Views = window.Views || {};

window.Views.collatz = (function () {
  // Module-level state reset on each mount
  let currentData = null;
  let currentMode = 'plant';
  let evenAngle = 10;
  let oddAngle = 25;
  let vizContainer = null; // the sub-div where the SVG/canvas lives

  // ─── Turtle geometry ───────────────────────────────────────────────────
  function turtlePoints(steps, eAngle, oAngle) {
    const DEG = Math.PI / 180;
    let x = 0, y = 0, angle = -Math.PI / 2;
    const pts = [[x, y]];
    const types = ['start'];
    for (const step of steps) {
      angle += (step.type === 'even' ? -eAngle : oAngle) * DEG;
      x += Math.cos(angle) * 8;
      y += Math.sin(angle) * 8;
      pts.push([x, y]);
      types.push(step.type);
    }
    return { pts, types };
  }

  // ─── Forward mode (force graph) ────────────────────────────────────────
  function renderForward(data, container) {
    container.innerHTML = '';

    const paths = data.paths || [];
    const nodeMap = new Map();
    const links = [];

    for (const path of paths) {
      const steps = path.steps || [];
      for (let i = 0; i < steps.length - 1; i++) {
        const a = steps[i].value, b = steps[i + 1].value;
        if (!nodeMap.has(a)) nodeMap.set(a, { id: a, value: a, count: 0 });
        if (!nodeMap.has(b)) nodeMap.set(b, { id: b, value: b, count: 0 });
        nodeMap.get(a).count++;
        links.push({ source: a, target: b });
      }
    }

    // Mark start nodes (first step of each path) and convergence nodes
    const startIds = new Set(paths.map(p => p.steps && p.steps[0] ? p.steps[0].value : null));
    for (const path of paths) {
      const steps = path.steps || [];
      for (const step of steps) {
        const node = nodeMap.get(step.value);
        if (node && step.convergence) node.isConvergence = true;
      }
    }

    const nodes = Array.from(nodeMap.values());
    const W = container.clientWidth || 900;
    const H = Math.max(500, window.innerHeight - 200);

    const svg = d3.select(container).append('svg')
      .attr('width', W).attr('height', H)
      .style('background', '#0f172a');

    const g = svg.append('g');

    svg.call(d3.zoom().scaleExtent([0.3, 5]).on('zoom', e => g.attr('transform', e.transform)));

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(40))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collide', d3.forceCollide(18));

    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#475569')
      .attr('stroke-width', 1.2)
      .attr('marker-end', 'url(#arrow)');

    // Arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 18).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', '#64748b');

    function nodeColor(d) {
      if (d.value === 1) return '#ef4444';      // terminal - red
      if (d.isConvergence) return '#a855f7';    // convergence - purple
      if (startIds.has(d.value)) return '#f97316'; // start - orange
      return '#3b82f6';                          // normal - steel blue
    }
    function nodeRadius(d) {
      if (d.value === 1) return 14;
      if (d.isConvergence) return 12;
      return 8;
    }

    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    node.append('circle')
      .attr('r', d => nodeRadius(d))
      .attr('fill', d => nodeColor(d))
      .attr('stroke', '#1e293b')
      .attr('stroke-width', 1.5);

    node.append('text')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('fill', '#f8fafc').attr('font-size', 9)
      .text(d => d.value <= 999 ? d.value : '');

    // Tooltip
    const tip = _ensureTooltip('cz-tip');
    node.on('mousemove', (e, d) => {
      tip.innerHTML = `<strong>${d.value}</strong>${d.isConvergence ? '<br>convergence node' : ''}${d.value === 1 ? '<br>terminal' : ''}`;
      tip.style.display = 'block';
      tip.style.left = (e.clientX + 12) + 'px';
      tip.style.top  = (e.clientY - 8) + 'px';
    }).on('mouseleave', () => { tip.style.display = 'none'; });

    sim.on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
  }

  // ─── Plant mode (turtle graphics) ──────────────────────────────────────
  function renderPlant(data, container) {
    container.innerHTML = '';

    const path = (data.paths && data.paths[0]) || data;
    const steps = path.steps || [];
    if (!steps.length) {
      container.innerHTML = '<p style="color:#64748b;padding:20px">No steps returned.</p>';
      return;
    }

    const { pts, types } = turtlePoints(steps, evenAngle, oddAngle);

    // Bounding box → scale + center
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const W = container.clientWidth || 900;
    const H = Math.max(500, window.innerHeight - 200);
    const margin = 30;
    const scaleX = (W - margin * 2) / (maxX - minX || 1);
    const scaleY = (H - margin * 2) / (maxY - minY || 1);
    const sc = Math.min(scaleX, scaleY, 3);

    // Map pts to SVG coords, starting from bottom-center
    const treeW = (maxX - minX) * sc;
    const treeH = (maxY - minY) * sc;
    const offsetX = (W - treeW) / 2 - minX * sc;
    const offsetY = (H - treeH) / 2 - minY * sc;

    const mapped = pts.map(([x, y]) => [x * sc + offsetX, y * sc + offsetY]);

    const svg = d3.select(container).append('svg')
      .attr('width', W).attr('height', H)
      .style('background', '#0f172a');

    // Draw segments coloured by step type
    for (let i = 0; i < mapped.length - 1; i++) {
      svg.append('line')
        .attr('x1', mapped[i][0]).attr('y1', mapped[i][1])
        .attr('x2', mapped[i + 1][0]).attr('y2', mapped[i + 1][1])
        .attr('stroke', types[i + 1] === 'even' ? '#2dd4bf' : '#f87171')
        .attr('stroke-width', 1.5)
        .attr('stroke-linecap', 'round');
    }

    // Start dot
    svg.append('circle')
      .attr('cx', mapped[0][0]).attr('cy', mapped[0][1])
      .attr('r', 5).attr('fill', '#f97316');

    // Legend
    const leg = svg.append('g').attr('transform', `translate(${W - 160}, 16)`);
    leg.append('line').attr('x1', 0).attr('y1', 8).attr('x2', 24).attr('y2', 8)
      .attr('stroke', '#2dd4bf').attr('stroke-width', 2);
    leg.append('text').attr('x', 30).attr('y', 12)
      .attr('fill', '#94a3b8').attr('font-size', 12).text('even step');
    leg.append('line').attr('x1', 0).attr('y1', 28).attr('x2', 24).attr('y2', 28)
      .attr('stroke', '#f87171').attr('stroke-width', 2);
    leg.append('text').attr('x', 30).attr('y', 32)
      .attr('fill', '#94a3b8').attr('font-size', 12).text('odd step');
  }

  // ─── Reverse Tree mode ─────────────────────────────────────────────────
  function renderReverseTree(data, container) {
    container.innerHTML = '';

    const treeData = data.tree;
    if (!treeData) {
      container.innerHTML = '<p style="color:#64748b;padding:20px">No tree data returned.</p>';
      return;
    }

    const W = container.clientWidth || 900;
    const H = Math.max(560, window.innerHeight - 180);
    const margin = { top: 30, right: 20, bottom: 20, left: 20 };

    const svg = d3.select(container).append('svg')
      .attr('width', W).attr('height', H)
      .style('background', '#0f172a');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    svg.call(d3.zoom().scaleExtent([0.2, 4]).on('zoom', e => g.attr('transform', e.transform)));

    const root = d3.hierarchy(treeData);
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;
    d3.tree().size([innerW, innerH])(root);

    // Links
    g.selectAll('.rt-link')
      .data(root.links())
      .join('path')
      .attr('class', 'rt-link')
      .attr('fill', 'none')
      .attr('stroke', '#334155')
      .attr('stroke-width', 1.5)
      .attr('d', d3.linkVertical().x(d => d.x).y(d => d.y));

    // Nodes
    const node = g.selectAll('.rt-node')
      .data(root.descendants())
      .join('g')
      .attr('class', 'rt-node')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    node.append('circle')
      .attr('r', 12)
      .attr('fill', d => d.depth === 0 ? '#f97316' : '#334155')
      .attr('stroke', '#1e293b').attr('stroke-width', 1.5);

    node.append('text')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('fill', '#f8fafc').attr('font-size', 10)
      .text(d => d.data.value !== undefined ? d.data.value : '');

    // Hover tooltip
    const tip = _ensureTooltip('cz-tip');
    node.on('mousemove', (e, d) => {
      tip.innerHTML = `<strong>${d.data.value}</strong>`;
      tip.style.display = 'block';
      tip.style.left = (e.clientX + 12) + 'px';
      tip.style.top  = (e.clientY - 8) + 'px';
    }).on('mouseleave', () => { tip.style.display = 'none'; });
  }

  // ─── Shared tooltip helper ─────────────────────────────────────────────
  function _ensureTooltip(id) {
    let tip = document.getElementById(id);
    if (!tip) {
      tip = document.createElement('div');
      tip.id = id;
      Object.assign(tip.style, {
        position: 'fixed', background: '#1e293b', color: '#f8fafc',
        border: '1px solid #475569', padding: '8px 12px', borderRadius: '6px',
        fontSize: '13px', pointerEvents: 'none', display: 'none', zIndex: 9999
      });
      document.body.appendChild(tip);
    }
    return tip;
  }

  // ─── Public API ────────────────────────────────────────────────────────
  return {
    async mount(container) {
      currentData = null;
      currentMode = 'plant';
      evenAngle = 10;
      oddAngle = 25;

      // ── Controls ──
      const controls = document.createElement('div');
      controls.className = 'controls';
      controls.innerHTML = `
        <label>n <input type="number" id="cz-n" value="27" min="2" max="99999" style="width:80px"></label>
        <label>k <input type="number" id="cz-k" value="1"  min="1" max="20"    style="width:50px"></label>
        <label>Mode
          <select id="cz-mode">
            <option value="plant" selected>Plant</option>
            <option value="forward">Forward</option>
            <option value="reverse">Reverse Tree</option>
          </select>
        </label>
        <label id="cz-even-wrap">
          Even angle <span id="cz-even-val">10</span>°
          <input type="range" id="cz-even" min="1" max="90" value="10">
        </label>
        <label id="cz-odd-wrap">
          Odd angle <span id="cz-odd-val">25</span>°
          <input type="range" id="cz-odd" min="1" max="90" value="25">
        </label>
        <button id="cz-fetch">Fetch</button>
        <span id="cz-err" style="color:#f87171;display:none"></span>
      `;
      container.appendChild(controls);

      vizContainer = document.createElement('div');
      container.appendChild(vizContainer);

      const nInput    = controls.querySelector('#cz-n');
      const kInput    = controls.querySelector('#cz-k');
      const modeSelect= controls.querySelector('#cz-mode');
      const evenSlider= controls.querySelector('#cz-even');
      const oddSlider = controls.querySelector('#cz-odd');
      const evenVal   = controls.querySelector('#cz-even-val');
      const oddVal    = controls.querySelector('#cz-odd-val');
      const evenWrap  = controls.querySelector('#cz-even-wrap');
      const oddWrap   = controls.querySelector('#cz-odd-wrap');
      const fetchBtn  = controls.querySelector('#cz-fetch');
      const errSpan   = controls.querySelector('#cz-err');

      function updateAngleVisibility() {
        const show = modeSelect.value === 'plant';
        evenWrap.style.display = show ? '' : 'none';
        oddWrap.style.display  = show ? '' : 'none';
      }
      updateAngleVisibility();

      modeSelect.addEventListener('change', () => {
        currentMode = modeSelect.value;
        updateAngleVisibility();
        if (currentData) window.Views.collatz.render(currentData, vizContainer);
      });

      evenSlider.addEventListener('input', () => {
        evenAngle = +evenSlider.value;
        evenVal.textContent = evenAngle;
        if (currentData && currentMode === 'plant') renderPlant(currentData, vizContainer);
      });

      oddSlider.addEventListener('input', () => {
        oddAngle = +oddSlider.value;
        oddVal.textContent = oddAngle;
        if (currentData && currentMode === 'plant') renderPlant(currentData, vizContainer);
      });

      async function doFetch() {
        errSpan.style.display = 'none';
        const n = parseInt(nInput.value, 10);
        const k = parseInt(kInput.value, 10);
        const mode = modeSelect.value;
        try {
          currentData = await window.API.fetchCollatz(n, { k, mode, depth: 20 });
          currentMode = mode;
          window.Views.collatz.render(currentData, vizContainer);
        } catch (err) {
          errSpan.textContent = err.message || String(err);
          errSpan.style.display = '';
        }
      }

      fetchBtn.addEventListener('click', doFetch);
      await doFetch();
    },

    render(data, container) {
      const target = container === vizContainer ? vizContainer : container;
      if (currentMode === 'forward') {
        renderForward(data, target);
      } else if (currentMode === 'reverse') {
        renderReverseTree(data, target);
      } else {
        renderPlant(data, target);
      }
    }
  };
})();
