(function () {
  "use strict";

  /* ---------- Menu no celular ---------- */
  var menuBtn = document.getElementById("menu-btn");
  var sidebar = document.getElementById("sidebar");
  function fecharMenu() {
    sidebar.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
  }
  menuBtn.addEventListener("click", function () {
    var aberto = sidebar.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(aberto));
  });
  sidebar.addEventListener("click", function (e) { if (e.target.closest("a")) fecharMenu(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") fecharMenu(); });

  /* ---------- Botão copiar ---------- */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".copy");
    if (!btn) return;
    var texto = btn.closest(".code").querySelector("pre").textContent;
    function ok() {
      btn.textContent = "Copiado!";
      setTimeout(function () { btn.textContent = "Copiar"; }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(ok, falhou);
    } else { falhou(); }
    function falhou() {
      var ta = document.createElement("textarea");
      ta.value = texto; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); ok(); } catch (err) {}
      document.body.removeChild(ta);
    }
  });

  /* ---------- Abas (tree / list / graph) ---------- */
  var abas = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  function ativar(aba, foco) {
    abas.forEach(function (a) {
      var sel = a === aba;
      a.setAttribute("aria-selected", String(sel));
      a.tabIndex = sel ? 0 : -1;
      document.getElementById(a.getAttribute("aria-controls")).hidden = !sel;
    });
    if (foco) aba.focus();
  }
  abas.forEach(function (aba, i) {
    aba.addEventListener("click", function () { ativar(aba); });
    aba.addEventListener("keydown", function (e) {
      var j = null;
      if (e.key === "ArrowRight") j = (i + 1) % abas.length;
      else if (e.key === "ArrowLeft") j = (i - 1 + abas.length) % abas.length;
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = abas.length - 1;
      if (j !== null) { e.preventDefault(); ativar(abas[j], true); }
    });
  });

  /* ---------- Índice: destacar a seção atual ---------- */
  var links = Array.prototype.slice.call(sidebar.querySelectorAll("a"));
  var alvos = links.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); });
  function marcar() {
    var atual = -1, limite = window.scrollY + 110;
    alvos.forEach(function (el, i) { if (el && el.offsetParent !== null && el.getBoundingClientRect().top + window.scrollY <= limite) atual = i; });
    links.forEach(function (a, i) {
      var on = i === atual;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
    });
  }
  var tick = false;
  window.addEventListener("scroll", function () {
    if (tick) return; tick = true;
    requestAnimationFrame(function () { marcar(); tick = false; });
  }, { passive: true });
  marcar();
})();
