/* Navegação por setas sobre a estrutura desenhada.
   list : ← → anterior / próximo.
   tree : ← → entre irmãos (mesmo pai), ↓ primeiro filho, ↑ pai.
   graph: ↑ ↓ escolhem a saída, → segue a saída escolhida, ← volta pelo histórico (como na documentação). */
(function () {
  "use strict";
  var m = null, tela = null, cab = null, estado = null, falarFn = null;

  function preparar() {
    if (m.type === "tree") {
      (function ligar(no, pai) { no.pai = pai; no.children.forEach(function (c) { ligar(c, no); }); })(m.root, null);
    } else if (m.type === "graph") {
      var idx = {};
      m.nodes.forEach(function (no) { if (!(no.id in idx)) idx[no.id] = no; no.saidas = []; });
      m.edges.forEach(function (e) {
        if (e.from in idx && e.to in idx) idx[e.from].saidas.push({ e: e, alvo: idx[e.to] });
      });
    }
  }

  function vizinhos() {
    var c = estado.atual, r = { prox: null, ant: null, peso: null }, i;
    if (m.type === "list") {
      i = m.nodes.indexOf(c);
      r.prox = m.nodes[i + 1] || null; r.ant = m.nodes[i - 1] || null;
    } else if (m.type === "tree") {
      var irmaos = c.pai ? c.pai.children : [c];
      i = irmaos.indexOf(c);
      r.prox = irmaos[i + 1] || null; r.ant = irmaos[i - 1] || null;
    } else {
      var s = c.saidas;
      if (s.length) { r.prox = s[estado.sel].alvo; r.peso = s[estado.sel].e.weight; }
      r.ant = estado.hist.length ? estado.hist[estado.hist.length - 1] : null;
    }
    return r;
  }

  /* devolve "no" se o nó atual mudou, "saida" se (no grafo) só a saída escolhida mudou, ou false */
  function mover(tecla) {
    var c = estado.atual, v = vizinhos(), dir = tecla === "ArrowRight", esq = tecla === "ArrowLeft";
    if (m.type === "list") {
      var alvo = dir ? v.prox : (esq ? v.ant : null);
      if (alvo) { estado.atual = alvo; return "no"; }
    } else if (m.type === "tree") {
      var t = dir ? v.prox : esq ? v.ant : tecla === "ArrowDown" ? (c.children[0] || null) : tecla === "ArrowUp" ? c.pai : null;
      if (t) { estado.atual = t; return "no"; }
    } else {
      var s = c.saidas;
      if ((tecla === "ArrowDown" || tecla === "ArrowUp") && s.length > 1) {
        estado.sel = (estado.sel + (tecla === "ArrowDown" ? 1 : s.length - 1)) % s.length;
        return "saida";
      }
      if (dir && s.length) { estado.hist.push(c); estado.atual = s[estado.sel].alvo; estado.sel = 0; return "no"; }
      if (esq && estado.hist.length) { estado.atual = estado.hist.pop(); estado.sel = 0; return "no"; }
    }
    return false;
  }

  function linha(rotulo, valor) {
    var p = document.createElement("p"), b = document.createElement("strong");
    b.textContent = rotulo + ": ";
    p.appendChild(b);
    p.appendChild(document.createTextNode(valor));
    cab.appendChild(p);
  }
  function id(no, extra) { return no ? no.id + (extra || "") : "nenhum"; }

  /* Dados do nó atual, na mesma ordem do cabeçalho: [rótulo, valor]. É a fonte do cabeçalho e da voz. */
  function linhas() {
    var v = vizinhos(), c = estado.atual, out = [];
    out.push(["Nó atual", c.id]);
    out.push(["Descrição", c.desc || "nenhuma"]);
    if (m.type === "graph" && c.saidas.length) {
      /* todas as saídas, começando pela escolhida (a que está destacada no desenho) */
      var ss = c.saidas, n = ss.length;
      out.push([n > 1 ? "Próximos nós" : "Próximo nó", ss.map(function (_, k) {
        var x = ss[(estado.sel + k) % n];
        return x.alvo.id + " (peso " + x.e.weight + ")";
      }).join(", ")]);
    } else if (m.type === "tree") {
      /* próximo = filhos (↓), mais o irmão seguinte (→); anterior = pai (↑), mais o irmão anterior (←) */
      var pp = [], lados = [];
      if (c.children.length) pp.push(c.children.map(function (f) { return f.id; }).join(","));
      if (v.ant) lados.push(v.ant.id);
      if (v.prox) lados.push(v.prox.id);
      if (lados.length) pp.push((lados.length > 1 ? "nós ao lado: " : "nó ao lado: ") + lados.join(", "));
      out.push(["Próximo nó", pp.join(", ") || "nenhum"]);
      out.push(["Nó anterior", c.pai ? c.pai.id : "nenhum"]);
    } else out.push(["Próximo nó", id(v.prox)]);
    if (m.type !== "tree") out.push(["Nó anterior", id(v.ant)]);
    return out;
  }

  function render(primeira) {
    var v = vizinhos(), c = estado.atual, sel = null;
    if (m.type === "graph" && c.saidas.length) sel = c.saidas[estado.sel].e;
    /* segura a altura e a rolagem da página durante o redesenho, para a tela não "pular" */
    var px = window.pageXOffset, py = window.pageYOffset;
    cab.style.minHeight = cab.offsetHeight + "px";
    tela.style.minHeight = tela.offsetHeight + "px";
    cab.textContent = "";
    linha("Tipo", m.type + (m.description ? ", " + m.description : ""));
    linhas().forEach(function (l) { linha(l[0], l[1]); });
    window.ACMLDesenho.desenhar(m, tela, { atual: c, sel: sel, proximo: v.prox }, primeira);
    cab.style.minHeight = ""; tela.style.minHeight = "";
    if (!primeira) window.scrollTo(px, py);
  }

  /* ---------- Textos para a voz ---------- */
  function falar(texto) { if (falarFn && texto) falarFn(texto); }
  function pont(t) { t = String(t); return /[.!?]$/.test(t) ? t : t + "."; }
  function falaLinhas(ls) { return ls.map(function (l) { return l[0] + ": " + pont(l[1]); }).join(" "); }

  /* Fala exatamente o que o cabeçalho mostra:
     "Nó atual: i2. Descrição: segundo item. Próximo nó: i3. Nó anterior: i1." */
  function textoAtual() { return falaLinhas(linhas()); }

  /* "Tipo: list, Lista de três itens." */
  function tipoTexto() { return pont("Tipo: " + m.type + (m.description ? ", " + m.description : "")); }

  /* Grafo, ao trocar a saída com ↑ ↓: diz qual saída ficou escolhida e a lista de próximos nós */
  function textoSaida() {
    var x = estado.atual.saidas[estado.sel];
    var prox = linhas().filter(function (l) { return l[0].indexOf("Próximo") === 0; });
    return "Saída escolhida: " + x.alvo.id + " (peso " + x.e.weight + "). " + falaLinhas(prox);
  }

  /* Quando a tecla não leva a lugar nenhum */
  function textoLimite(k) {
    var c = estado.atual, dir = k === "ArrowRight", esq = k === "ArrowLeft", baixo = k === "ArrowDown";
    if (m.type === "list") return dir ? "Fim da lista." : "Início da lista.";
    if (m.type === "tree") {
      if (baixo) return "Este nó não tem filhos.";
      if (k === "ArrowUp") return "Este é o nó raiz.";
      return dir ? "Não há próximo nó ao lado." : "Não há nó anterior ao lado.";
    }
    if (esq) return "Não há nó anterior no histórico.";
    return c.saidas.length ? "Há apenas uma saída." : "Este nó não tem saídas.";
  }

  /* opcoes.falar(texto): chamada a cada movimento, com a frase a ser vocalizada.
     opcoes.focar === false: não põe o foco no desenho ao iniciar. */
  function iniciar(modelo, elTela, elCab, opcoes) {
    m = modelo; tela = elTela; cab = elCab;
    falarFn = (opcoes && opcoes.falar) || null;
    preparar();
    var inicio = null;
    m.nodes.forEach(function (n) { if (!inicio && n.id === m.start) inicio = n; });
    estado = { atual: inicio || (m.type === "tree" ? m.root : m.nodes[0]), sel: 0, hist: [] };
    render(true);
    if (!(opcoes && opcoes.focar === false)) tela.focus({ preventScroll: true });
    return !!inicio;
  }

  document.addEventListener("keydown", function (ev) {
    if (!m || !tela || !tela.contains(ev.target) && ev.target !== tela) return;
    if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    var k = ev.key;
    var usa = k === "ArrowLeft" || k === "ArrowRight" || (m.type !== "list" && (k === "ArrowUp" || k === "ArrowDown"));
    if (!usa) return;
    ev.preventDefault();
    var r = mover(k);
    if (r) { render(false); falar(r === "saida" ? textoSaida() : textoAtual()); }
    else falar(textoLimite(k));
  });

  window.ACMLNav = {
    iniciar: iniciar,
    redesenhar: function () { if (m && estado) render(false); },
    textoAtual: function () { return m && estado ? textoAtual() : ""; },
    tipoTexto: function () { return m ? tipoTexto() : ""; },
    parar: function () { m = null; estado = null; falarFn = null; if (cab) cab.textContent = ""; }
  };
})();
