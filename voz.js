/* Vocalização pelo próprio navegador (Web Speech API / speechSynthesis).
   Não depende de leitor de tela: a página fala o <value> de cada nó a cada movimento. */
(function () {
  "use strict";
  var disponivel = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  var ligada = true, taxa = 1, lang = "pt-BR", voz = null, aoBloquear = null;

  /* Escolhe a voz do idioma do arquivo (xml:lang): primeiro a exata (pt-BR), depois qualquer pt. */
  function escolherVoz() {
    voz = null;
    if (!disponivel) return;
    var alvo = lang.toLowerCase().replace("_", "-"), base = alvo.split("-")[0], exata = null, parcial = null;
    speechSynthesis.getVoices().forEach(function (v) {
      var vl = String(v.lang).toLowerCase().replace("_", "-");
      if (!exata && vl === alvo) exata = v;
      if (!parcial && vl.split("-")[0] === base) parcial = v;
    });
    voz = exata || parcial;
  }
  if (disponivel) {
    /* as vozes costumam chegar depois do carregamento da página */
    if ("onvoiceschanged" in speechSynthesis) speechSynthesis.onvoiceschanged = escolherVoz;
    escolherVoz();
  }

  function parar() { if (disponivel) speechSynthesis.cancel(); }

  function falar(texto) {
    if (!disponivel || !ligada || !texto) return;
    parar();
    var u = new SpeechSynthesisUtterance(texto);
    u.lang = lang;
    if (voz) u.voice = voz;
    u.rate = taxa;
    /* Alguns navegadores só liberam a voz depois de um clique ou tecla do usuário. */
    u.onerror = function (e) { if (e.error === "not-allowed" && aoBloquear) aoBloquear(); };
    speechSynthesis.speak(u);
  }

  window.Voz = {
    disponivel: disponivel,
    falar: falar,
    parar: parar,
    configurar: function (idioma) { lang = idioma || "pt-BR"; escolherVoz(); },
    ligar: function (sim) { ligada = !!sim; if (!ligada) parar(); },
    estaLigada: function () { return ligada; },
    velocidade: function (n) { taxa = n > 0 ? n : 1; },
    quandoBloqueada: function (fn) { aoBloquear = fn; }
  };
})();
