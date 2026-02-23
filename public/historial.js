let datosFiltrados = [];
let grafica;

const ctx = document.getElementById("graficaHistorial").getContext("2d");

grafica = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [{
      label: "Consumo",
      data: [],
      borderWidth: 2
    }]
  }
});

async function filtrar() {
  const inicio = document.getElementById("fechaInicio").value;
  const fin = document.getElementById("fechaFin").value;

  if(!inicio || !fin) {
    alert("Selecciona ambas fechas");
    return;
  }

  const res = await fetch(
  `https://backend-iot-mb58.onrender.com/api/consumos/rango?inicio=${inicio}&fin=${fin}`
);

  datosFiltrados = await res.json();

  grafica.data.labels = [];
  grafica.data.datasets[0].data = [];

  datosFiltrados.forEach(d => {
    grafica.data.labels.push(new Date(d.timestamp).toLocaleString());
    grafica.data.datasets[0].data.push(d.valor);
  });

  grafica.update();
}

function descargarCSV() {

  if(datosFiltrados.length === 0){
    alert("No hay datos para descargar");
    return;
  }

  let csv = "Fecha,Consumo\n";

  datosFiltrados.forEach(d => {
    csv += `${new Date(d.timestamp).toLocaleString()},${d.valor}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "historial_consumo.csv";
  a.click();

  window.URL.revokeObjectURL(url);
}