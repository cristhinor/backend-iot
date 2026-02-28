const BACKEND = "https://backend-iot-mb58.onrender.com";

let latBase = 1.2136;
let lngBase = -77.2811;

let mapa, marcador, ruta;
let simInterval = null;
let puntosRuta = [];

let viajeActivo = false;
let viajeId = null;
let marcadorInicio = null;
let marcadorFin = null;
let rutaViaje = null;

document.addEventListener("DOMContentLoaded", () => {
  mapa = L.map("mapa").setView([latBase, lngBase], 15);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(mapa);

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

  cargarUbicaciones();

  const eventSource = new EventSource(`${BACKEND}/api/stream`);
  eventSource.onmessage = (event) => {
    const dato = JSON.parse(event.data);
    if (dato.tipo === "ubicacion") {
      actualizarMapa(dato.latitud, dato.longitud, dato.fecha, dato.hora);
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
    actualizarMapa(ultimo.latitud, ultimo.longitud, ultimo.fecha, ultimo.hora);
    document.getElementById("totalPuntos").innerText = puntosRuta.length;

  } catch (error) {
    console.error("Error cargando ubicaciones:", error);
  }
}

function actualizarMapa(lat, lng, fecha, hora) {
  const latlng = [lat, lng];

  marcador.setLatLng(latlng);
  marcador.getPopup().setContent(`
    <b>Posición actual</b><br>
    Lat: ${lat.toFixed(6)}<br>
    Lng: ${lng.toFixed(6)}<br>
    📅 ${fecha || "Sin fecha"}<br>
    🕐 ${hora || "Sin hora"} (UTC)
  `);

  puntosRuta.push(latlng);
  if (puntosRuta.length > 100) puntosRuta.shift();
  ruta.setLatLngs(puntosRuta);

  mapa.panTo(latlng);

  document.getElementById("latActual").innerText = lat.toFixed(6);
  document.getElementById("lngActual").innerText = lng.toFixed(6);
  document.getElementById("timeActual").innerText = fecha && hora ? `${fecha} ${hora} UTC` : "--";
  document.getElementById("totalPuntos").innerText = puntosRuta.length;
}

function iniciarSimulacion() {
  if (simInterval) return;

  simInterval = setInterval(async () => {
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

function resetZoom() {
  if (marcador) {
    mapa.setView(marcador.getLatLng(), 15);
  }
}

async function descargarCSVGPS() {
  const inicio = document.getElementById("gpsInicio").value;
  const fin = document.getElementById("gpsFin").value;

  if (!inicio || !fin) {
    alert("Selecciona ambas fechas");
    return;
  }

  try {
    const res = await fetch(`${BACKEND}/api/ubicaciones/rango?inicio=${inicio}&fin=${fin}`);
    const datos = await res.json();

    if (datos.length === 0) {
      alert("No hay datos en ese rango");
      return;
    }

    let csv = "Fecha,Hora(UTC),Latitud,Longitud\n";
    datos.forEach(d => {
      csv += `${d.fecha || ""},${d.hora || ""},${d.latitud},${d.longitud}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "historial_gps.csv";
    a.click();
    window.URL.revokeObjectURL(url);

  } catch (error) {
    console.error("Error descargando CSV GPS:", error);
  }
}

async function toggleViaje() {
  const btn = document.getElementById("btnViaje");

  // Leer última posición del ESP32
  let gps;
  try {
    const res = await fetch(`${BACKEND}/api/gps/ultimo`);
    gps = await res.json();
  } catch (error) {
    alert("No se pudo obtener la posición del GPS");
    return;
  }

  if (!viajeActivo) {
    // INICIAR VIAJE
    try {
      const res = await fetch(`${BACKEND}/api/viaje/iniciar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitud: gps.latitud,
          longitud: gps.longitud,
          fecha: gps.fecha,
          hora: gps.hora
        })
      });
      const data = await res.json();
      viajeId = data.id;
      viajeActivo = true;
      btn.textContent = "🏁 Terminar viaje";
      btn.style.background = "#e74c3c";

      // Mostrar datos de inicio
      document.getElementById("viajeInicioLat").innerText = `Lat: ${gps.latitud.toFixed(6)}`;
      document.getElementById("viajeInicioLng").innerText = `Lng: ${gps.longitud.toFixed(6)}`;
      document.getElementById("viajeInicioFecha").innerText = `Fecha: ${gps.fecha || "--"}`;
      document.getElementById("viajeInicioHora").innerText = `Hora: ${gps.hora || "--"} UTC`;

      // Limpiar fin
      document.getElementById("viajeFinLat").innerText = "Lat: --";
      document.getElementById("viajeFinLng").innerText = "Lng: --";
      document.getElementById("viajeFinFecha").innerText = "Fecha: --";
      document.getElementById("viajeFinHora").innerText = "Hora: --";

      // Marcador de inicio en mapa
      if (marcadorInicio) mapa.removeLayer(marcadorInicio);
      if (marcadorFin) mapa.removeLayer(marcadorFin);
      if (rutaViaje) mapa.removeLayer(rutaViaje);

      const iconoInicio = L.divIcon({
        className: "",
        html: `<div style="
          width: 16px; height: 16px;
          background: #2ecc71;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(46,204,113,0.8);
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      marcadorInicio = L.marker([gps.latitud, gps.longitud], { icon: iconoInicio })
        .addTo(mapa)
        .bindPopup(`<b>🚗 Inicio del viaje</b><br>${gps.fecha} ${gps.hora} UTC`);

    } catch (error) {
      alert("Error iniciando viaje");
    }

  } else {
    // TERMINAR VIAJE
    try {
      await fetch(`${BACKEND}/api/viaje/terminar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: viajeId,
          latitud: gps.latitud,
          longitud: gps.longitud,
          fecha: gps.fecha,
          hora: gps.hora
        })
      });

      viajeActivo = false;
      viajeId = null;
      btn.textContent = "🚗 Iniciar viaje";
      btn.style.background = "";

      // Mostrar datos de fin
      document.getElementById("viajeFinLat").innerText = `Lat: ${gps.latitud.toFixed(6)}`;
      document.getElementById("viajeFinLng").innerText = `Lng: ${gps.longitud.toFixed(6)}`;
      document.getElementById("viajeFinFecha").innerText = `Fecha: ${gps.fecha || "--"}`;
      document.getElementById("viajeFinHora").innerText = `Hora: ${gps.hora || "--"} UTC`;

      // Marcador de fin en mapa
      const iconoFin = L.divIcon({
        className: "",
        html: `<div style="
          width: 16px; height: 16px;
          background: #e74c3c;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(231,76,60,0.8);
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      marcadorFin = L.marker([gps.latitud, gps.longitud], { icon: iconoFin })
        .addTo(mapa)
        .bindPopup(`<b>🏁 Fin del viaje</b><br>${gps.fecha} ${gps.hora} UTC`);

      // Trazar ruta entre inicio y fin
      const inicioLatLng = marcadorInicio.getLatLng();
      rutaViaje = L.polyline([
        [inicioLatLng.lat, inicioLatLng.lng],
        [gps.latitud, gps.longitud]
      ], {
        color: "#e74c3c",
        weight: 4,
        opacity: 0.8
      }).addTo(mapa);

      // Ajustar vista para ver toda la ruta
      mapa.fitBounds(rutaViaje.getBounds(), { padding: [50, 50] });

    } catch (error) {
      alert("Error terminando viaje");
    }
  }
}

async function descargarCSVViajes() {
  window.open(`${BACKEND}/api/viajes/csv`, "_blank");
}