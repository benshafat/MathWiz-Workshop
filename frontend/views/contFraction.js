window.Views = window.Views || {};

window.Views.contFraction = (function () {
  let currentData = null;
  let currentView = 'numberline'; // 'numberline' | 'sternbrocot'
  let debounceTimer = null;
  let vizContainer = null;

  // ─── Number Line view ──────────────────────────────────────────────────
  function renderNumberLine(data, container) {
    container.innerHTML = '';

    const convergents = data.convergents || [];
    const trueVal = data.true_value;

    const W = container.clientWidth || 900;
    const H = 320;
    const margin = { top: 60, right: 40, bottom: 60, left: 50 };

    const svg = d3.select(container).append('svg')
      .attr('width', W).attr('height', H)
      .style('background', '#0f172a');

    // Domain: fit all values with padding
    const allValues = [trueVal, ...convergents.map(c => c.decimal_approx)];
    const [minV, maxV] = d3.extent(allValues);
    const pad = (maxV - minV) * 0.1 || 0.1;
    const xScale = d3.scaleLinear()
      .domain([minV - pad, maxV + pad])
      .range([margin.left, W - margin.right]);

    const axisY = H - margin.bottom;

    // Axis
    const xAxis = d3.axisBottom(xScale).ticks(6);
    svg.append('g')
      .attr('transform', `translate(0, ${axisY})`)
      .call(xAxis)
      .call(g => {
        g.selectAll('text').attr('fill', '#94a3b8').attr('font-size', 11);
        g.selectAll('line,path').attr('stroke', '#475569');
      });

    // Zigzag polyline connecting convergents in order
    const zigPts = convergents.map(c => [xScale(c.decimal_approx), axisY - 28]);
    if (zigPts.length > 1) {
      svg.append('polyline')
        .attr('points', zigPts.map(p => p.join(',')).join(' '))
        .attr('fill', 'none')
        .attr('stroke', '#334155')
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', '4,3');
    }

    // True value: vertical dashed line
    svg.append('line')
      .attr('x1', xScale(trueVal)).attr('x2', xScale(trueVal))
      .attr('y1', margin.top - 10).attr('y2', axisY)
      .attr('stroke', '#f97316').attr('stroke-width', 2)
      .attr('stroke-dasharray', '6,3');

    svg.append('text')
      .attr('x', xScale(trueVal)).attr('y', margin.top - 14)
      .attr('text-anchor', 'middle').attr('fill', '#f97316')
      .attr('font-size', 12)
      .text(data.display_name || 'true value');

    // Tooltip div
    const tip = _ensureTooltip('cf-tip');

    // Convergent dots with staggered entrance
    const dots = svg.selectAll('.cf-dot')
      .data(convergents)
      .join('circle')
      .attr('class', 'cf-dot')
      .attr('cx', c => xScale(c.decimal_approx))
      .attr('cy', axisY - 28)
      .attr('r', 0)
      .attr('fill', c => c.index % 2 === 0 ? '#60a5fa' : '#f97316')
      .attr('stroke', '#1e293b').attr('stroke-width', 1.5);

    dots.transition()
      .delay((d, i) => i * 80)
      .duration(300)
      .attr('r', 6);

    // Convergent labels (index)
    svg.selectAll('.cf-label')
      .data(convergents)
      .join('text')
      .attr('class', 'cf-label')
      .attr('x', c => xScale(c.decimal_approx))
      .attr('y', axisY - 38)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748b')
      .attr('font-size', 9)
      .text(c => `h${c.index}`);

    // Hover on dots
    dots.on('mousemove', (e, c) => {
      const err = Math.abs(c.decimal_approx - trueVal);
      tip.innerHTML = [
        `<strong>${c.p}/${c.q}</strong>`,
        `≈ ${c.decimal_approx.toPrecision(8)}`,
        `error: ${err.toExponential(3)}`
      ].join('<br>');
      tip.style.display = 'block';
      tip.style.left = (e.clientX + 12) + 'px';
      tip.style.top  = (e.clientY - 8) + 'px';
    }).on('mouseleave', () => { tip.style.display = 'none'; });

    // Coefficients display
    const coeffStr = '[' + (data.coefficients || []).join('; ') + ']';
    svg.append('text')
      .attr('x', W / 2).attr('y', margin.top - 30)
      .attr('text-anchor', 'middle').attr('fill', '#64748b')
      .attr('font-size', 12)
      .text(`Continued fraction: ${coeffStr}`);
  }

  // ─── Stern-Brocot path view ────────────────────────────────────────────
  function renderSternBrocot(data, container) {
    container.innerHTML = '';

    // Build L/R path from convergents by comparing each convergent to true value
    // At each step the mediant of two boundary fractions is compared to trueVal
    const trueVal = data.true_value;
    const convergents = data.convergents || [];
    if (!convergents.length) {
      container.innerHTML = '<p style="color:#64748b;padding:20px">No convergents to display.</p>';
      return;
    }

    // Reconstruct Stern-Brocot path: start with (0/1, 1/0), repeatedly bisect
    // We compare each mediant to trueVal and build a path node list
    const depth = Math.min(convergents.length, 20);
    const pathNodes = []; // { label, p, q, dir }

    let loP = 0, loQ = 1, hiP = 1, hiQ = 0;
    for (let i = 0; i < depth; i++) {
      const mP = loP + hiP;
      const mQ = loQ + hiQ;
      const medVal = mP / mQ;
      const dir = trueVal < medVal ? 'L' : 'R';
      pathNodes.push({ p: mP, q: mQ, val: medVal, dir, loP, loQ, hiP, hiQ });
      if (dir === 'L') {
        hiP = mP; hiQ = mQ;
      } else {
        loP = mP; loQ = mQ;
      }
    }

    // Layout: one row per level
    const W = container.clientWidth || 900;
    const rowH = 64;
    const H = depth * rowH + 80;
    const margin = { top: 30, left: 40 };

    const svg = d3.select(container).append('svg')
      .attr('width', W).attr('height', H)
      .style('background', '#0f172a');

    svg.append('text')
      .attr('x', W / 2).attr('y', 18)
      .attr('text-anchor', 'middle').attr('fill', '#64748b')
      .attr('font-size', 13)
      .text(`Stern-Brocot path for ${data.display_name || trueVal}`);

    // For each level draw the chosen mediant node plus the two boundary fractions
    pathNodes.forEach((node, i) => {
      const y = margin.top + i * rowH + rowH;
      const cx = W / 2;

      // Connecting line from previous level
      if (i > 0) {
        svg.append('line')
          .attr('x1', cx).attr('y1', y - rowH)
          .attr('x2', cx).attr('y2', y - 16)
          .attr('stroke', '#334155').attr('stroke-width', 1.5);
      }

      // Direction label on the connecting line
      if (i > 0) {
        svg.append('text')
          .attr('x', cx + 8).attr('y', y - rowH / 2)
          .attr('fill', node.dir === 'L' ? '#60a5fa' : '#f97316')
          .attr('font-size', 11).attr('font-weight', 'bold')
          .text(node.dir);
      }

      // Left boundary fraction (lo)
      svg.append('text')
        .attr('x', cx - 120).attr('y', y)
        .attr('text-anchor', 'middle').attr('fill', '#475569')
        .attr('font-size', 11)
        .text(`${node.loP}/${node.loQ}`);

      // Right boundary fraction (hi)
      svg.append('text')
        .attr('x', cx + 120).attr('y', y)
        .attr('text-anchor', 'middle').attr('fill', '#475569')
        .attr('font-size', 11)
        .text(`${node.hiP === 1 && node.hiQ === 0 ? '∞' : node.hiP + '/' + node.hiQ}`);

      // Chosen mediant node (circle)
      svg.append('circle')
        .attr('cx', cx).attr('cy', y)
        .attr('r', 22)
        .attr('fill', '#1e293b')
        .attr('stroke', node.dir === 'L' ? '#60a5fa' : '#f97316')
        .attr('stroke-width', 2);

      svg.append('text')
        .attr('x', cx).attr('y', y - 4)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('fill', '#f8fafc').attr('font-size', 11).attr('font-weight', 'bold')
        .text(`${node.p}/${node.q}`);

      svg.append('text')
        .attr('x', cx).attr('y', y + 10)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('fill', '#94a3b8').attr('font-size', 8)
        .text(node.val.toPrecision(5));
    });
  }

  // ─── Tooltip helper ────────────────────────────────────────────────────
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
      currentView = 'numberline';

      // Fetch preset list first
      let presets = [];
      try {
        presets = await window.API.fetchContinuedFractionPresets();
      } catch (e) {
        // Fallback list if endpoint not yet implemented
        presets = [
          { key: 'phi',    label: 'φ (Golden Ratio)' },
          { key: 'pi',     label: 'π' },
          { key: 'e',      label: 'e (Euler\'s number)' },
          { key: 'sqrt2',  label: '√2' },
          { key: 'sqrt3',  label: '√3' },
          { key: 'sqrt5',  label: '√5' },
          { key: 'ln2',    label: 'ln 2' },
          { key: 'sqrt7',  label: '√7' },
          { key: 'apery',  label: 'ζ(3) Apéry\'s constant' },
          { key: 'euler_mascheroni', label: 'γ (Euler–Mascheroni)' },
        ];
      }

      // Controls
      const controls = document.createElement('div');
      controls.className = 'controls';

      const optionsHtml = presets.map(p =>
        `<option value="${p.key}"${p.key === 'phi' ? ' selected' : ''}>${p.label || p.key}</option>`
      ).join('');

      controls.innerHTML = `
        <label>Constant
          <select id="cf-select">${optionsHtml}</select>
        </label>
        <label>Depth <span id="cf-depth-val">10</span>
          <input type="range" id="cf-depth" min="1" max="50" value="10">
        </label>
        <label>View
          <select id="cf-view">
            <option value="numberline" selected>Number Line</option>
            <option value="sternbrocot">Stern-Brocot Path</option>
          </select>
        </label>
        <span id="cf-err" style="color:#f87171;display:none"></span>
      `;
      container.appendChild(controls);

      vizContainer = document.createElement('div');
      container.appendChild(vizContainer);

      const selectEl  = controls.querySelector('#cf-select');
      const depthSlider = controls.querySelector('#cf-depth');
      const depthVal  = controls.querySelector('#cf-depth-val');
      const viewSel   = controls.querySelector('#cf-view');
      const errSpan   = controls.querySelector('#cf-err');

      async function doFetch() {
        errSpan.style.display = 'none';
        try {
          currentData = await window.API.fetchContinuedFraction(selectEl.value, +depthSlider.value);
          window.Views.contFraction.render(currentData, vizContainer);
        } catch (err) {
          errSpan.textContent = err.message || String(err);
          errSpan.style.display = '';
        }
      }

      function scheduleRefetch() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(doFetch, 300);
      }

      depthSlider.addEventListener('input', () => {
        depthVal.textContent = depthSlider.value;
        scheduleRefetch();
      });

      selectEl.addEventListener('change', doFetch);

      viewSel.addEventListener('change', () => {
        currentView = viewSel.value;
        if (currentData) window.Views.contFraction.render(currentData, vizContainer);
      });

      await doFetch();
    },

    render(data, container) {
      const target = container === vizContainer ? vizContainer : container;
      if (currentView === 'sternbrocot') {
        renderSternBrocot(data, target);
      } else {
        renderNumberLine(data, target);
      }
    }
  };
})();
