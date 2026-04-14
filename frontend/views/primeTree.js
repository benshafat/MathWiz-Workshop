window.Views = window.Views || {};

window.Views.primTree = {
  async mount(container) {
    const controls = document.createElement('div');
    controls.className = 'controls';
    controls.innerHTML = `
      <label>n = <input type="number" id="pt-n-input" value="12" min="2" max="9999" step="1" style="width:80px" /></label>
      <button id="pt-draw-btn">Draw</button>
      <span id="pt-error" style="color:#f87171;display:none"></span>
    `;
    container.appendChild(controls);

    const svgWrap = document.createElement('div');
    svgWrap.id = 'pt-svg-wrap';
    container.appendChild(svgWrap);

    const drawBtn = controls.querySelector('#pt-draw-btn');
    const nInput  = controls.querySelector('#pt-n-input');
    const errSpan = controls.querySelector('#pt-error');

    async function fetchAndRender() {
      const n = parseInt(nInput.value, 10);
      if (isNaN(n) || n < 2) {
        errSpan.textContent = 'Please enter an integer >= 2.';
        errSpan.style.display = '';
        return;
      }
      errSpan.style.display = 'none';
      try {
        const data = await window.API.fetchPrimeTree(n);
        window.Views.primTree.render(data, svgWrap);
      } catch (err) {
        errSpan.textContent = err.message || String(err);
        errSpan.style.display = '';
      }
    }

    drawBtn.addEventListener('click', fetchAndRender);
    nInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') fetchAndRender(); });

    await fetchAndRender();
  },

  render(data, container) {
    container.innerHTML = '';

    // Normalise payload into an array of 3 tree-root objects.
    // Expected API shape: { trees: [{root, label}, ...] }  OR  {n_minus_1, n, n_plus_1}
    let trees = [];
    if (Array.isArray(data)) {
      trees = data;
    } else if (Array.isArray(data.trees)) {
      trees = data.trees;
    } else {
      const keys = ['n_minus_1', 'n', 'n_plus_1'];
      keys.forEach(function(k) { if (data[k]) trees.push({ root: data[k] }); });
    }
    if (!trees.length) {
      container.textContent = 'No tree data received.';
      return;
    }

    const totalWidth = (container.clientWidth || 900);
    const svgHeight  = 500;
    const colWidth   = Math.floor(totalWidth / 3);
    const treeHeight = svgHeight - 60;

    // Shared floating tooltip
    var tooltip = document.getElementById('pt-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'pt-tooltip';
      Object.assign(tooltip.style, {
        position: 'fixed', background: '#1e293b', color: '#f8fafc',
        border: '1px solid #475569', padding: '8px 12px', borderRadius: '6px',
        fontSize: '13px', pointerEvents: 'none', display: 'none', zIndex: '9999'
      });
      document.body.appendChild(tooltip);
    }

    const svg = d3.create('svg')
      .attr('width', '100%')
      .attr('height', svgHeight)
      .style('background', '#0f172a')
      .style('display', 'block');

    trees.forEach(function(treeEntry, idx) {
      const isCentre = (idx === 1);
      const nodeR    = isCentre ? 22 : 16;
      const xOffset  = idx * colWidth;

      // Accept root either as treeEntry.root or the object itself
      const rootData = treeEntry.root || treeEntry;

      const layout = d3.tree().size([colWidth - 40, treeHeight - 60]);
      const root   = d3.hierarchy(rootData, function(d) { return d.children; });
      layout(root);

      const g = svg.append('g')
        .attr('transform', 'translate(' + (xOffset + 20) + ',40)');

      // Links — curved using d3.linkVertical
      g.selectAll('.pt-link-' + idx)
        .data(root.links())
        .join('path')
        .attr('fill', 'none')
        .attr('stroke', '#475569')
        .attr('stroke-width', 1.5)
        .attr('d', d3.linkVertical()
          .x(function(d) { return d.x; })
          .y(function(d) { return d.y; }));

      // Node groups
      const node = g.selectAll('.pt-node-' + idx)
        .data(root.descendants())
        .join('g')
        .attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; });

      node.append('circle')
        .attr('r', nodeR)
        .attr('fill', function(d) {
          const v = d.data.value;
          const isPrime = d.data.is_prime ||
                          (!d.children && isPrimeFrontend(v));
          return isPrime ? '#f97316' : '#334155';
        })
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 2);

      node.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('fill', '#f8fafc')
        .attr('font-size', isCentre ? 13 : 11)
        .attr('font-weight', 'bold')
        .text(function(d) {
          return d.data.value !== undefined ? d.data.value : (d.data.label || '');
        });

      // Tooltip on hover
      node.on('mousemove', function(event, d) {
        const val    = d.data.value !== undefined ? d.data.value : '';
        const isPrime = d.data.is_prime || (!d.children && isPrimeFrontend(val));
        const leaves = ptCollectLeaves(d);
        const factStr = (isPrime || leaves.length <= 1)
          ? (isPrime ? 'prime' : '')
          : ('= ' + leaves.join(' \u00d7 '));
        tooltip.innerHTML = '<strong>' + val + '</strong>' + (factStr ? '<br>' + factStr : '');
        tooltip.style.display = 'block';
        tooltip.style.left = (event.clientX + 14) + 'px';
        tooltip.style.top  = (event.clientY - 10) + 'px';
      }).on('mouseleave', function() {
        tooltip.style.display = 'none';
      });
    });

    container.appendChild(svg.node());
  }
};

function isPrimeFrontend(n) {
  n = Number(n);
  if (!n || n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (var i = 3; i <= Math.sqrt(n); i += 2) if (n % i === 0) return false;
  return true;
}

function ptCollectLeaves(node) {
  if (!node.children || !node.children.length) return [node.data.value];
  var out = [];
  node.children.forEach(function(c) { out = out.concat(ptCollectLeaves(c)); });
  return out;
}
