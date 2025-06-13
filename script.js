document.addEventListener('DOMContentLoaded', iniciarMapaMental);

function iniciarMapaMental() {
  const mapa = document.querySelector('ul[contenteditable]');
  const svgNS = 'http://www.w3.org/2000/svg';

  // Variables de zoom y pan
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  mapa.style.transformOrigin = '0 0';

  // Referencia para Drag & Drop
  let dragged = null;

  // Función para aplicar transform y redibujar
  function actualizarTransform() {
    mapa.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    dibujarLineas();
  }

  // Controles zoom/pan
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

  // Botón alternar vista
  const btnToggleVista = document.getElementById('btnToggleVista');
  btnToggleVista.addEventListener('click', () => {
    document.body.classList.toggle('plain-view');
    btnToggleVista.textContent = document.body.classList.contains('plain-view') ? '🧠' : '📃';
    if (!document.body.classList.contains('plain-view')) dibujarLineas();
  });

  // SVG para conexiones
  const svg = document.createElementNS(svgNS, 'svg');
  svg.id = 'mindmap-lines';
  mapa.style.position = 'relative';
  mapa.insertBefore(svg, mapa.firstChild);

  // Envolver textos en <span>
  function envolverTextos() {
    mapa.querySelectorAll('li').forEach(li => {
      if (li.querySelector(':scope > span.node-text')) return;
      Array.from(li.childNodes).forEach(nodo => {
        if (nodo.nodeType === Node.TEXT_NODE && /\S/.test(nodo.nodeValue)) {
          const sp = document.createElement('span');
          sp.className = 'node-text';
          sp.setAttribute('contenteditable', 'true');
          sp.textContent = nodo.nodeValue.trim();
          li.insertBefore(sp, nodo);
          li.removeChild(nodo);
        }
      });
    });
  }

  // Dibujar líneas con esquinas redondeadas
  function dibujarLineas() {
    if (document.body.classList.contains('plain-view')) return;
    const rect = mapa.getBoundingClientRect();
    svg.setAttribute('width', rect.width);
    svg.setAttribute('height', rect.height);
    svg.innerHTML = '';
    mapa.querySelectorAll('li').forEach(padre => {
      const txtP = padre.querySelector(':scope > span.node-text');
      const ulH = padre.querySelector(':scope > ul');
      if (!txtP || !ulH) return;
      const rP = txtP.getBoundingClientRect();
      const x1 = rP.right - rect.left + 5;
      const y1 = rP.top + rP.height / 2 - rect.top;
      ulH.querySelectorAll(':scope>li').forEach(hijo => {
        const txtH = hijo.querySelector(':scope>span.node-text');
        if (!txtH) return;
        const rH = txtH.getBoundingClientRect();
        const x2 = rH.left - rect.left - 5;
        const y2 = rH.top + rH.height / 2 - rect.top;
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

  // Observador y resize
  const mo = new MutationObserver(() => {
    mo.disconnect();
    envolverTextos();
    makeAllDraggable();
    dibujarLineas();
    mo.observe(mapa, { childList: true, subtree: true, characterData: true });
  });
  mo.observe(mapa, { childList: true, subtree: true, characterData: true });
  window.addEventListener('resize', dibujarLineas);

  // Tab para agregar hijo
  document.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      agregarHijoSeleccion();
    }
  });

  // Agregar hijo
  document.getElementById('btnAgregarHijo').addEventListener('click', agregarHijoSeleccion);
  function agregarHijoSeleccion() {
    const sel = window.getSelection(); if (!sel.anchorNode) return;
    let nodo = sel.anchorNode.nodeType === Node.TEXT_NODE ? sel.anchorNode.parentElement : sel.anchorNode;
    const li = nodo.closest('li'); if (!li) return;
    let ulH = li.querySelector(':scope>ul'); if (!ulH) { ulH = document.createElement('ul'); li.appendChild(ulH); }
    const nuevo = document.createElement('li'); nuevo.setAttribute('contenteditable', 'true'); nuevo.textContent = 'Nuevo nodo';
    ulH.appendChild(nuevo); envolverTextos(); makeAllDraggable(); dibujarLineas(); focusOn(nuevo);
  }

  // Agregar hermano
  document.getElementById('btnAgregarHermano').addEventListener('click', () => {
    const sel = window.getSelection(); if (!sel.anchorNode) return;
    let nodo = sel.anchorNode.nodeType === Node.TEXT_NODE ? sel.anchorNode.parentElement : sel.anchorNode;
    const li = nodo.closest('li'); if (!li || !li.parentNode) return;
    const herm = document.createElement('li'); herm.setAttribute('contenteditable', 'true'); herm.textContent = 'Nuevo nodo';
    li.parentNode.insertBefore(herm, li.nextSibling); envolverTextos(); makeAllDraggable(); dibujarLineas(); focusOn(herm);
  });

  // Color, guardar y cargar Markdown (igual que antes)
  document.getElementById('btnColor').addEventListener('click', () => document.getElementById('selectorColor').click());
  document.getElementById('selectorColor').addEventListener('input', () => {
    const sel = window.getSelection(); if (!sel.anchorNode) return;
    let sp = sel.anchorNode.nodeType === Node.TEXT_NODE ? sel.anchorNode.parentElement : sel.anchorNode;
    sp = sp.closest('span.node-text'); if (sp) sp.style.color = document.getElementById('selectorColor').value;
  });

  document.getElementById('btnGuardar').addEventListener('click', () => {
    function md(ul, depth = 0) {
      let s = '';
      ul.querySelectorAll(':scope>li').forEach(li => {
        const t = (li.querySelector(':scope>span.node-text')?.textContent || '').trim();
        s += '  '.repeat(depth) + '- ' + t + '\n';
        const ch = li.querySelector(':scope>ul'); if (ch) s += md(ch, depth + 1);
      });
      return s;
    }
    const name = (mapa.querySelector('span.node-text')?.textContent.trim() || 'mapa') + '.md';
    const blob = new Blob([md(mapa)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a);
    a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
  });

  document.getElementById('btnCargar').addEventListener('click', () => document.getElementById('inputArchivo').click());
  document.getElementById('inputArchivo').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = ev => cargarMd(ev.target.result); r.readAsText(f);
  });
  function cargarMd(text) {
    const lines = text.split('\n'); const ulR = document.createElement('ul'); const stack = [{ ul: ulR, ind: -1 }];
    for (let ln of lines) {
      if (!ln.trim()) continue;
      const m = ln.match(/^(\s*)[-*]\s+(.*)$/);
      if (!m) continue;
      const ind = m[1].length / 2;
      const li = document.createElement('li'); li.setAttribute('contenteditable', 'true'); li.textContent = m[2];
      while (ind <= stack[stack.length - 1].ind) stack.pop();
      stack[stack.length - 1].ul.appendChild(li);
      let chi = li.querySelector('ul'); if (!chi) { chi = document.createElement('ul'); li.appendChild(chi); }
      stack.push({ ul: chi, ind });
    }
    mapa.innerHTML = ulR.innerHTML; envolverTextos(); makeAllDraggable(); dibujarLineas();
  }

  // Mover arriba/abajo
  document.getElementById('btnMoveUp').addEventListener('click', () => swapWithSibling(-1));
  document.getElementById('btnMoveDown').addEventListener('click', () => swapWithSibling(+1));
  function swapWithSibling(direction) {
    const sel = window.getSelection(); if (!sel.anchorNode) return;
    let nodo = sel.anchorNode.nodeType === Node.TEXT_NODE ? sel.anchorNode.parentElement : sel.anchorNode;
    const li = nodo.closest('li'); if (!li || !li.parentNode) return;
    const siblings = Array.from(li.parentNode.children);
    const idx = siblings.indexOf(li);
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= siblings.length) return;
    const target = siblings[targetIdx];
    if (direction < 0) li.parentNode.insertBefore(li, target);
    else li.parentNode.insertBefore(target, li);
    envolverTextos(); dibujarLineas(); focusOn(li);
  }

  // Drag & Drop handlers
  function enableDragDrop(li) {
    li.draggable = true;
    li.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', '');
      dragged = li;
    });
    li.addEventListener('dragover', e => {
      e.preventDefault();
      li.classList.add('drag-over');
    });
    li.addEventListener('dragleave', () => { li.classList.remove('drag-over'); });
    li.addEventListener('drop', e => {
      e.stopPropagation();
      li.classList.remove('drag-over');
      if (dragged && dragged !== li) {
        li.parentNode.insertBefore(dragged, li.nextSibling);
        envolverTextos(); dibujarLineas();
      }
    });
  }
  function makeAllDraggable() {
    mapa.querySelectorAll('li').forEach(li => { if (!li.draggable) enableDragDrop(li); });
  }

  // Inicial
  envolverTextos();
  makeAllDraggable();
  dibujarLineas();
}

