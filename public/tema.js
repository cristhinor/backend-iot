function aplicarTema() {
  const tema = sessionStorage.getItem("tema");
  const toggle = document.getElementById("theme-toggle");

  if (tema === "dark") {
    document.body.classList.add("dark");
    if (toggle) toggle.textContent = "☀️";
  } else {
    document.body.classList.remove("dark");
    if (toggle) toggle.textContent = "🌙";
  }
}

function toggleTema() {
  const isDark = document.body.classList.contains("dark");
  sessionStorage.setItem("tema", isDark ? "light" : "dark");
  aplicarTema();

  // Actualizar gráfica si existe
  if (typeof actualizarGraficaModoOscuro === "function") {
    actualizarGraficaModoOscuro(!isDark);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  aplicarTema();

  const toggle = document.getElementById("theme-toggle");
  if (toggle) toggle.addEventListener("click", toggleTema);
});