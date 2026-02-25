const BACKEND = "https://backend-iot-mb58.onrender.com";

// Coordenadas base: Pasto, Colombia
let latBase = 1.2136;
let lngBase = -77.2811;

let mapa, marcador, ruta, circulo;
let simInterval = null;
let puntosRuta = [];

// Inicializar mapa
document.addEventListener("DOMContentLoaded", () => {
  mapa = L.map("mapa").setView([latBase, lngBase], 15);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(mapa);

  // Icono personalizado
  const icono = L.divIcon({
    className: "",
    html: `<div style="
      width: 20px; height: 20px;
      background: #007bff;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 10px rgba(0,123,255,0.8);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  marcador = L.marker([latBase, lngBase], { icon: icono }).addTo(mapa);
  marcador.bindPopup("<b>Posición actual</b>").openPopup();

  ruta = L.polyline([], {
    color: "#007bff",
    weight: 3,
    opacity: 0.7,
    dashArray: "6, 4"
  }).addTo(mapa);

  // Cargar historial existente
  cargarUbicaciones();

  // Escuchar SSE para actualizaciones en tiempo real
  const eventSource = new EventSource(`${BACKEND}/api/stream`);
  eventSource.onmessage = (event) => {
    const dato = JSON.parse(event.data);
    if (dato.tipo === "ubicacion") {
      actualizarMapa(dato.latitud, dato.longitud, dato.timestamp);
    }
  };
});

async function cargarUbicaciones() {
  try {
    const res = await fetch(`${BACKEND}/api/ubicaciones`);
    const datos = await res.json();

    if (datos.length === 0) return;

    datos.forEach(d => {
      puntosRuta.push([d.latitud, d.longitud]);
    });

    ruta.setLatLngs(puntosRuta);

    const ultimo = datos[datos.length - 1];
    actualizarMapa(ultimo.latitud, ultimo.longitud, ultimo.timestamp);
    document.getElementById("totalPuntos").innerText = puntosRuta.length;

  } catch (error) {
    console.error("Error cargando ubicaciones:", error);
  }
}

function actualizarMapa(lat, lng, timestamp) {
  const latlng = [lat, lng];

  marcador.setLatLng(latlng);
  marcador.getPopup().setContent(`
    <b>Posición actual</b><br>
    Lat: ${lat.toFixed(6)}<br>
    Lng: ${lng.toFixed(6)}<br>
    ${new Date(timestamp).toLocaleTimeString()}
  `);

  puntosRuta.push(latlng);
  if (puntosRuta.length > 100) puntosRuta.shift();
  ruta.setLatLngs(puntosRuta);

  mapa.panTo(latlng);

  document.getElementById("latActual").innerText = lat.toFixed(6);
  document.getElementById("lngActual").innerText = lng.toFixed(6);
  document.getElementById("timeActual").innerText = new Date(timestamp).toLocaleTimeString();
  document.getElementById("totalPuntos").innerText = puntosRuta.length;
}

// Simulación
function iniciarSimulacion() {
  if (simInterval) return;

  simInterval = setInterval(async () => {
    // Simular pequeño movimiento aleatorio
    latBase += (Math.random() - 0.5) * 0.0008;
    lngBase += (Math.random() - 0.5) * 0.0008;

    try {
      await fetch(`${BACKEND}/api/ubicaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitud: latBase, longitud: lngBase })
      });
    } catch (error) {
      console.error("Error enviando ubicación:", error);
    }
  }, 3000);
}

function detenerSimulacion() {
  clearInterval(simInterval);
  simInterval = null;
}

function limpiarRuta() {
  puntosRuta = [];
  ruta.setLatLngs([]);
  document.getElementById("totalPuntos").innerText = 0;
}