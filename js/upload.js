(function () {
  "use strict";
  var dropzone  = document.getElementById("dropzone");
  var input     = document.getElementById("fileInput");
  var browseBtn = document.getElementById("browseBtn");
  var fileName  = document.getElementById("fileName");
  var cancelBtn = document.getElementById("cancelBtn");
  var uploadBtn = document.getElementById("uploadBtn");
  var resultado = document.getElementById("resultado");
  var lista     = document.getElementById("listaResultado");
  var vizSec    = document.getElementById("visualizacao");
  var vizInfo   = document.getElementById("vizInfo");
  var vizTela   = document.getElementById("vizTela");
  var vizCab    = document.getElementById("vizCab");

  var NS = "http://acml.example.org/1.0";
  var selectedFile = null;
  var modelo = null;

  browseBtn.addEventListener("click", function () { input.click(); });
  input.addEventListener("change", function () { handleFile(input.files[0]); });

  ["dragenter", "dragover"].forEach(function (evt) {
    dropzone.addEventListener(evt, function (e) { e.preventDefault(); dropzone.classList.add("dragover"); });
  });
  ["dragleave", "drop"].forEach(function (evt) {
    dropzone.addEventListener(evt, function (e) { e.preventDefault(); dropzone.classList.remove("dragover"); });
  });
  dropzone.addEventListener("drop", function (e) { handleFile(e.dataTransfer.files[0]); });

  function showMessage(text, erro) {
    fileName.classList.toggle("erro", !!erro);
    fileName.textContent = text;
  }

  function handleFile(file) {
    if (!file) return;
    resultado.hidden = true;
    limparDesenho();
    if (!/\.acml$/i.test(file.name)) {
      showMessage("Formato não suportado. Envie um arquivo .acml.", true);
      selectedFile = null; uploadBtn.disabled = true;
      return;
    }
    selectedFile = file;
    showMessage(file.name + " (" + formatar(file.size) + ")");
    uploadBtn.disabled = false;
    var leitor = new FileReader();
    leitor.onload = function () { verificar(String(leitor.result)); };
    leitor.readAsText(file, "UTF-8");
  }

  function formatar(b) { return b < 1024 ? b + " B" : (b / 1024).toFixed(1) + " KB"; }

  /* ---- Verificação local, com as regras da documentação ---- */
  function filhos(el, nome) {
    return Array.prototype.filter.call(el.children, function (c) { return c.namespaceURI === NS && c.localName === nome; });
  }
  function verificar(texto) {
    var itens = [];
    function ok(t) { itens.push([true, t]); }
    function falha(t) { itens.push([false, t]); }

    var doc = new DOMParser().parseFromString(texto, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) {
      falha("O arquivo não é um XML bem formado.");
      return mostrar(itens);
    }
    ok("XML bem formado.");

    var raiz = doc.documentElement;
    if (raiz.namespaceURI !== NS || raiz.localName !== "acml") {
      falha("O elemento raiz deve ser <acml> no namespace " + NS + ".");
      return mostrar(itens);
    }
    ok("Elemento raiz <acml> no namespace correto.");

    raiz.getAttribute("version") === "1.0" ? ok('version="1.0".') : falha('O atributo version deve ser "1.0".');
    var lang = raiz.getAttributeNS("http://www.w3.org/XML/1998/namespace", "lang");
    lang ? ok('xml:lang="' + lang + '".') : falha("Falta o atributo xml:lang.");

    var sts = filhos(raiz, "structure");
    if (sts.length !== 1) { falha("O <acml> deve ter exatamente uma <structure>."); return mostrar(itens); }
    var st = sts[0], tipo = st.getAttribute("type"), start = st.getAttribute("start");
    if (["tree", "list", "graph"].indexOf(tipo) < 0) { falha('type deve ser "tree", "list" ou "graph".'); return mostrar(itens); }
    ok('Estrutura do tipo "' + tipo + '".');

    var desc = filhos(st, "description")[0];
    desc && /^[^\n\r]*[.!?]$/.test(desc.textContent) ? ok("<description> é uma frase terminada em ., ! ou ?.") : falha("<description> ausente ou sem frase terminada em ., ! ou ?.");

    var node = filhos(st, "node"), nodes = filhos(st, "nodes"), edges = filhos(st, "edges");
    var r1;
    if (tipo === "tree") r1 = node.length === 1 && !nodes.length && !edges.length;
    else if (tipo === "list") r1 = nodes.length === 1 && !node.length && !edges.length;
    else r1 = nodes.length === 1 && !node.length;
    r1 ? ok("Regra 1: o conteúdo combina com o type.") : falha("Regra 1: o conteúdo não combina com type=\"" + tipo + "\" (tree usa <node>; list usa <nodes>; graph usa <nodes> e <edges>).");

    var todos = Array.prototype.slice.call(st.getElementsByTagNameNS(NS, "node"));
    var ids = {}, dup = [], semValue = 0, valorRuim = 0;
    todos.forEach(function (n) {
      var id = n.getAttribute("id");
      if (!id || !/^[A-Za-z_][\w.\-]*$/.test(id)) falha('Id inválido: "' + id + '" (sem espaços e sem começar por dígito).');
      if (ids[id]) dup.push(id); ids[id] = true;
      var v = filhos(n, "value");
      if (v.length !== 1) semValue++;
      else if (!/^[^\n\r]*[.!?]$/.test(v[0].textContent)) valorRuim++;
    });
    dup.length ? falha("Ids repetidos: " + dup.join(", ") + ".") : ok("Todos os id são únicos (" + todos.length + " nós).");
    semValue ? falha(semValue + " nó(s) sem exatamente um <value>.") : ok("Todo nó tem um <value>.");
    valorRuim ? falha(valorRuim + " <value> sem frase terminada em ., ! ou ?.") : ok("Todo <value> é uma frase terminada em ., ! ou ?.");

    ids[start] ? ok('Regra 2: start="' + start + '" é um nó existente.') : falha('Regra 2: start="' + start + '" não é o id de nenhum nó.');

    if (tipo === "graph" && edges.length) {
      var arestas = filhos(edges[0], "edge"), ruins = [];
      if (!arestas.length) falha("<edges> precisa de pelo menos uma <edge>.");
      arestas.forEach(function (e) {
        if (!ids[e.getAttribute("from")]) ruins.push("from=\"" + e.getAttribute("from") + "\"");
        if (!ids[e.getAttribute("to")]) ruins.push("to=\"" + e.getAttribute("to") + "\"");
        if (!/^[+-]?\d+$/.test(e.getAttribute("weight") || "")) ruins.push("weight=\"" + e.getAttribute("weight") + "\"");
      });
      ruins.length ? falha("Arestas com referência ou peso inválido: " + ruins.join(", ") + ".") : ok(arestas.length + " aresta(s) com from, to e weight válidos.");
    }
    mostrar(itens);
    var temFalha = itens.some(function (i) { return !i[0]; });
    desenhar(construir(st, tipo, start), temFalha);
  }

  /* ---- Lê o type, o start e os nós/arestas para montar o desenho ---- */
  function descDe(n) { var d = filhos(n, "description")[0]; return d ? d.textContent.trim() : ""; }
  function valorDe(n) { var v = filhos(n, "value")[0]; return v ? v.textContent.trim() : ""; }
  function construir(st, tipo, start) {
    var d = filhos(st, "description")[0];
    var m = { type: tipo, start: start, description: d ? d.textContent.trim() : "", nodes: [], root: null, edges: [] };
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

  var DICAS = {
    list: "Clique no desenho e use ← → para navegar entre os itens.",
    tree: "Clique no desenho e use ← → entre nós do mesmo pai, ↓ para descer e ↑ para subir.",
    graph: "Clique no desenho e use ↑ ↓ para escolher a saída, → para segui-la e ← para voltar."
  };
  function desenhar(m, temFalha) {
    modelo = m;
    if (!m) { vizSec.hidden = true; return; }
    vizSec.hidden = false;
    var achou = window.ACMLNav.iniciar(m, vizTela, vizCab);
    var avisos = [];
    if (!achou) avisos.push('O start "' + m.start + '" não existe; a navegação começa no primeiro nó.');
    if (temFalha) avisos.push("O arquivo tem falhas na verificação; o desenho mostra o que foi possível ler.");
    vizInfo.textContent = DICAS[m.type] + (avisos.length ? " " + avisos.join(" ") : "");
  }
  function limparDesenho() { modelo = null; window.ACMLNav.parar(); vizSec.hidden = true; vizTela.innerHTML = ""; vizInfo.textContent = ""; }

  /* A lista é redesenhada ao mudar a largura da janela (quebra de linhas). */
  var temporizador;
  window.addEventListener("resize", function () {
    clearTimeout(temporizador);
    temporizador = setTimeout(function () {
      if (modelo && modelo.type === "list" && !vizSec.hidden) window.ACMLNav.redesenhar();
    }, 150);
  });

  function mostrar(itens) {
    lista.innerHTML = "";
    itens.forEach(function (i) {
      var li = document.createElement("li");
      if (!i[0]) li.className = "falha";
      li.appendChild(document.createTextNode((i[0] ? "Passou: " : "Falhou: ") + i[1]));
      lista.appendChild(li);
    });
    resultado.hidden = false;
  }

  cancelBtn.addEventListener("click", function () {
    selectedFile = null; input.value = ""; showMessage(""); uploadBtn.disabled = true;
    resultado.hidden = true; lista.innerHTML = ""; limparDesenho();
  });

  uploadBtn.addEventListener("click", function () {
    if (!selectedFile) return;
    // Troque este trecho pelo envio real para o seu servidor:
    // const data = new FormData();
    // data.append('file', selectedFile);
    // fetch('/upload', { method: 'POST', body: data });
    showMessage('"' + selectedFile.name + '" enviado!');
  });
})();
