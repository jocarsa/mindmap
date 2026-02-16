document.addEventListener('DOMContentLoaded', iniciarMapaMental);

function iniciarMapaMental() {
  const mapa = document.querySelector('ul[contenteditable]');
  const svgNS = 'http://www.w3.org/2000/svg';

  // =========================
  // Zoom / Pan
  // =========================
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  mapa.style.transformOrigin = '0 0';

  // =========================
  // State
  // =========================
  const LS_KEY = 'jocarsa_mindmap_v1';
  let dragged = null;
  let selectedLi = null;

  // View modes: normal -> plain -> radial
  const VIEW = { NORMAL: 'normal', PLAIN: 'plain', RADIAL: 'radial' };
  let viewMode = VIEW.NORMAL;

  // =========================
  // SVG lines
  // =========================
  const svg = document.createElementNS(svgNS, 'svg');
  svg.id = 'mindmap-lines';
  mapa.style.position = 'relative';
  mapa.insertBefore(svg, mapa.firstChild);

  // =========================
  // Helpers: transform + redraw
  // =========================
  function actualizarTransform() {
    mapa.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    requestRedraw();
  }

  function requestRedraw() {
    // Redraw on next frame to let layout settle
    requestAnimationFrame(() => {
      updateChildrenMarkers();
      if (viewMode === VIEW.RADIAL) {
        layoutRadial();
        dibujarLineasRadial();
      } else if (viewMode === VIEW.NORMAL) {
        dibujarLineasNormal();
      } else {
        // plain view: no lines
        svg.innerHTML = '';
      }
    });
  }

  // Compute element position relative to "mapa" using offsets (stable under transforms)
  function posRelToMap(el) {
    let x = 0, y = 0;
    let cur = el;
    while (cur && cur !== mapa) {
      x += cur.offsetLeft || 0;
      y += cur.offsetTop || 0;
      cur = cur.offsetParent;
    }
    return { x, y };
  }

  // =========================
  // Controls: zoom/pan
  // =========================
  document.getElementById('btnZoomIn')
    .addEventListener('click', () => { scale *= 1.1; actualizarTransform(); });
  document.getElementById('btnZoomOut')
    .addEventListener('click', () => { scale /= 1.1; actualizarTransform(); });
  document.getElementById('btnPanLeft')
    .addEventListener('click', () => { offsetX += 50; actualizarTransform(); });
  document.getElementById('btnPanRight')
    .addEventListener('click', () => { offsetX -= 50; actualizarTransform(); });
  document.getElementById('btnPanUp')
    .addEventListener('click', () => { offsetY += 50; actualizarTransform(); });
  document.getElementById('btnPanDown')
    .addEventListener('click', () => { offsetY -= 50; actualizarTransform(); });

  // =========================
  // View toggle: cycles 3 modes
  // =========================
  const btnToggleVista = document.getElementById('btnToggleVista');

  function applyViewMode() {
    document.body.classList.remove('plain-view', 'radial-view');

    if (viewMode === VIEW.PLAIN) {
      document.body.classList.add('plain-view');
      btnToggleVista.textContent = '🧠';
      svg.innerHTML = '';
    } else if (viewMode === VIEW.RADIAL) {
      document.body.classList.add('radial-view');
      btnToggleVista.textContent = '🌀';
      requestRedraw();
    } else {
      // normal
      btnToggleVista.textContent = '📃';
      requestRedraw();
    }
  }

  btnToggleVista.addEventListener('click', () => {
    if (viewMode === VIEW.NORMAL) viewMode = VIEW.PLAIN;
    else if (viewMode === VIEW.PLAIN) viewMode = VIEW.RADIAL;
    else viewMode = VIEW.NORMAL;
    applyViewMode();
  });

  // =========================
  // Wrap texts in <span.node-text>
  // =========================
  function envolverTextos() {
    mapa.querySelectorAll('li').forEach(li => {
      // Ensure li is not accidentally fully contenteditable (we edit spans)
      li.setAttribute('contenteditable', 'false');

      if (li.querySelector(':scope > span.node-text')) return;

      // Convert direct text nodes into span.node-text
      const directText = [];
      Array.from(li.childNodes).forEach(n => {
        if (n.nodeType === Node.TEXT_NODE && /\S/.test(n.nodeValue)) directText.push(n);
      });
      if (directText.length === 0) {
        // if empty, create a span
        const sp = document.createElement('span');
        sp.className = 'node-text';
        sp.setAttribute('contenteditable', 'true');
        sp.textContent = 'Nodo';
        li.insertBefore(sp, li.firstChild);
        return;
      }

      directText.forEach(nodo => {
        const sp = document.createElement('span');
        sp.className = 'node-text';
        sp.setAttribute('contenteditable', 'true');
        sp.textContent = nodo.nodeValue.trim();
        li.insertBefore(sp, nodo);
        li.removeChild(nodo);
      });
    });
  }

  // =========================
  // Selection highlight
  // =========================
  function selectLi(li) {
    if (!li) return;
    if (selectedLi && selectedLi !== li) selectedLi.classList.remove('selected');
    selectedLi = li;
    selectedLi.classList.add('selected');
  }

  function selectedOrCaretLi() {
    if (selectedLi) return selectedLi;
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) return null;
    const n = sel.anchorNode.nodeType === Node.TEXT_NODE ? sel.anchorNode.parentElement : sel.anchorNode;
    return n ? n.closest('li') : null;
  }

  // Click selects node
  mapa.addEventListener('click', (e) => {
    const sp = e.target.closest('span.node-text');
    if (!sp) return;
    selectLi(sp.closest('li'));
  });

  // =========================
  // Folding / Unfolding
  // =========================
  function updateChildrenMarkers() {
    mapa.querySelectorAll('li').forEach(li => {
      const ul = li.querySelector(':scope > ul');
      if (ul && ul.querySelector(':scope > li')) li.classList.add('has-children');
      else li.classList.remove('has-children');
    });
  }

  function toggleCollapsed(li, recursive = false) {
    if (!li) return;
    const makeCollapsed = !li.classList.contains('collapsed');

    if (!recursive) {
      li.classList.toggle('collapsed', makeCollapsed);
    } else {
      // Apply to li and all descendants
      li.classList.toggle('collapsed', makeCollapsed);
      li.querySelectorAll('li').forEach(d => d.classList.toggle('collapsed', makeCollapsed));
    }

    saveSoon();
    requestRedraw();
  }

  // Double click toggles children (level)
  mapa.addEventListener('dblclick', (e) => {
    const sp = e.target.closest('span.node-text');
    if (!sp) return;
    const li = sp.closest('li');
    selectLi(li);
    // Alt + dblclick => recursive
    toggleCollapsed(li, e.altKey === true);
  });

  // Buttons for fold
  const btnFoldChildren = document.getElementById('btnFoldChildren');
  const btnFoldAll = document.getElementById('btnFoldAll');
  if (btnFoldChildren) btnFoldChildren.addEventListener('click', () => toggleCollapsed(selectedOrCaretLi(), false));
  if (btnFoldAll) btnFoldAll.addEventListener('click', () => toggleCollapsed(selectedOrCaretLi(), true));

  // Keyboard shortcuts:
  // f => fold/unfold children, Shift+f => recursive fold/unfold
  document.addEventListener('keydown', (e) => {
    // Don’t hijack typing inside spans except for specific keys
    const active = document.activeElement;
    const inEditor = active && active.classList && active.classList.contains('node-text');

    if (e.key === 'Tab') {
      e.preventDefault();
      agregarHijoSeleccion();
      return;
    }

    if (e.key.toLowerCase() === 'f') {
      // allow in editor too
      e.preventDefault();
      toggleCollapsed(selectedOrCaretLi(), e.shiftKey);
      return;
    }
  });

  // =========================
  // Add child / sibling
  // =========================
  document.getElementById('btnAgregarHijo').addEventListener('click', agregarHijoSeleccion);

  function agregarHijoSeleccion() {
    const li = selectedOrCaretLi();
    if (!li) return;

    let ulH = li.querySelector(':scope > ul');
    if (!ulH) { ulH = document.createElement('ul'); li.appendChild(ulH); }

    const nuevo = document.createElement('li');
    nuevo.setAttribute('contenteditable', 'false');
    nuevo.textContent = 'Nuevo nodo';
    ulH.appendChild(nuevo);

    envolverTextos();
    makeAllDraggable();
    updateChildrenMarkers();
    selectLi(nuevo);
    focusOn(nuevo);
    saveSoon();
    requestRedraw();
  }

  document.getElementById('btnAgregarHermano').addEventListener('click', () => {
    const li = selectedOrCaretLi();
    if (!li || !li.parentNode) return;

    const herm = document.createElement('li');
    herm.setAttribute('contenteditable', 'false');
    herm.textContent = 'Nuevo nodo';
    li.parentNode.insertBefore(herm, li.nextSibling);

    envolverTextos();
    makeAllDraggable();
    updateChildrenMarkers();
    selectLi(herm);
    focusOn(herm);
    saveSoon();
    requestRedraw();
  });

  function focusOn(li) {
    const sp = li.querySelector(':scope > span.node-text');
    if (!sp) return;
    sp.focus();
    // place caret at end
    const range = document.createRange();
    range.selectNodeContents(sp);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // =========================
  // Move up/down
  // =========================
  document.getElementById('btnMoveUp').addEventListener('click', () => swapWithSibling(-1));
  document.getElementById('btnMoveDown').addEventListener('click', () => swapWithSibling(+1));

  function swapWithSibling(direction) {
    const li = selectedOrCaretLi();
    if (!li || !li.parentNode) return;

    const siblings = Array.from(li.parentNode.children);
    const idx = siblings.indexOf(li);
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= siblings.length) return;

    const target = siblings[targetIdx];
    if (direction < 0) li.parentNode.insertBefore(li, target);
    else li.parentNode.insertBefore(target, li);

    envolverTextos();
    updateChildrenMarkers();
    selectLi(li);
    focusOn(li);
    saveSoon();
    requestRedraw();
  }

  // =========================
  // Color
  // =========================
  document.getElementById('btnColor').addEventListener('click', () => document.getElementById('selectorColor').click());

  document.getElementById('selectorColor').addEventListener('input', () => {
    const li = selectedOrCaretLi();
    if (!li) return;
    const sp = li.querySelector(':scope > span.node-text');
    if (!sp) return;
    sp.style.color = document.getElementById('selectorColor').value;
    saveSoon();
    requestRedraw();
  });

  // =========================
  // Save/Load Markdown + JSON
  // =========================
  document.getElementById('btnGuardar').addEventListener('click', () => {
    // default: Markdown export
    const name = (mapa.querySelector('span.node-text')?.textContent.trim() || 'mapa') + '.md';
    const blob = new Blob([toMarkdown(mapa)], { type: 'text/markdown' });
    downloadBlob(blob, name);
  });

  document.getElementById('btnCargar').addEventListener('click', () => document.getElementById('inputArchivo').click());

  document.getElementById('inputArchivo').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;

    const ext = (f.name.split('.').pop() || '').toLowerCase();
    const r = new FileReader();
    r.onload = ev => {
      const content = String(ev.target.result || '');
      if (ext === 'json') {
        loadFromJsonText(content);
      } else {
        // default markdown
        cargarMd(content);
      }
      // reset file input so selecting same file again triggers change
      e.target.value = '';
    };
    r.readAsText(f);
  });

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
  }

  function toMarkdown(ul, depth = 0) {
    let s = '';
    ul.querySelectorAll(':scope > li').forEach(li => {
      const t = (li.querySelector(':scope > span.node-text')?.textContent || '').trim();
      s += '  '.repeat(depth) + '- ' + t + '\n';
      const ch = li.querySelector(':scope > ul');
      if (ch) s += toMarkdown(ch, depth + 1);
    });
    return s;
  }

  function cargarMd(text) {
    const lines = text.split('\n');
    const ulR = document.createElement('ul');
    const stack = [{ ul: ulR, ind: -1 }];

    for (let ln of lines) {
      if (!ln.trim()) continue;
      const m = ln.match(/^(\s*)[-*]\s+(.*)$/);
      if (!m) continue;

      const ind = m[1].length / 2;
      const li = document.createElement('li');
      li.setAttribute('contenteditable', 'false');
      li.textContent = m[2];

      while (ind <= stack[stack.length - 1].ind) stack.pop();
      stack[stack.length - 1].ul.appendChild(li);

      let chi = li.querySelector('ul');
      if (!chi) { chi = document.createElement('ul'); li.appendChild(chi); }
      stack.push({ ul: chi, ind });
    }

    mapa.innerHTML = ulR.innerHTML;
    postLoadRefresh(true);
  }

  // JSON format for load/save (localStorage uses this too)
  function serializeLi(li) {
    const sp = li.querySelector(':scope > span.node-text');
    const color = sp ? (sp.style.color || '') : '';
    const text = sp ? sp.textContent : '';
    const collapsed = li.classList.contains('collapsed');

    const ul = li.querySelector(':scope > ul');
    const children = ul ? Array.from(ul.children).filter(x => x.tagName === 'LI').map(serializeLi) : [];

    return { text, color, collapsed, children };
  }

  function toJsonObject() {
    const rootLis = Array.from(mapa.querySelectorAll(':scope > li'));
    return {
      version: 1,
      viewMode,
      scale,
      offsetX,
      offsetY,
      tree: rootLis.map(serializeLi)
    };
  }

  function buildLiFromObj(obj) {
    const li = document.createElement('li');
    li.setAttribute('contenteditable', 'false');

    const sp = document.createElement('span');
    sp.className = 'node-text';
    sp.setAttribute('contenteditable', 'true');
    sp.textContent = (obj && typeof obj.text === 'string') ? obj.text : 'Nodo';
    if (obj && obj.color) sp.style.color = obj.color;
    li.appendChild(sp);

    if (obj && obj.collapsed) li.classList.add('collapsed');

    const kids = (obj && Array.isArray(obj.children)) ? obj.children : [];
    if (kids.length) {
      const ul = document.createElement('ul');
      kids.forEach(ch => ul.appendChild(buildLiFromObj(ch)));
      li.appendChild(ul);
    }
    return li;
  }

  function loadFromJsonObject(data) {
    const ul = document.createElement('ul');
    const tree = (data && Array.isArray(data.tree)) ? data.tree : [];
    tree.forEach(n => ul.appendChild(buildLiFromObj(n)));
    mapa.innerHTML = ul.innerHTML;

    // restore transforms/mode if present
    if (data && typeof data.scale === 'number') scale = data.scale;
    if (data && typeof data.offsetX === 'number') offsetX = data.offsetX;
    if (data && typeof data.offsetY === 'number') offsetY = data.offsetY;

    if (data && (data.viewMode === VIEW.NORMAL || data.viewMode === VIEW.PLAIN || data.viewMode === VIEW.RADIAL)) {
      viewMode = data.viewMode;
    } else {
      viewMode = VIEW.NORMAL;
    }

    actualizarTransform();
    applyViewMode();
    postLoadRefresh(true);
  }

  function loadFromJsonText(txt) {
    try {
      const data = JSON.parse(txt);
      loadFromJsonObject(data);
      saveSoon();
    } catch (e) {
      // fallback: ignore
      console.error('JSON inválido', e);
    }
  }

  function postLoadRefresh(selectFirst) {
    envolverTextos();
    makeAllDraggable();
    updateChildrenMarkers();

    if (selectFirst) {
      const first = mapa.querySelector('li');
      if (first) selectLi(first);
    }

    // Ensure lines redraw correctly after load
    requestRedraw();
    saveSoon();
  }

  // =========================
  // LocalStorage autosave/restore
  // =========================
  let saveT = null;
  function saveSoon() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try {
        const data = toJsonObject();
        localStorage.setItem(LS_KEY, JSON.stringify(data));
      } catch (e) {
        console.warn('No se pudo guardar en localStorage', e);
      }
    }, 250);
  }

  function restoreFromLocalStorageIfAny() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      loadFromJsonObject(data);
      return true;
    } catch {
      return false;
    }
  }

  // Save on edits in spans
  mapa.addEventListener('input', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('node-text')) {
      saveSoon();
      requestRedraw();
    }
  });

  // =========================
  // Drag & Drop (same as before, plus save/redraw)
  // =========================
  function enableDragDrop(li) {
    li.draggable = true;

    li.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', '');
      dragged = li;
      selectLi(li);
    });

    li.addEventListener('dragover', e => {
      e.preventDefault();
      li.classList.add('drag-over');
    });

    li.addEventListener('dragleave', () => {
      li.classList.remove('drag-over');
    });

    li.addEventListener('drop', e => {
      e.stopPropagation();
      li.classList.remove('drag-over');

      if (dragged && dragged !== li) {
        li.parentNode.insertBefore(dragged, li.nextSibling);
        envolverTextos();
        updateChildrenMarkers();
        saveSoon();
        requestRedraw();
      }
    });
  }

  function makeAllDraggable() {
    mapa.querySelectorAll('li').forEach(li => {
      if (!li.draggable) enableDragDrop(li);
    });
  }

  // =========================
  // Redraw lines: NORMAL
  // =========================
  function dibujarLineasNormal() {
    if (viewMode !== VIEW.NORMAL) return;

    // workspace size independent from transforms
    const w = Math.max(mapa.scrollWidth, 10);
    const h = Math.max(mapa.scrollHeight, 10);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.innerHTML = '';

    mapa.querySelectorAll('li').forEach(padre => {
      if (padre.classList.contains('collapsed')) return;

      const txtP = padre.querySelector(':scope > span.node-text');
      const ulH = padre.querySelector(':scope > ul');
      if (!txtP || !ulH) return;

      const kids = Array.from(ulH.children).filter(x => x.tagName === 'LI');
      if (!kids.length) return;

      const pPos = posRelToMap(txtP);
      const x1 = pPos.x + txtP.offsetWidth + 6;
      const y1 = pPos.y + (txtP.offsetHeight / 2);

      kids.forEach(hijo => {
        const txtH = hijo.querySelector(':scope > span.node-text');
        if (!txtH) return;

        const hPos = posRelToMap(txtH);
        const x2 = hPos.x - 6;
        const y2 = hPos.y + (txtH.offsetHeight / 2);

        const midX = (x1 + x2) / 2;
        const pts = `${x1},${y1} ${midX},${y1} ${midX},${y2} ${x2},${y2}`;

        const poly = document.createElementNS(svgNS, 'polyline');
        poly.setAttribute('points', pts);
        poly.setAttribute('fill', 'none');
        poly.setAttribute('stroke', '#888');
        poly.setAttribute('stroke-width', '1');
        poly.setAttribute('stroke-linejoin', 'round');
        poly.setAttribute('stroke-linecap', 'round');
        svg.appendChild(poly);
      });
    });
  }

  // =========================
  // RADIAL layout + lines
  // =========================
  function getTreeRootLis() {
    return Array.from(mapa.querySelectorAll(':scope > li'));
  }

  function getChildrenLis(li) {
    if (li.classList.contains('collapsed')) return [];
    const ul = li.querySelector(':scope > ul');
    if (!ul) return [];
    return Array.from(ul.children).filter(x => x.tagName === 'LI');
  }

  function leafCount(li) {
    const kids = getChildrenLis(li);
    if (!kids.length) return 1;
    return kids.reduce((sum, k) => sum + leafCount(k), 0);
  }

  function layoutRadial() {
    if (viewMode !== VIEW.RADIAL) return;

    const roots = getTreeRootLis();
    if (!roots.length) return;

    // Use first root as center, treat additional roots as siblings around it
    const centerX = Math.floor((mapa.clientWidth || 2400) / 2);
    const centerY = Math.floor((mapa.clientHeight || 2400) / 2);

    const R_STEP = 160;

    // Compute total leaves across roots to split angles
    const rootLeaves = roots.map(r => leafCount(r));
    const totalLeaves = rootLeaves.reduce((a, b) => a + b, 0) || 1;

    let angleStart = -Math.PI; // full circle span
    roots.forEach((root, i) => {
      const span = (rootLeaves[i] / totalLeaves) * (Math.PI * 2);
      const angleEnd = angleStart + span;
      placeRadial(root, centerX, centerY, 0, angleStart, angleEnd);
      angleStart = angleEnd;
    });

    // update svg workspace
    const w = Math.max(mapa.scrollWidth, 2400);
    const h = Math.max(mapa.scrollHeight, 2400);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  function placeRadial(li, cx, cy, depth, a0, a1) {
    const sp = li.querySelector(':scope > span.node-text');
    if (!sp) return;

    // Position node
    const angle = (a0 + a1) / 2;
    const r = depth * 160;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;

    // Store for lines
    li.dataset.rx = String(x);
    li.dataset.ry = String(y);

    // Move LI
    li.style.left = `${Math.round(x)}px`;
    li.style.top = `${Math.round(y)}px`;

    const kids = getChildrenLis(li);
    if (!kids.length) return;

    const weights = kids.map(k => leafCount(k));
    const sumW = weights.reduce((a, b) => a + b, 0) || 1;

    let cur = a0;
    kids.forEach((k, idx) => {
      const span = (weights[idx] / sumW) * (a1 - a0);
      const next = cur + span;
      placeRadial(k, cx, cy, depth + 1, cur, next);
      cur = next;
    });
  }

  function dibujarLineasRadial() {
    if (viewMode !== VIEW.RADIAL) return;

    const w = Math.max(mapa.scrollWidth, 2400);
    const h = Math.max(mapa.scrollHeight, 2400);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.innerHTML = '';

    mapa.querySelectorAll('li').forEach(padre => {
      if (padre.classList.contains('collapsed')) return;

      const kids = getChildrenLis(padre);
      if (!kids.length) return;

      const px = parseFloat(padre.dataset.rx || 'NaN');
      const py = parseFloat(padre.dataset.ry || 'NaN');
      if (!isFinite(px) || !isFinite(py)) return;

      kids.forEach(hijo => {
        const hx = parseFloat(hijo.dataset.rx || 'NaN');
        const hy = parseFloat(hijo.dataset.ry || 'NaN');
        if (!isFinite(hx) || !isFinite(hy)) return;

        const midX = (px + hx) / 2;
        const pts = `${px},${py} ${midX},${py} ${midX},${hy} ${hx},${hy}`;

        const poly = document.createElementNS(svgNS, 'polyline');
        poly.setAttribute('points', pts);
        poly.setAttribute('fill', 'none');
        poly.setAttribute('stroke', '#888');
        poly.setAttribute('stroke-width', '1');
        poly.setAttribute('stroke-linejoin', 'round');
        poly.setAttribute('stroke-linecap', 'round');
        svg.appendChild(poly);
      });
    });
  }

  // =========================
  // MutationObserver: wrap + redraw + autosave
  // =========================
  const mo = new MutationObserver(() => {
    mo.disconnect();
    envolverTextos();
    makeAllDraggable();
    updateChildrenMarkers();
    saveSoon();
    requestRedraw();
    mo.observe(mapa, { childList: true, subtree: true, characterData: true });
  });
  mo.observe(mapa, { childList: true, subtree: true, characterData: true });

  window.addEventListener('resize', requestRedraw);

  // =========================
  // Init
  // =========================
  envolverTextos();
  makeAllDraggable();
  updateChildrenMarkers();

  // restore from localStorage if exists; otherwise keep existing HTML
  const restored = restoreFromLocalStorageIfAny();
  if (!restored) {
    // ensure first node selectable
    const first = mapa.querySelector('li');
    if (first) selectLi(first);
    requestRedraw();
    saveSoon(); // start with a saved baseline
    applyViewMode();
  }
}

