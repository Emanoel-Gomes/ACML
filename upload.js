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

  var NS = "http://acml.example.org/1.0";
  var ALVO = location.protocol === "file:" ? "*" : location.origin;
  var selectedFile = null;   /* arquivo escolhido */
  var textoArquivo = null;   /* conteúdo lido */
  var falhou = false;        /* a verificação local encontrou falhas */
  var janela = null;         /* guia de resultado */
  var pendente = null;       /* o que a guia de resultado vai receber */

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
    resultado.hidden = true; lista.innerHTML = "";
    selectedFile = null; textoArquivo = null; pendente = null; falhou = false;
    uploadBtn.disabled = true;
    if (!/\.acml$/i.test(file.name)) {
      showMessage("Formato não suportado. Envie um arquivo .acml.", true);
      return;
    }
    selectedFile = file;
    showMessage(file.name + " (" + formatar(file.size) + ")");
    var leitor = new FileReader();
    leitor.onerror = function () { showMessage("Não foi possível ler o arquivo.", true); };
    leitor.onload = function () {
      textoArquivo = String(leitor.result);
      uploadBtn.disabled = false;
      var itens = verificar(textoArquivo);
      falhou = itens.some(function (i) { return !i[0]; });
      if (falhou) {
        /* com falhas, mostra a lista aqui e deixa o usuário decidir se abre mesmo assim */
        mostrar(itens);
        showMessage(file.name + " (" + formatar(file.size) + "). O arquivo tem falhas, veja abaixo. Você ainda pode abrir o resultado.", true);
      } else {
        abrirResultado();
      }
    };
    leitor.readAsText(file, "UTF-8");
  }

  /* Abre (ou reaproveita) a guia "resultado.html" e entrega o arquivo a ela. */
  function abrirResultado() {
    if (!selectedFile || textoArquivo === null) return;
    var base = selectedFile.name + " (" + formatar(selectedFile.size) + ")";
    pendente = { tipo: "acml-dados", nome: selectedFile.name, texto: textoArquivo, falhas: falhou };
    janela = window.open("resultado.html", "acml-resultado");
    if (janela) showMessage(base + ". Resultado aberto em uma nova guia.", falhou);
    else showMessage(base + ". O navegador bloqueou a nova guia. Clique em “Abrir resultado”.", true);
  }

  /* A guia de resultado avisa quando carregou; só então recebe o arquivo. */
  window.addEventListener("message", function (e) {
    if (!janela || e.source !== janela || !pendente) return;
    if (ALVO !== "*" && e.origin !== ALVO) return;
    if (e.data && e.data.tipo === "acml-pronto") janela.postMessage(pendente, ALVO);
  });

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
      return itens;
    }
    ok("XML bem formado.");

    var raiz = doc.documentElement;
    if (raiz.namespaceURI !== NS || raiz.localName !== "acml") {
      falha("O elemento raiz deve ser <acml> no namespace " + NS + ".");
      return itens;
    }
    ok("Elemento raiz <acml> no namespace correto.");

    raiz.getAttribute("version") === "1.0" ? ok('version="1.0".') : falha('O atributo version deve ser "1.0".');
    var lang = raiz.getAttributeNS("http://www.w3.org/XML/1998/namespace", "lang");
    lang ? ok('xml:lang="' + lang + '".') : falha("Falta o atributo xml:lang.");

    var sts = filhos(raiz, "structure");
    if (sts.length !== 1) { falha("O <acml> deve ter exatamente uma <structure>."); return itens; }
    var st = sts[0], tipo = st.getAttribute("type"), start = st.getAttribute("start");
    if (["tree", "list", "graph"].indexOf(tipo) < 0) { falha('type deve ser "tree", "list" ou "graph".'); return itens; }
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
    return itens;
  }

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
    selectedFile = null; textoArquivo = null; pendente = null; falhou = false;
    input.value = ""; showMessage(""); uploadBtn.disabled = true;
    resultado.hidden = true; lista.innerHTML = "";
  });

  uploadBtn.addEventListener("click", abrirResultado);

  /* ---- Exemplos prontos: abrem direto o resultado em uma nova guia ---- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-exemplo]"), function (btn) {
    btn.addEventListener("click", function () {
      var ex = window.ACML_EXEMPLOS && window.ACML_EXEMPLOS[btn.getAttribute("data-exemplo")];
      if (!ex) return;
      selectedFile = null; textoArquivo = null; falhou = false;
      input.value = ""; uploadBtn.disabled = true;
      resultado.hidden = true; lista.innerHTML = "";
      pendente = { tipo: "acml-dados", nome: ex.nome, texto: ex.texto, falhas: false };
      janela = window.open("resultado.html", "acml-resultado");
      if (janela) showMessage(ex.nome + ". Resultado aberto em uma nova guia.");
      else showMessage("O navegador bloqueou a nova guia. Permita pop-ups e clique no exemplo de novo.", true);
    });
  });
})();
