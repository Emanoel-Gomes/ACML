/* Página de resultado: recebe o texto do .acml da guia de envio (postMessage),
   monta o modelo, desenha a estrutura e vocaliza a navegação. */
(function () {
  "use strict";
  var NS = "http://acml.example.org/1.0";
  var XMLNS = "http://www.w3.org/XML/1998/namespace";
  var CHAVE = "acml-ultimo";
  var ALVO = location.protocol === "file:" ? "*" : location.origin;

  var estadoEl = document.getElementById("estado");
  var nomeEl   = document.getElementById("nomeArquivo");
  var secao    = document.getElementById("visualizacao");
  var vizInfo  = document.getElementById("vizInfo");
  var vizTela  = document.getElementById("vizTela");
  var vizCab   = document.getElementById("vizCab");
  var vozBtn   = document.getElementById("vozBtn");
  var vozRep   = document.getElementById("vozRepetir");
  var velEl    = document.getElementById("vozVel");
  var velTxt   = document.getElementById("vozVelTxt");
  var velMenos = document.getElementById("velMenos");
  var velMais  = document.getElementById("velMais");
  var vozAviso = document.getElementById("vozAviso");

  var modelo = null, recebeu = false, calarFoco = false;

  /* Põe o foco na imagem sem disparar a fala "Imagem selecionada…" (a fala do momento é outra). */
  function focarImagem() {
    calarFoco = true;
    vizTela.focus({ preventScroll: true });
    calarFoco = false;
  }

  /* ---------- Leitura do XML ---------- */
  function filhos(el, nome) {
    return Array.prototype.filter.call(el.children, function (c) { return c.namespaceURI === NS && c.localName === nome; });
  }
  function descDe(n) { var d = filhos(n, "description")[0]; return d ? d.textContent.trim() : ""; }
  function valorDe(n) { var v = filhos(n, "value")[0]; return v ? v.textContent.trim() : ""; }

  function construir(st, tipo, start, lang) {
    var d = filhos(st, "description")[0];
    var m = { type: tipo, start: start, lang: lang, description: d ? d.textContent.trim() : "", nodes: [], root: null, edges: [] };
    if (tipo === "tree") {
      var r = filhos(st, "node")[0];
      if (!r) return null;
      m.root = (function ler(n) {
        var o = { id: n.getAttribute("id") || "", value: valorDe(n), desc: descDe(n), children: [] };
        m.nodes.push(o);
        filhos(n, "node").forEach(function (c) { o.children.push(ler(c)); });
        return o;
      })(r);
    } else {
      var ns = filhos(st, "nodes")[0];
      if (!ns) return null;
      filhos(ns, "node").forEach(function (n) { m.nodes.push({ id: n.getAttribute("id") || "", value: valorDe(n), desc: descDe(n) }); });
      var es = filhos(st, "edges")[0];
      if (tipo === "graph" && es) filhos(es, "edge").forEach(function (e) {
        m.edges.push({ from: e.getAttribute("from"), to: e.getAttribute("to"), weight: e.getAttribute("weight") });
      });
    }
    return m.nodes.length ? m : null;
  }

  /* ---------- Mensagens ---------- */
  function mensagem(texto, erro) {
    estadoEl.hidden = false;
    estadoEl.classList.toggle("erro", !!erro);
    estadoEl.textContent = texto;
  }

  var DICAS = {
    list: "Use ← → para navegar entre os itens.",
    tree: "Use ← → entre nós do mesmo pai, ↓ para descer e ↑ para subir.",
    graph: "Use ↑ ↓ para escolher a saída, → para segui-la e ← para voltar."
  };
  /* versão falada: sem símbolos de seta, que muitas vozes não leem */
  var FALA = {
    list: "Use as setas para a esquerda e para a direita para navegar entre os itens.",
    tree: "Use as setas para a esquerda e para a direita para andar entre nós do mesmo pai, a seta para baixo para descer e a seta para cima para subir.",
    graph: "Use as setas para cima e para baixo para escolher a saída, a seta para a direita para segui-la e a seta para a esquerda para voltar."
  };

  /* Instruções faladas (Backspace): tipo e descrição, como navegar e o que fazem as teclas. */
  function ajudaTexto() {
    return window.ACMLNav.tipoTexto() + " " + FALA[modelo.type] +
      " Pressione R para repetir a fala, Enter para ajustar a velocidade e Backspace para ouvir estas instruções.";
  }

  /* ---------- Carregar e desenhar ---------- */
  function carregar(dados) {
    recebeu = true;
    modelo = null;
    window.ACMLNav.parar();
    Voz.parar();
    secao.hidden = true;
    vizTela.innerHTML = "";
    nomeEl.textContent = dados.nome || "";

    var doc = new DOMParser().parseFromString(String(dados.texto || ""), "application/xml");
    var raiz = doc.documentElement;
    if (doc.getElementsByTagName("parsererror").length || !raiz || raiz.namespaceURI !== NS || raiz.localName !== "acml") {
      return mensagem("Não foi possível ler este arquivo como ACML. Volte à guia de envio e escolha outro arquivo.", true);
    }
    var sts = filhos(raiz, "structure");
    var st = sts[0], tipo = st && st.getAttribute("type");
    if (!st || ["tree", "list", "graph"].indexOf(tipo) < 0) {
      return mensagem("A estrutura do arquivo não pôde ser lida (type deve ser tree, list ou graph).", true);
    }
    var lang = raiz.getAttributeNS(XMLNS, "lang") || "pt-BR";
    var m = construir(st, tipo, st.getAttribute("start"), lang);
    if (!m) return mensagem("O arquivo não tem nós para desenhar.", true);

    modelo = m;
    estadoEl.hidden = true;
    secao.hidden = false;                 /* precisa estar visível para o desenho medir a largura */
    Voz.configurar(lang);
    var achou = window.ACMLNav.iniciar(m, vizTela, vizCab, { falar: Voz.falar, focar: false });
    focarImagem();                        /* já abre com a imagem selecionada */

    var avisos = [];
    if (!achou) avisos.push("O start “" + m.start + "” não existe; a navegação começa no primeiro nó.");
    if (dados.falhas) avisos.push("O arquivo tem falhas na verificação; o desenho mostra o que foi possível ler.");
    vizInfo.textContent = DICAS[m.type] + " R repete a fala, Enter ajusta a velocidade e Backspace repete as instruções." + (avisos.length ? " " + avisos.join(" ") : "");
    document.title = "Visualização – " + (dados.nome || "ACML");

    try { sessionStorage.setItem(CHAVE, JSON.stringify(dados)); } catch (e) {}
    /* ao abrir: tipo e descrição, instruções e, no fim, onde o usuário está (como o R) */
    Voz.falar(window.ACMLNav.tipoTexto() + " " + FALA[m.type] +
      " R repete a fala, Enter ajusta a velocidade e Backspace repete as instruções. " + window.ACMLNav.textoAtual());
  }

  /* ---------- Receber o arquivo da guia de envio ---------- */
  window.addEventListener("message", function (e) {
    if (!window.opener || e.source !== window.opener) return;
    if (ALVO !== "*" && e.origin !== ALVO) return;
    var d = e.data;
    if (d && d.tipo === "acml-dados" && typeof d.texto === "string") carregar(d);
  });

  function lerSalvo() {
    try { return JSON.parse(sessionStorage.getItem(CHAVE) || "null"); } catch (e) { return null; }
  }
  function semDados() {
    var salvo = lerSalvo();
    if (salvo) carregar(salvo);
    else mensagem("Não recebi nenhum arquivo. Volte à guia de envio e escolha um arquivo .acml.", true);
  }


  /* ---------- Controles de voz ---------- */
  var NIVEIS = [
    { v: 0.6,  n: "muito lenta" },
    { v: 0.8,  n: "lenta" },
    { v: 1,    n: "normal" },
    { v: 1.25, n: "rápida" },
    { v: 1.5,  n: "muito rápida" },
    { v: 1.8,  n: "máxima" }
  ];
  var nivel = 2;

  function mostrarAviso(texto) { vozAviso.textContent = texto || ""; vozAviso.hidden = !texto; }
  function maiuscula(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function nomeNivel() { return NIVEIS[nivel].n; }

  function lerPreferencias() {
    try {
      /* a velocidade sempre começa em "normal"; só o ajuste feito na página vale, sem lembrar da visita anterior */
      if (localStorage.getItem("acml-voz") === "off") Voz.ligar(false);
    } catch (e) {}
  }
  function gravarPreferencias() {
    try { localStorage.setItem("acml-voz", Voz.estaLigada() ? "on" : "off"); } catch (e) {}
  }

  function aplicarNivel() {
    Voz.velocidade(NIVEIS[nivel].v);
    velTxt.textContent = maiuscula(nomeNivel()) + " (" + String(NIVEIS[nivel].v).replace(".", ",") + "×)";
    velEl.setAttribute("aria-valuenow", String(nivel));
    velEl.setAttribute("aria-valuetext", maiuscula(nomeNivel()));
    gravarPreferencias();
  }

  /* delta +1 aumenta, -1 diminui; fala a nova velocidade já com ela aplicada */
  function mudarNivel(delta) {
    var novo = nivel + delta;
    if (novo < 0 || novo >= NIVEIS.length) {
      Voz.falar(delta > 0 ? "Esta é a velocidade máxima." : "Esta é a velocidade mínima.");
      return;
    }
    nivel = novo;
    aplicarNivel();
    Voz.falar("Velocidade: " + nomeNivel() + ".");
  }

  function atualizarBotao() {
    var on = Voz.estaLigada();
    vozBtn.setAttribute("aria-pressed", String(on));
    vozBtn.textContent = on ? "Voz: ligada" : "Voz: desligada";
    /* com a voz da página ligada, o leitor de tela não repete o cabeçalho */
    vizCab.setAttribute("aria-live", on ? "off" : "polite");
  }

  if (!Voz.disponivel) {
    vozBtn.disabled = vozRep.disabled = velMenos.disabled = velMais.disabled = true;
    velEl.setAttribute("aria-disabled", "true"); velEl.tabIndex = -1;
    vozBtn.setAttribute("aria-pressed", "false");
    vozBtn.textContent = "Voz indisponível";
    mostrarAviso("Este navegador não oferece voz sintetizada. O cabeçalho continua disponível para leitores de tela.");
    vizCab.setAttribute("aria-live", "polite");
  } else {
    lerPreferencias();
    aplicarNivel();
    atualizarBotao();

    /* Alguns navegadores só liberam a voz depois de uma tecla ou clique. */
    Voz.quandoBloqueada(function () {
      mostrarAviso("O navegador pede um toque antes de falar: pressione Backspace para ouvir as instruções.");
    });

    vozBtn.addEventListener("click", function () {
      Voz.ligar(!Voz.estaLigada());
      gravarPreferencias();
      atualizarBotao();
      if (Voz.estaLigada()) Voz.falar("Voz ligada.");
    });
    vozRep.addEventListener("click", function () {
      mostrarAviso("");
      if (modelo) Voz.falar(window.ACMLNav.textoAtual());
    });
    velMenos.addEventListener("click", function () { mudarNivel(-1); });
    velMais.addEventListener("click", function () { mudarNivel(1); });

    /* Selecionar a imagem: fala o nó atual. */
    vizTela.addEventListener("focus", function () {
      if (modelo && !calarFoco) { mostrarAviso(""); Voz.falar("Imagem selecionada. " + window.ACMLNav.textoAtual()); }
    });

    /* Controle de velocidade: ← → mudam, Enter confirma. Nele as setas não navegam pela estrutura. */
    velEl.addEventListener("focus", function () {
      Voz.falar("Velocidade atual: " + nomeNivel() + ". Use a seta para a direita para aumentar e a seta para a esquerda para diminuir. Pressione Enter para confirmar e voltar à imagem.");
    });
    velEl.addEventListener("keydown", function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var k = e.key;
      if (k === "ArrowRight" || k === "ArrowUp") { e.preventDefault(); mudarNivel(1); }
      else if (k === "ArrowLeft" || k === "ArrowDown") { e.preventDefault(); mudarNivel(-1); }
      else if (k === "Enter") {
        e.preventDefault();
        if (e.repeat) return;
        focarImagem();
        Voz.falar("Velocidade confirmada: " + nomeNivel() + ". De volta à imagem: use as setas para navegar.");
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var k = e.key;

      /* Backspace, em qualquer lugar da página: fala as instruções e devolve o foco à imagem. */
      if (k === "Backspace") {
        e.preventDefault();
        if (!modelo) return;
        mostrarAviso("");
        focarImagem();
        Voz.falar(ajudaTexto() + " " + window.ACMLNav.textoAtual());
        return;
      }

      /* Com a imagem selecionada: R repete, Enter abre o ajuste de velocidade. */
      if (!(vizTela.contains(e.target) || e.target === vizTela) || !modelo) return;
      if (k === "r" || k === "R") {
        e.preventDefault();
        mostrarAviso("");
        Voz.falar(window.ACMLNav.textoAtual());
      } else if (k === "Enter") {
        e.preventDefault();
        if (!e.repeat) velEl.focus({ preventScroll: true });
      }
    });
  }

  /* A lista é redesenhada ao mudar a largura da janela (quebra de linhas). */
  var temporizador;
  window.addEventListener("resize", function () {
    clearTimeout(temporizador);
    temporizador = setTimeout(function () {
      if (modelo && modelo.type === "list" && !secao.hidden) window.ACMLNav.redesenhar();
    }, 150);
  });

  /* Só começa depois de os controles de voz (velocidade, voz ligada/desligada) estarem prontos. */
  if (window.opener && !window.opener.closed) {
    try { window.opener.postMessage({ tipo: "acml-pronto" }, ALVO); } catch (e) {}
    setTimeout(function () { if (!recebeu) semDados(); }, 1500);
  } else {
    semDados();
  }
})();
