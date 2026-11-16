/* Desenha uma estrutura ACML (list, tree ou graph) em SVG e destaca o nó start.
   Entrada: { type, start, nodes: [{id, value}], root (só tree), edges: [{from, to, weight}] }
   As cores vêm das variáveis de style.css (ver .viz em upload.css). */
(function () {
  "use strict";
  var SVGNS = "http://www.w3.org/2000/svg";
  var W = 156, H = 72, M = 32;

  function el(nome, attrs, pai) {
    var e = document.createElementNS(SVGNS, nome);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    if (pai) pai.appendChild(e);
    return e;
  }
  function txt(pai, classe, x, y, s) {
    var t = el("text", { "class": classe, x: x, y: y, "text-anchor": "middle" }, pai);
    t.textContent = s;
    return t;
  }

  /* Quebra o texto em até 2 linhas de ~20 caracteres, com reticências. */
  function quebrar(s, max, linhas) {
    var palavras = String(s).split(/\s+/).filter(Boolean), out = [], atual = "";
    palavras.forEach(function (p) {
      while (p.length > max) {
        if (atual) { out.push(atual); atual = ""; }
        out.push(p.slice(0, max)); p = p.slice(max);
      }
      if (!atual) atual = p;
      else if ((atual + " " + p).length <= max) atual += " " + p;
      else { out.push(atual); atual = p; }
    });
    if (atual) out.push(atual);
    if (out.length > linhas) {
      out = out.slice(0, linhas);
      out[linhas - 1] = out[linhas - 1].replace(/.{0,2}$/, "").replace(/\s+$/, "") + "…";
    }
    return out;
  }

  /* Caixa de um nó, centrada em (cx, cy). */
  /* atual: nó em destaque (a classe CSS "inicio" é o destaque); ehStart: recebe o selo "start"; prox: próximo nó do grafo. */
  function caixa(pai, no, cx, cy, atual, ehStart, prox) {
    var g = el("g", { "class": "no" + (atual ? " inicio" : "") + (prox ? " prox" : ""), transform: "translate(" + (cx - W / 2) + "," + (cy - H / 2) + ")" }, pai);
    el("title", {}, g).textContent = no.id + ": " + no.value + (ehStart ? " (nó inicial)" : "");
    if (atual) el("rect", { "class": "halo", x: -7, y: -7, width: W + 14, height: H + 14, rx: 15 }, g);
    el("rect", { "class": "corpo", width: W, height: H, rx: 10 }, g);
    txt(g, "t-id", W / 2, 19, no.id);
    var linhas = quebrar(no.value, 21, 2), y0 = linhas.length === 1 ? 46 : 38;
    linhas.forEach(function (l, i) { txt(g, "t-val", W / 2, y0 + i * 16, l); });
    if (ehStart) {
      el("rect", { "class": "selo", x: -5, y: -16, width: 48, height: 20, rx: 10 }, g);
      txt(g, "t-selo", 19, -2, "start");
    }
    return g;
  }

  function novoSvg(pai, largura, altura, titulo, descricao) {
    var svg = el("svg", { xmlns: SVGNS, viewBox: "0 0 " + largura + " " + altura, width: largura, height: altura, role: "img", "class": "viz-svg" }, pai);
    var id = "viz" + Math.floor(Math.random() * 1e6);
    el("title", { id: id + "t" }, svg).textContent = titulo;
    el("desc", { id: id + "d" }, svg).textContent = descricao;
    svg.setAttribute("aria-labelledby", id + "t " + id + "d");
    var defs = el("defs", {}, svg);
    var mk = el("marker", { id: "seta", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 12, markerHeight: 12, markerUnits: "userSpaceOnUse", orient: "auto-start-reverse" }, defs);
    el("path", { "class": "seta", d: "M1.5 1.5 L8.5 5 L1.5 8.5" }, mk);
    var mk2 = el("marker", { id: "seta-sel", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 12, markerHeight: 12, markerUnits: "userSpaceOnUse", orient: "auto-start-reverse" }, defs);
    el("path", { "class": "seta seta-sel", d: "M1.5 1.5 L8.5 5 L1.5 8.5" }, mk2);
    return svg;
  }

  /* ---------------- LIST ---------------- */
  /* Caixa da lista: id (e "(start)") em cima, value dentro. */
  function caixaLista(pai, no, cx, cy, hl, atual, ehStart) {
    var g = el("g", { "class": "no" + (atual ? " inicio" : ""), transform: "translate(" + (cx - W / 2) + "," + (cy - hl / 2) + ")" }, pai);
    el("title", {}, g).textContent = no.id + ": " + no.value + (ehStart ? " (nó inicial)" : "");
    if (atual) el("rect", { "class": "halo", x: -7, y: -7, width: W + 14, height: hl + 14, rx: 15 }, g);
    el("rect", { "class": "corpo", width: W, height: hl, rx: 10 }, g);
    txt(g, "t-rot" + (atual ? " t-rot-start" : ""), W / 2, -14, no.id + (ehStart ? " (start)" : ""));
    var linhas = quebrar(no.value, 21, 2), y0 = linhas.length === 1 ? hl / 2 + 5 : hl / 2 - 3;
    linhas.forEach(function (l, i) { txt(g, "t-val", W / 2, y0 + i * 16, l); });
    return g;
  }

  function lista(m, pai, larguraDisp, vista) {
    var GAP = 52, HL = 60, LH = 30, GAPV = 108, DESC = 42, n = m.nodes.length;
    var cols = Math.max(1, Math.min(n, Math.floor((larguraDisp - 2 * M + GAP) / (W + GAP))));
    var linhas = Math.ceil(n / cols);
    var largura = 2 * M + cols * W + (cols - 1) * GAP;
    var topo = M;
    var altura = topo + LH + linhas * HL + (linhas - 1) * GAPV + DESC + M;
    var svg = novoSvg(pai, largura, altura, "Lista com " + n + " itens",
      "Itens em sequência: " + m.nodes.map(function (x) { return x.id + (x.desc ? " (" + x.desc + ")" : ""); }).join(", ") + ". Nó atual: " + vista.atual.id + ".");
    var pos = m.nodes.map(function (_, i) {
      return { x: M + W / 2 + (i % cols) * (W + GAP), y: topo + LH + HL / 2 + Math.floor(i / cols) * (HL + GAPV) };
    });
    var gl = el("g", {}, svg), cur = null;
    for (var i = 0; i < n - 1; i++) {
      var a = pos[i], b = pos[i + 1], d;
      if (a.y === b.y) d = "M" + (a.x + W / 2 + 4) + "," + a.y + " L" + (b.x - W / 2 - 4) + "," + b.y;
      else {
        /* a volta de linha sai pela lateral, sem cruzar o id nem a description das caixas */
        var xr = a.x + W / 2, xl = b.x - W / 2, ym = a.y + HL / 2 + DESC + 20;
        d = "M" + (xr + 4) + "," + a.y + " L" + (xr + 24) + "," + a.y + " L" + (xr + 24) + "," + ym +
            " L" + (xl - 24) + "," + ym + " L" + (xl - 24) + "," + b.y + " L" + (xl - 4) + "," + b.y;
      }
      el("path", { "class": "aresta dupla", d: d, "marker-start": "url(#seta)", "marker-end": "url(#seta)" }, gl);
    }
    m.nodes.forEach(function (no, i) {
      var atual = no === vista.atual;
      caixaLista(svg, no, pos[i].x, pos[i].y, HL, atual, no.id === m.start);
      if (no.desc) quebrar(no.desc, 22, 2).forEach(function (l, k) {
        txt(svg, "t-desc", pos[i].x, pos[i].y + HL / 2 + 22 + k * 16, l);
      });
      if (atual) cur = pos[i];
    });
    return { svg: svg, cx: cur.x, cy: cur.y, largura: largura };
  }

  /* ---------------- TREE ---------------- */
  function arvore(m, pai, vista) {
    var GX = 28, GY = 62, todos = [], profMax = 0;
    function medir(no, prof) {
      todos.push(no); no.prof = prof; if (prof > profMax) profMax = prof;
      var tot = 0;
      no.children.forEach(function (c, i) { medir(c, prof + 1); tot += c.w + (i ? GX : 0); });
      no.total = tot; no.w = Math.max(W, tot);
    }
    function posicionar(no, esq) {
      if (!no.children.length) { no.x = esq + no.w / 2; return; }
      var cl = esq + (no.w - no.total) / 2;
      no.children.forEach(function (c) { posicionar(c, cl); cl += c.w + GX; });
      no.x = (no.children[0].x + no.children[no.children.length - 1].x) / 2;
    }
    medir(m.root, 0); posicionar(m.root, 0);
    var largura = m.root.w + 2 * M, altura = 2 * M + (profMax + 1) * H + profMax * GY;
    var svg = novoSvg(pai, largura, altura, "Árvore com " + todos.length + " nós",
      "Árvore com raiz " + m.root.id + ", " + todos.length + " nós e " + (profMax + 1) + " níveis. O nó inicial é " + m.start + ".");
    var gl = el("g", {}, svg), cur = null;
    function cy(no) { return M + H / 2 + no.prof * (H + GY); }
    todos.forEach(function (no) {
      no.children.forEach(function (c) {
        var x1 = M + no.x, y1 = cy(no) + H / 2, x2 = M + c.x, y2 = cy(c) - H / 2, ym = (y1 + y2) / 2;
        el("path", { "class": "aresta", d: "M" + x1 + "," + y1 + " C" + x1 + "," + ym + " " + x2 + "," + ym + " " + x2 + "," + (y2 - 2) }, gl);
      });
    });
    todos.forEach(function (no) {
      var atual = no === vista.atual;
      caixa(svg, no, M + no.x, cy(no), atual, no.id === m.start);
      if (atual) cur = { x: M + no.x, y: cy(no) };
    });
    return { svg: svg, cx: cur.x, cy: cur.y, largura: largura };
  }

  /* ---------------- GRAPH ---------------- */
  function posicoes(n, arestas) {
    var K = 230, x = [], y = [], i, j, it;
    var R = Math.max(K, K * n / 6.28);
    for (i = 0; i < n; i++) {
      x.push(R * Math.cos(2 * Math.PI * i / n) + Math.sin(i * 12.9898) * 6);
      y.push(R * Math.sin(2 * Math.PI * i / n) + Math.cos(i * 78.233) * 6);
    }
    if (n === 1) { x[0] = 0; y[0] = 0; }
    var pares = {}, lista = [];
    arestas.forEach(function (e) {
      if (e.a === e.b) return;
      var k = Math.min(e.a, e.b) + "-" + Math.max(e.a, e.b);
      if (!pares[k]) { pares[k] = 1; lista.push([e.a, e.b]); }
    });
    var ITER = 300;
    for (it = 0; it < ITER && n > 1; it++) {
      var t = 160 * (1 - it / ITER) + 1, dx_ = [], dy_ = [];
      for (i = 0; i < n; i++) { dx_.push(0); dy_.push(0); }
      for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
        var dx = x[i] - x[j], dy = y[i] - y[j], d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
        if (d > 2 * K) continue; /* alcance limitado: nós isolados não fogem */
        var f = K * K / d;
        dx_[i] += dx / d * f; dy_[i] += dy / d * f; dx_[j] -= dx / d * f; dy_[j] -= dy / d * f;
      }
      lista.forEach(function (p) {
        var a = p[0], b = p[1], dx = x[a] - x[b], dy = y[a] - y[b], d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01), f = d * d / K;
        dx_[a] -= dx / d * f; dy_[a] -= dy / d * f; dx_[b] += dx / d * f; dy_[b] += dy / d * f;
      });
      for (i = 0; i < n; i++) {
        dx_[i] -= x[i] * 0.15; dy_[i] -= y[i] * 0.15;
        var dd = Math.sqrt(dx_[i] * dx_[i] + dy_[i] * dy_[i]);
        if (dd > 0) { var s = Math.min(dd, t) / dd; x[i] += dx_[i] * s; y[i] += dy_[i] * s; }
      }
    }
    /* separa caixas que ainda se sobrepõem */
    for (it = 0; it < 80; it++) {
      var mexeu = false;
      for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
        var ox = (W + 70) - Math.abs(x[i] - x[j]), oy = (H + 56) - Math.abs(y[i] - y[j]);
        if (ox > 0 && oy > 0) {
          mexeu = true;
          if (ox < oy) { var sx = (x[i] < x[j] ? -1 : 1) * ox / 2; x[i] += sx; x[j] -= sx; }
          else { var sy = (y[i] < y[j] ? -1 : 1) * oy / 2; y[i] += sy; y[j] -= sy; }
        }
      }
      if (!mexeu) break;
    }
    return { x: x, y: y };
  }

  /* ponto onde o raio (centro → alvo) cruza a borda da caixa */
  function borda(cx, cy, tx, ty, folga) {
    var dx = tx - cx, dy = ty - cy;
    if (!dx && !dy) return { x: cx, y: cy };
    var hw = W / 2 + folga, hh = H / 2 + folga;
    var s = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
    return { x: cx + dx * s, y: cy + dy * s };
  }

  function grafo(m, pai, vista) {
    var n = m.nodes.length, idx = {};
    m.nodes.forEach(function (no, i) { if (!(no.id in idx)) idx[no.id] = i; });
    var arestas = [];
    m.edges.forEach(function (e) {
      if (e.from in idx && e.to in idx) arestas.push({ a: idx[e.from], b: idx[e.to], w: e.weight, src: e });
    });
    var p = m._pos || (m._pos = posicoes(n, arestas)), X = p.x, Y = p.y; /* layout calculado uma vez por arquivo */

    /* curvatura: separa arestas paralelas e de sentidos opostos */
    var grupos = {};
    arestas.forEach(function (e) {
      var k = e.a + ">" + e.b; (grupos[k] = grupos[k] || []).push(e);
    });
    var loops = {}, lado = {};
    /* lado do laço: oposto à direção média dos vizinhos (ângulo de giro: 0 topo, 90 direita, 180 base, 270 esquerda) */
    function ladoDoLaco(k) {
      if (k in lado) return lado[k];
      var viz = {}, melhor = 0, menor = Infinity;
      arestas.forEach(function (e) {
        if (e.a === e.b) return;
        var o = e.a === k ? e.b : (e.b === k ? e.a : -1);
        if (o >= 0) viz[o] = true;
      });
      /* fica com o lado (topo, direita, base, esquerda) mais afastado de todos os vizinhos */
      [[0, 0, -1], [90, 1, 0], [180, 0, 1], [270, -1, 0]].forEach(function (c) {
        var pior = -2;
        Object.keys(viz).forEach(function (o) {
          var dx = X[o] - X[k], dy = Y[o] - Y[k], d = Math.sqrt(dx * dx + dy * dy) || 1;
          pior = Math.max(pior, (dx * c[1] + dy * c[2]) / d);
        });
        if (pior < menor) { menor = pior; melhor = c[0]; }
      });
      return (lado[k] = melhor);
    }
    var geo = arestas.map(function (e) {
      if (e.a === e.b) {
        var j = loops[e.a] = (loops[e.a] || 0) + 1, h = 40 + (j - 1) * 22, ang = ladoDoLaco(e.a);
        var D = (ang === 90 || ang === 270) ? W / 2 : H / 2, r = ang * Math.PI / 180, cx0 = X[e.a], cy0 = Y[e.a];
        /* u = deslocamento lateral, v = distância para fora a partir do centro */
        var pt = function (u, v) { return { x: cx0 + u * Math.cos(r) + v * Math.sin(r), y: cy0 + u * Math.sin(r) - v * Math.cos(r) }; };
        var p0 = pt(-24, D), c1 = pt(-38, D + h * 1.35), c2 = pt(38, D + h * 1.35), p1 = pt(24, D + 3), lab = pt(0, D + h + 2), alto = pt(0, D + h * 1.05 + 14);
        return { loop: true, d: "M" + p0.x + "," + p0.y + " C" + c1.x + "," + c1.y + " " + c2.x + "," + c2.y + " " + p1.x + "," + p1.y,
                 lx: lab.x, ly: lab.y, w: e.w, ext: [alto, lab] };
      }
      var g = grupos[e.a + ">" + e.b], i = g.indexOf(e);
      var oposta = !!grupos[e.b + ">" + e.a];
      var off = oposta ? 34 + i * 34 : (i - (g.length - 1) / 2) * 34;
      var mx = (X[e.a] + X[e.b]) / 2, my = (Y[e.a] + Y[e.b]) / 2, dx = X[e.b] - X[e.a], dy = Y[e.b] - Y[e.a], d = Math.sqrt(dx * dx + dy * dy) || 1;
      var cx = mx + (-dy / d) * off * 2, cy = my + (dx / d) * off * 2;
      var p0 = borda(X[e.a], Y[e.a], cx, cy, 2), p1 = borda(X[e.b], Y[e.b], cx, cy, 5);
      return { d: "M" + p0.x + "," + p0.y + " Q" + cx + "," + cy + " " + p1.x + "," + p1.y,
               lx: 0.25 * p0.x + 0.5 * cx + 0.25 * p1.x, ly: 0.25 * p0.y + 0.5 * cy + 0.25 * p1.y, w: e.w };
    });

    geo.forEach(function (g, i) { g.src = arestas[i].src; });

    /* limites do desenho */
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, i;
    for (i = 0; i < n; i++) {
      minX = Math.min(minX, X[i] - W / 2); maxX = Math.max(maxX, X[i] + W / 2);
      minY = Math.min(minY, Y[i] - H / 2); maxY = Math.max(maxY, Y[i] + H / 2);
    }
    geo.forEach(function (g) {
      (g.ext || [{ x: g.lx, y: g.ly }]).forEach(function (p) {
        minX = Math.min(minX, p.x - 30); maxX = Math.max(maxX, p.x + 30);
        minY = Math.min(minY, p.y - 16); maxY = Math.max(maxY, p.y + 16);
      });
    });
    minY -= 20; /* espaço para o selo "start" */
    var tx = M - minX, ty = M - minY;
    var largura = Math.ceil(maxX - minX + 2 * M), altura = Math.ceil(maxY - minY + 2 * M);

    var svg = novoSvg(pai, largura, altura, "Grafo com " + n + " nós e " + arestas.length + " arestas",
      "Grafo direcionado com os nós " + m.nodes.map(function (x) { return x.id; }).join(", ") + " e " + arestas.length + " arestas. O nó inicial é " + m.start + ".");
    var raiz = el("g", { transform: "translate(" + tx + "," + ty + ")" }, svg);
    var gArestas = el("g", {}, raiz);
    var escolhida = null;
    geo.forEach(function (g) {
      if (g.src === vista.sel) { escolhida = g; return; }
      el("path", { "class": "aresta", d: g.d, "marker-end": "url(#seta)" }, gArestas);
    });
    if (escolhida) el("path", { "class": "aresta sel", d: escolhida.d, "marker-end": "url(#seta-sel)" }, gArestas);
    var cur = null;
    m.nodes.forEach(function (no, i) {
      var atual = no === vista.atual;
      caixa(raiz, no, X[i], Y[i], atual, no.id === m.start, no === vista.proximo);
      if (atual) cur = { x: X[i] + tx, y: Y[i] + ty };
    });
    var gPesos = el("g", {}, raiz);
    geo.forEach(function (g) {
      var s = String(g.w), w = 14 + s.length * 8;
      el("rect", { "class": "peso-bg", x: g.lx - w / 2, y: g.ly - 11, width: w, height: 22, rx: 11 }, gPesos);
      txt(gPesos, "t-peso", g.lx, g.ly + 4, s);
    });
    return { svg: svg, cx: cur.x, cy: cur.y, largura: largura };
  }

  /* ---------------- API ---------------- */
  var NOMES = { tree: "árvore", list: "lista", graph: "grafo" };

  /* vista: { atual, sel, proximo }. primeira: centraliza o nó atual; nas demais, mantém a rolagem
     e só rola se o nó atual sair da área visível. */
  function desenhar(m, container, vista, primeira) {
    var sl = primeira ? 0 : container.scrollLeft, st = primeira ? 0 : container.scrollTop;
    var disp = container.clientWidth || 600;       /* mede antes de mexer no conteúdo */
    var tmp = document.createElement("div"), r = null;  /* desenha fora da página e troca de uma vez, sem a página "encolher" */
    if (m.nodes.length > 400) {
      var p = document.createElement("p");
      p.textContent = "A estrutura tem " + m.nodes.length + " nós, o que é grande demais para desenhar aqui (limite: 400).";
      tmp.appendChild(p);
    } else if (m.type === "list") r = lista(m, tmp, disp, vista);
    else if (m.type === "tree") r = arvore(m, tmp, vista);
    else r = grafo(m, tmp, vista);
    container.replaceChildren.apply(container, Array.prototype.slice.call(tmp.childNodes));
    if (!r) return;
    container.scrollLeft = sl; container.scrollTop = st;
    var cw = container.clientWidth, ch = container.clientHeight;
    if (primeira || r.cx - W / 2 - 24 < container.scrollLeft || r.cx + W / 2 + 24 > container.scrollLeft + cw)
      container.scrollLeft = Math.max(0, r.cx - cw / 2);
    if (primeira || r.cy - H / 2 - 40 < container.scrollTop || r.cy + H / 2 + 56 > container.scrollTop + ch)
      container.scrollTop = Math.max(0, r.cy - ch / 2);
  }

  window.ACMLDesenho = { desenhar: desenhar, nomes: NOMES };
})();
