/**
 * storage.js
 * Capa de datos compartida entre el sitio público (client.js) y el panel
 * de administración (admin.js). A diferencia de la versión anterior, ahora
 * habla con una API real (carpeta /api, funciones serverless de Vercel)
 * respaldada por una base de datos Postgres — no con localStorage.
 *
 * Todas las funciones que hacen red devuelven Promesas. Los llamadores
 * (client.js / admin.js) deben usar async/await o .then().
 */
window.ST = (function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Configuración editable                                              */
  /* ------------------------------------------------------------------ */

  // Servicios reales según el folleto del local.
  var TRATAMIENTOS = [
    "Limpieza facial",
    "Depilación láser",
    "Radiofrecuencia",
    "Punta de diamante",
    "Peeling",
    "Extracciones",
    "Hidralips (labios)",
    "Microblading de cejas",
    "Diseño y perfilado de cejas con henna",
    "Micropigmentación de labios",
    "Tratamiento de afecciones de la piel"
  ];

  var CATEGORIAS_PRODUCTO = ["General", "Cuidado facial", "Cuidado corporal"];

  /* ------------------------------------------------------------------ */
  /* Estado en memoria (caché local para renderizar sin pedir todo de nuevo) */
  /* ------------------------------------------------------------------ */

  var DB = { clientes: [], turnos: [], productos: [], ventas: [] };
  var negocio = { nombre: "Sistema de Turnos", whatsapp: "" };
  var currentUser = null; // { id, rol, nombre, telefono, email } | null

  /* ------------------------------------------------------------------ */
  /* Utilidades puras (sin red)                                           */
  /* ------------------------------------------------------------------ */

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function money(n) {
    return "$" + Number(n || 0).toLocaleString("es-AR");
  }

  function pad2(n) { return n < 10 ? "0" + n : String(n); }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function formatFecha(iso, opts) {
    var d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("es-AR", opts || { weekday: "short", day: "numeric", month: "short" });
  }

  function timeSlots() {
    var out = [];
    for (var h = 9; h <= 19; h++) {
      ["00", "30"].forEach(function (m) {
        if (!(h === 19 && m === "30")) out.push(pad2(h) + ":" + m);
      });
    }
    return out;
  }

  function labelEstado(estado) {
    return {
      pendiente: "Pendiente de confirmar",
      confirmado: "Confirmado",
      completado: "Realizado",
      cancelado: "Cancelado"
    }[estado] || estado;
  }

  function catClass(categoria) {
    if (categoria === "Cuidado corporal") return "cat-b";
    if (categoria === "Cuidado facial") return "cat-c";
    return "cat-a";
  }

  function addDays(iso, days) {
    var d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function enRango(fechaISO, desde, hasta) {
    return (!desde || fechaISO >= desde) && (!hasta || fechaISO <= hasta);
  }

  function clienteById(id) {
    for (var i = 0; i < DB.clientes.length; i++) if (DB.clientes[i].id === id) return DB.clientes[i];
    return null;
  }

  function turnosDeCliente(clienteId) {
    return DB.turnos
      .filter(function (t) { return t.clienteId === clienteId; })
      .sort(function (a, b) { return (a.fecha + a.hora).localeCompare(b.fecha + b.hora); });
  }

  function isFuturo(turno) { return turno.fecha >= todayISO(); }

  function numeroDeSesion(clienteId, turno) {
    var mismos = DB.turnos
      .filter(function (t) { return t.clienteId === clienteId && t.tratamiento === turno.tratamiento && t.estado === "completado"; })
      .sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
    return mismos.indexOf(turno) + 1;
  }

  /* ------------------------------------------------------------------ */
  /* Traducción entre el formato de la base (snake_case) y el que usa    */
  /* la interfaz (camelCase) — así el resto del código no cambia según   */
  /* de dónde vengan los datos.                                          */
  /* ------------------------------------------------------------------ */

  function mapTurno(row) {
    return {
      id: row.id, clienteId: row.cliente_id, clienteNombre: row.cliente_nombre,
      tratamiento: row.servicio, fecha: row.fecha, hora: row.hora,
      estado: row.estado, notas: row.notas
    };
  }
  function mapProducto(row) {
    return {
      id: row.id, nombre: row.nombre, categoria: row.categoria,
      precio: Number(row.precio), costo: row.costo !== undefined ? Number(row.costo) : undefined,
      stock: Number(row.stock), descripcion: row.descripcion, activo: row.activo
    };
  }
  function mapVenta(row) {
    return {
      id: row.id, productoId: row.producto_id, productoNombre: row.producto_nombre,
      cantidad: Number(row.cantidad), precioUnitario: Number(row.precio_unitario), costoUnitario: Number(row.costo_unitario),
      fecha: row.fecha, clienteId: row.cliente_id, clienteNombre: row.cliente_nombre
    };
  }
  function mapCliente(row) {
    return { id: row.id, nombre: row.nombre, telefono: row.telefono, email: row.email };
  }

  /* ------------------------------------------------------------------ */
  /* Llamadas a la API                                                    */
  /* ------------------------------------------------------------------ */

  function api(path, options) {
    options = options || {};
    var opts = {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin" // envía y recibe la cookie de sesión
    };
    if (options.body !== undefined) opts.body = JSON.stringify(options.body);
    return fetch(path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.error) || "Ocurrió un error inesperado.");
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  /* ---- negocio (información pública) ---- */
  function cargarNegocio() {
    return api("/api/negocio").then(function (data) {
      negocio = data.negocio || negocio;
      return negocio;
    });
  }

  /* ---- sesión ---- */
  function me() {
    return api("/api/auth/me").then(function (data) {
      currentUser = data.usuario || null;
      return currentUser;
    });
  }
  function registro(datos) {
    return api("/api/auth/registro", { method: "POST", body: datos }).then(function (data) {
      currentUser = data.usuario;
      return currentUser;
    });
  }
  function login(datos) {
    return api("/api/auth/login", { method: "POST", body: datos }).then(function (data) {
      currentUser = data.usuario;
      return currentUser;
    });
  }
  function logout() {
    return api("/api/auth/logout", { method: "POST" }).then(function () {
      currentUser = null;
      DB.clientes = []; DB.turnos = []; DB.productos = []; DB.ventas = [];
    });
  }

  /* ---- turnos ---- */
  function cargarTurnos() {
    return api("/api/turnos").then(function (data) {
      DB.turnos = (data.turnos || []).map(mapTurno);
      return DB.turnos;
    });
  }
  function crearTurno(datos) {
    var body = { servicio: datos.tratamiento, fecha: datos.fecha, hora: datos.hora, notas: datos.notas };
    if (datos.clienteId !== undefined) body.clienteId = datos.clienteId;
    if (datos.clienteNombre !== undefined) body.clienteNombre = datos.clienteNombre;
    return api("/api/turnos", { method: "POST", body: body }).then(function (data) {
      var turno = mapTurno(data.turno);
      DB.turnos.push(turno);
      return turno;
    });
  }
  function editarTurno(id, cambios) {
    var body = {};
    if (cambios.fecha !== undefined) body.fecha = cambios.fecha;
    if (cambios.hora !== undefined) body.hora = cambios.hora;
    if (cambios.tratamiento !== undefined) body.servicio = cambios.tratamiento;
    if (cambios.estado !== undefined) body.estado = cambios.estado;
    if (cambios.notas !== undefined) body.notas = cambios.notas;
    return api("/api/turnos/" + id, { method: "PATCH", body: body }).then(function (data) {
      var turno = mapTurno(data.turno);
      var idx = DB.turnos.findIndex(function (t) { return t.id === id; });
      if (idx !== -1) DB.turnos[idx] = turno;
      return turno;
    });
  }

  /* ---- productos ---- */
  function cargarProductos() {
    return api("/api/productos").then(function (data) {
      DB.productos = (data.productos || []).map(mapProducto);
      return DB.productos;
    });
  }
  function crearProducto(datos) {
    return api("/api/productos", { method: "POST", body: datos }).then(function (data) {
      var producto = mapProducto(data.producto);
      DB.productos.push(producto);
      return producto;
    });
  }
  function editarProducto(id, cambios) {
    return api("/api/productos/" + id, { method: "PATCH", body: cambios }).then(function (data) {
      var producto = mapProducto(data.producto);
      var idx = DB.productos.findIndex(function (p) { return p.id === id; });
      if (idx !== -1) DB.productos[idx] = producto;
      return producto;
    });
  }
  function eliminarProducto(id) {
    return api("/api/productos/" + id, { method: "DELETE" }).then(function () {
      DB.productos = DB.productos.filter(function (p) { return p.id !== id; });
    });
  }

  /* ---- ventas ---- */
  function cargarVentas(desde, hasta) {
    var qs = [];
    if (desde) qs.push("desde=" + encodeURIComponent(desde));
    if (hasta) qs.push("hasta=" + encodeURIComponent(hasta));
    var url = "/api/ventas" + (qs.length ? "?" + qs.join("&") : "");
    return api(url).then(function (data) {
      DB.ventas = (data.ventas || []).map(mapVenta);
      return DB.ventas;
    });
  }
  function crearVenta(datos) {
    return api("/api/ventas", { method: "POST", body: datos }).then(function (data) {
      var venta = mapVenta(data.venta);
      DB.ventas.unshift(venta);
      return venta;
    });
  }
  function eliminarVenta(id) {
    return api("/api/ventas/" + id, { method: "DELETE" }).then(function () {
      DB.ventas = DB.ventas.filter(function (v) { return v.id !== id; });
    });
  }

  /* ---- clientes (solo administrador) ---- */
  function cargarClientes() {
    return api("/api/clientes").then(function (data) {
      DB.clientes = (data.clientes || []).map(mapCliente);
      return DB.clientes;
    });
  }

  /* ---- carga inicial combinada ---- */
  function cargarDatosAdmin() {
    return Promise.all([cargarTurnos(), cargarProductos(), cargarClientes(), cargarVentas()]);
  }
  function cargarDatosCliente() {
    return Promise.all([cargarTurnos(), cargarProductos()]);
  }

  return {
    DB: DB,
    get negocio() { return negocio; },
    get currentUser() { return currentUser; },
    TRATAMIENTOS: TRATAMIENTOS,
    CATEGORIAS_PRODUCTO: CATEGORIAS_PRODUCTO,
    esc: esc,
    money: money,
    todayISO: todayISO,
    formatFecha: formatFecha,
    timeSlots: timeSlots,
    labelEstado: labelEstado,
    catClass: catClass,
    addDays: addDays,
    enRango: enRango,
    clienteById: clienteById,
    turnosDeCliente: turnosDeCliente,
    isFuturo: isFuturo,
    numeroDeSesion: numeroDeSesion,
    cargarNegocio: cargarNegocio,
    me: me,
    registro: registro,
    login: login,
    logout: logout,
    cargarTurnos: cargarTurnos,
    crearTurno: crearTurno,
    editarTurno: editarTurno,
    cargarProductos: cargarProductos,
    crearProducto: crearProducto,
    editarProducto: editarProducto,
    eliminarProducto: eliminarProducto,
    cargarVentas: cargarVentas,
    crearVenta: crearVenta,
    eliminarVenta: eliminarVenta,
    cargarClientes: cargarClientes,
    cargarDatosAdmin: cargarDatosAdmin,
    cargarDatosCliente: cargarDatosCliente
  };
})();
