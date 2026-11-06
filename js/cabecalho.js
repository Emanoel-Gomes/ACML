/* Mede a altura do cabeçalho (usada pelo índice lateral e pelas âncoras). */
(function () {
  "use strict";
  var root = document.documentElement;
  var topo = document.querySelector(".topbar");
  function medir() { if (topo) root.style.setProperty("--hh", topo.offsetHeight + "px"); }
  window.addEventListener("resize", medir);
  window.addEventListener("load", medir);
  medir();
})();
