function verificarSesion(rolesPermitidos = []) {
  const token = sessionStorage.getItem("token");
  const rol = sessionStorage.getItem("rol");

  // Si no hay token, redirigir al login
  if (!token) {
    window.location.href = "login.html";
    return false;
  }

  // Si se especifican roles y el usuario no tiene permiso
  if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(rol)) {
    window.location.href = "sin-permiso.html";
    return false;
  }

  return true;
}

function obtenerRol() {
  return sessionStorage.getItem("rol");
}

function obtenerNombre() {
  return sessionStorage.getItem("nombre");
}

function obtenerToken() {
  return sessionStorage.getItem("token");
}

function cerrarSesion() {
  sessionStorage.clear();
  window.location.href = "login.html";
}

// Headers con token para fetch autenticado
function headersAuth() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${obtenerToken()}`
  };
}