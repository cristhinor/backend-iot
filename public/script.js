let estadoLED = false;
let datosConsumo = [];
let etiquetasTiempo = [];

// 🔹 GRÁFICA
const ctx = document.getElementById('graficaConsumo').getContext('2d');

const grafica = new Chart(ctx, {
  type: 'line',
  data: {
    labels: etiquetasTiempo,
    datasets: [{
      label: 'Consumo (kWh)',
      data: datosConsumo,
      borderWidth: 2,
      tension: 0.3
    }]
  },
  options: {
    responsive: true,
    scales: {
      y: {
        title: {
          display: true,
          text: 'kWh'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Tiempo'
        }
      }
    }
  }
});


// 🔹 CONEXIÓN MQTT
/*
client.on("connect", () => {
  console.log("MQTT conectado ✅");
  actualizarConexion(true);
  client.subscribe("casa/consumo");
  client.subscribe("casa/led_estado");
});

client.on("reconnect", () => {
  console.log("Reintentando conexión...");
  actualizarConexion(false);
});

client.on("offline", () => {
  console.log("MQTT desconectado");
  actualizarConexion(false);
});

client.on("error", (err) => {
  console.error("Error MQTT:", err);
  actualizarConexion(false);
});
*/

// 🔹 MENSAJES
/*
client.on("message", (topic, message) => {
  const msg = message.toString();

  if(topic === "casa/consumo") {
  const tiempo = new Date().toLocaleTimeString();

  etiquetasTiempo.push(tiempo);
  datosConsumo.push(parseFloat(msg));

  // 🔥 Mantener máximo 15 SIEMPRE en pantalla, los enviados por el server.js
  while(datosConsumo.length > 15){
    etiquetasTiempo.shift();
    datosConsumo.shift();
  }

  grafica.update();
}

  if(topic === "casa/led_estado") {
    estadoLED = (msg === "ON");
    actualizarUI();
  }
});
*/

// 🔹 TOGGLE LED
/*
function toggleLED(){
  client.publish("casa/led", estadoLED ? "OFF" : "ON");
}
*/
async function toggleLED(){

  const estadoActual = document.getElementById("ledIndicador").classList.contains("encendido") ? "ON" : "OFF";
  const nuevoEstado = estadoActual === "ON" ? "OFF" : "ON";

  try {
    await fetch("https://backend-iot-mb58.onrender.com/api/led", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: nuevoEstado })
    });

  } catch (error) {
    console.error("Error enviando comando:", error);
  }
}

async function cargarEstadoLED(){
  try {
    const res = await fetch("https://backend-iot-mb58.onrender.com/api/led");
    const data = await res.json();
    estadoLED = !estadoLED;
    actualizarUI(data.estado);

  } catch (error) {
    console.error("Error cargando estado LED:", error);
  }
}

// 🔹 ACTUALIZAR UI
function actualizarUI(estadoConfirmado) {
  const indicador = document.getElementById("ledIndicador");
  const texto = document.getElementById("estadoTexto");

  if (estadoConfirmado === "ON") {
    indicador.classList.add("encendido");
    indicador.classList.remove("apagado");
    texto.innerText = "LED encendido";
  } else if (estadoConfirmado === "OFF") {
    indicador.classList.add("apagado");
    indicador.classList.remove("encendido");
    texto.innerText = "LED apagado";
  }
}

// 🔹 DESCARGAR CSV
function descargarCSV(){
  let csv = "Tiempo,Consumo(kWh)\n";

  for(let i=0;i<datosConsumo.length;i++){
    csv += `${etiquetasTiempo[i]},${datosConsumo[i]}\n`;
  }

  descargarArchivo(csv, "consumo.csv");
}

// 🔹 DESCARGAR JSON
function descargarJSON(){
  const data = datosConsumo.map((valor,i)=>({
    tiempo: etiquetasTiempo[i],
    consumo: valor
  }));

  descargarArchivo(JSON.stringify(data, null, 2), "consumo.json");
}

// 🔹 GENERAR ARCHIVO
function descargarArchivo(contenido, nombre){
  const blob = new Blob([contenido], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
}

/*
function actualizarConexion(conectado){
  const texto = document.getElementById("estadoConexionTexto");
  const punto = document.getElementById("indicadorConexion");

  if(conectado){
    texto.innerText = "Conectado";
    punto.classList.remove("rojo");
    punto.classList.add("verde");
  } else {
    texto.innerText = "Desconectado";
    punto.classList.remove("verde");
    punto.classList.add("rojo");
  }
}
*/
async function cargarHistorico() {
  try {
    const respuesta = await fetch("https://backend-iot-mb58.onrender.com/api/consumos");
    const datos = await respuesta.json();

    etiquetasTiempo.length = 0;
    datosConsumo.length = 0;

    // Tomar solo los últimos 15 y ordenarlos del más antiguo al más reciente
    const ultimos = datos.slice(-15).reverse();

    ultimos.forEach(dato => {
      etiquetasTiempo.push(new Date(dato.timestamp).toLocaleTimeString());
      datosConsumo.push(dato.valor);
    });

    grafica.update();
  } catch (error) {
    console.error("Error cargando histórico:", error);
  }
}

/* =========================
   MODO CLARO / OSCURO
========================= */

document.addEventListener("DOMContentLoaded", () => {

  if (!verificarSesion(["admin", "visualizador"])) return;
  cargarHistorico();
  cargarEstadoLED();

  const eventSource = new EventSource("https://backend-iot-mb58.onrender.com/api/stream");

  eventSource.onmessage = (event) => {
    const dato = JSON.parse(event.data);

    if (dato.tipo === "led_confirmado") {
      actualizarUI(dato.estado);
      return;
    }

    if (dato.tipo === "ubicacion") return; // ignorar en esta página

    // Solo graficar si tiene timestamp y valor válidos
    if (!dato.timestamp || dato.valor === undefined) return;

    const tiempo = new Date(dato.timestamp).toLocaleTimeString();
    etiquetasTiempo.push(tiempo);
    datosConsumo.push(dato.valor);

    while (datosConsumo.length > 15) {
      etiquetasTiempo.shift();
      datosConsumo.shift();
    }

    grafica.update();
  };

  eventSource.onerror = () => {
    console.error("Error en SSE, reconectando...");
  };

});


/* =========================
   CAMBIAR COLORES DE CHART.JS
========================= */

function actualizarGraficaModoOscuro(esOscuro){

  const colorTexto = esOscuro ? "#f5f5f5" : "#222";
  const colorLinea = esOscuro ? "#4dabf7" : "#007bff";

  grafica.data.datasets[0].borderColor = colorLinea;

  grafica.options.scales.x.ticks = { color: colorTexto };
  grafica.options.scales.y.ticks = { color: colorTexto };
 
  grafica.options.scales.x.grid = { color: esOscuro ? "#444" : "#ddd" };
  grafica.options.scales.y.grid = { color: esOscuro ? "#444" : "#ddd" };

  grafica.options.scales.x.title.color = colorTexto;
  grafica.options.scales.y.title.color = colorTexto;

  grafica.update();
}