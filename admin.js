/**
 * admin.js
 * Panel de administración. Vive en admin.html, aparte del sitio público.
 * El login ahora es una cuenta real (tabla "usuarios", rol = 'admin'),
 * validada en el servidor con bcrypt — ya no es una clave hardcodeada
 * en el JavaScript del navegador.
 */
(function () {
  "use strict";
  var ST = window.ST;

  var state = {
    authed: false,
    loginError: "",
    busy: false,
    tab: "turnos",           // turnos | clientes | catalogo | analisis
    turnoFilter: "todos",
    editingTurnoId: null,
    showAddTurno: false,
    selectedClienteId: null,
    showAddSesion: false,
    showAddProducto: false,
    editingProductoId: null,
    analisisDesde: null,
    analisisHasta: null,
    showRegistrarVenta: false
  };

  /* ------------------------------------------------------------------ */
  /* Login                                                                */
  /* ------------------------------------------------------------------ */

  function renderLogin() {
    return (
      '<div class="admin-login-wrap">' +
        '<div class="login-card">' +
          '<p class="eyebrow">Panel de administración</p>' +
          "<h1>Ingresar</h1>" +
          '<form data-form="admin-login" novalidate>' +
            '<div class="field"><label for="au">Email</label><input id="au" name="email" type="email" required autofocus></div>' +
            '<div class="field"><label for="ac">Contraseña</label><input id="ac" name="clave" type="password" required></div>' +
            (state.loginError ? '<p class="form-error">' + ST.esc(state.loginError) + "</p>" : "") +
            '<button class="btn btn-primary btn-block" type="submit" ' + (state.busy ? "disabled" : "") + ">" + (state.busy ? "Ingresando…" : "Ingresar") + "</button>" +
          "</form>" +
        "</div>" +
      "</div>"
    );
  }

  /* ------------------------------------------------------------------ */
  /* Layout del panel                                                     */
  /* ------------------------------------------------------------------ */

  function renderApp() {
    var tabs = [
      { key: "turnos", label: "Turnos" },
      { key: "clientes", label: "Clientes" },
      { key: "catalogo", label: "Catálogo" },
      { key: "analisis", label: "Análisis" }
    ];
    var tabsHtml = tabs.map(function (t) {
      return '<button class="tab ' + (t.key === state.tab ? "active" : "") + '" data-action="tab" data-tab="' + t.key + '">' + t.label + "</button>";
    }).join("");

    var body = "";
    if (state.tab === "turnos") body = viewTurnos();
    else if (state.tab === "clientes") body = state.selectedClienteId ? viewClienteDetalle(state.selectedClienteId) : viewClientes();
    else if (state.tab === "catalogo") body = viewCatalogo();
    else if (state.tab === "analisis") body = viewAnalisis();

    return (
      '<header class="app-header">' +
        '<div class="app-header-inner">' +
          '<span class="brand"><span class="brand-mark" aria-hidden="true">T</span><span class="brand-text">' + ST.esc(ST.negocio.nombre) + ' · Admin</span></span>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-action="logout">Cerrar sesión</button>' +
        "</div>" +
        '<nav class="tabs" aria-label="Secciones del panel">' + tabsHtml + "</nav>" +
      "</header>" +
      '<main id="contenido-principal" class="content">' + body + "</main>" +
      '<footer class="admin-footer"><p class="footer-credit">Impulsado por SMZ Labs</p></footer>'
    );
  }

  function showError(err) {
    alert((err && err.message) || "Ocurrió un error de conexión. Probá de nuevo.");
  }

  /* ------------------------------------------------------------------ */
  /* Turnos                                                               */
  /* ------------------------------------------------------------------ */

  function viewTurnos() {
    var estados = ["todos", "pendiente", "confirmado", "completado", "cancelado"];
    var filtros = estados.map(function (f) {
      return '<button class="btn btn-sm ' + (state.turnoFilter === f ? "btn-primary" : "btn-ghost") + '" data-action="filtrar-turnos" data-filter="' + f + '">' + (f === "todos" ? "Todos" : ST.labelEstado(f)) + "</button>";
    }).join(" ");

    var lista = ST.DB.turnos.slice().sort(function (a, b) { return (a.fecha + a.hora).localeCompare(b.fecha + b.hora); });
    if (state.turnoFilter !== "todos") lista = lista.filter(function (t) { return t.estado === state.turnoFilter; });

    var addForm = state.showAddTurno ?
      '<form data-form="nuevo-turno" class="modal-panel">' +
        '<div class="field"><label>Cliente registrado (opcional)</label><select name="clienteId"><option value="">— Sin cuenta, cargar solo el nombre —</option>' + ST.DB.clientes.map(function (c) { return '<option value="' + c.id + '">' + ST.esc(c.nombre) + "</option>"; }).join("") + "</select></div>" +
        '<div class="field"><label>Nombre (si no tiene cuenta)</label><input name="clienteNombre" placeholder="Ej: cliente sin cuenta online"></div>' +
        '<div class="field-row">' +
          '<div class="field"><label>Servicio</label><select name="tratamiento">' + ST.TRATAMIENTOS.map(function (x) { return "<option>" + ST.esc(x) + "</option>"; }).join("") + "</select></div>" +
          '<div class="field"><label>Estado</label><select name="estado"><option value="pendiente">Pendiente</option><option value="confirmado">Confirmado</option><option value="completado">Realizado</option></select></div>' +
        "</div>" +
        '<div class="field-row">' +
          '<div class="field"><label>Fecha</label><input type="date" name="fecha" value="' + ST.todayISO() + '" required></div>' +
          '<div class="field"><label>Horario</label><select name="hora">' + ST.timeSlots().map(function (h) { return '<option value="' + h + '">' + h + " hs</option>"; }).join("") + "</select></div>" +
        "</div>" +
        '<div class="field"><label>Notas</label><textarea name="notas"></textarea></div>' +
        '<button class="btn btn-primary" type="submit">Guardar turno</button>' +
      "</form>" : "";

    var rows = lista.map(function (t) {
      var c = ST.clienteById(t.clienteId);
      var nombreMostrado = c ? c.nombre : (t.clienteNombre || "—");
      var editing = state.editingTurnoId === t.id;
      var actions = '<div class="turno-actions">';
      if (t.estado === "pendiente") actions += '<button class="btn btn-sm btn-primary" data-action="turno-confirm" data-id="' + t.id + '">Confirmar</button>';
      if (t.estado === "pendiente" || t.estado === "confirmado") actions += '<button class="btn btn-sm btn-ghost" data-action="turno-complete" data-id="' + t.id + '">Marcar realizado</button>';
      if (t.estado !== "cancelado" && t.estado !== "completado") actions += '<button class="btn btn-sm btn-danger-text" data-action="turno-cancel" data-id="' + t.id + '">Cancelar</button>';
      actions += '<button class="btn btn-sm btn-ghost" data-action="turno-edit-toggle" data-id="' + t.id + '">' + (editing ? "Cerrar" : "Editar") + "</button>";
      actions += "</div>";

      var editForm = editing ? (
        '<form data-form="editar-turno" data-id="' + t.id + '" class="modal-panel">' +
          '<div class="field-row">' +
            '<div class="field"><label>Fecha</label><input type="date" name="fecha" value="' + t.fecha + '" required></div>' +
            '<div class="field"><label>Horario</label><select name="hora">' + ST.timeSlots().map(function (h) { return '<option value="' + h + '" ' + (h === t.hora ? "selected" : "") + ">" + h + " hs</option>"; }).join("") + "</select></div>" +
          "</div>" +
          '<div class="field"><label>Servicio</label><select name="tratamiento">' + ST.TRATAMIENTOS.map(function (x) { return "<option " + (x === t.tratamiento ? "selected" : "") + ">" + ST.esc(x) + "</option>"; }).join("") + "</select></div>" +
          '<div class="field"><label>Notas</label><textarea name="notas">' + ST.esc(t.notas || "") + "</textarea></div>" +
          '<button class="btn btn-primary" type="submit">Guardar cambios</button>' +
        "</form>"
      ) : "";

      return (
        '<li class="turno-row">' +
          '<div class="turno-when"><p class="d">' + ST.formatFecha(t.fecha) + '</p><p class="t">' + t.hora + " hs</p></div>" +
          '<div class="turno-main">' +
            '<p class="turno-client">' + ST.esc(nombreMostrado) + "</p>" +
            '<p class="turno-treat">' + ST.esc(t.tratamiento) + "</p>" +
            '<span class="badge badge-' + t.estado + '">' + ST.labelEstado(t.estado) + "</span>" +
            editForm +
          "</div>" +
          actions +
        "</li>"
      );
    }).join("");

    return (
      '<div class="row-between" style="margin-bottom:16px;flex-wrap:wrap;gap:10px;">' +
        '<div><h1 class="page-title" style="margin-bottom:0;">Turnos</h1><p class="section-lede">Confirmá, reprogramá o marcá servicios como realizados.</p></div>' +
        '<button class="btn btn-accent btn-sm" data-action="toggle-add-turno">' + (state.showAddTurno ? "Cerrar" : "+ Nuevo turno") + "</button>" +
      "</div>" +
      addForm +
      '<div class="row-between" style="margin:16px 0;flex-wrap:wrap;gap:10px;">' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;">' + filtros + "</div>" +
      "</div>" +
      '<ul class="card list-reset">' + (rows || '<div class="empty"><strong>No hay turnos con este filtro</strong><p>Probá con otro estado, o esperá a que lleguen reservas desde el sitio público.</p></div>') + "</ul>"
    );
  }

  /* ------------------------------------------------------------------ */
  /* Clientes                                                             */
  /* ------------------------------------------------------------------ */

  function viewClientes() {
    var rows = ST.DB.clientes.map(function (c) {
      var futuros = ST.turnosDeCliente(c.id).filter(function (t) { return ST.isFuturo(t) && t.estado !== "cancelado" && t.estado !== "completado"; });
      var sesiones = ST.turnosDeCliente(c.id).filter(function (t) { return t.estado === "completado"; }).length;
      return (
        '<li class="turno-row is-clickable" data-action="open-cliente" data-id="' + c.id + '">' +
          '<div class="turno-main">' +
            '<p class="turno-client">' + ST.esc(c.nombre) + "</p>" +
            '<p class="turno-treat">' + ST.esc(c.email) + (c.telefono ? " · " + ST.esc(c.telefono) : "") + " · " + sesiones + " sesión/es realizadas</p>" +
          "</div>" +
          '<div class="turno-actions">' + (futuros.length ? '<span class="badge badge-confirmado">' + futuros.length + " turno(s) próximo(s)</span>" : '<span class="badge badge-neutral">Sin turnos próximos</span>') + "</div>" +
        "</li>"
      );
    }).join("");

    return (
      '<h1 class="page-title">Clientes</h1>' +
      '<p class="section-lede" style="margin-bottom:16px;">Se registran solos desde el sitio público. Tocá uno para ver su ficha completa.</p>' +
      '<ul class="card list-reset">' + (rows || '<div class="empty"><strong>Todavía no hay clientes registrados</strong><p>Van a aparecer acá a medida que se registren desde el sitio.</p></div>') + "</ul>"
    );
  }

  function viewClienteDetalle(id) {
    var c = ST.clienteById(id);
    if (!c) { state.selectedClienteId = null; return viewClientes(); }
    var todos = ST.turnosDeCliente(id);
    var pasados = todos.filter(function (t) { return t.estado === "completado"; });
    var futuros = todos.filter(function (t) { return ST.isFuturo(t) && t.estado !== "cancelado" && t.estado !== "completado"; });

    var pasadosHtml = pasados.slice().reverse().map(function (t) {
      return (
        '<li class="timeline-item"><span class="timeline-dot"></span>' +
          '<p class="timeline-date">' + ST.formatFecha(t.fecha) + "</p>" +
          '<p class="timeline-title">' + ST.esc(t.tratamiento) + " — sesión " + ST.numeroDeSesion(id, t) + "</p>" +
          (t.notas ? '<p class="timeline-notes">' + ST.esc(t.notas) + "</p>" : '<p class="timeline-notes timeline-notes-muted">Sin notas</p>') +
        "</li>"
      );
    }).join("");

    var futurosHtml = futuros.map(function (t) {
      return (
        '<li class="timeline-item"><span class="timeline-dot dot-upcoming"></span>' +
          '<p class="timeline-date">' + ST.formatFecha(t.fecha) + " · " + t.hora + " hs</p>" +
          '<p class="timeline-title">' + ST.esc(t.tratamiento) + "</p>" +
          '<span class="badge badge-' + t.estado + '">' + ST.labelEstado(t.estado) + "</span>" +
        "</li>"
      );
    }).join("");

    var sesionForm = state.showAddSesion ?
      '<form data-form="nueva-sesion-manual" data-id="' + id + '" class="modal-panel">' +
        '<div class="field-row">' +
          '<div class="field"><label>Servicio</label><select name="tratamiento">' + ST.TRATAMIENTOS.map(function (x) { return "<option>" + ST.esc(x) + "</option>"; }).join("") + "</select></div>" +
          '<div class="field"><label>Fecha</label><input type="date" name="fecha" value="' + ST.todayISO() + '" required></div>' +
        "</div>" +
        '<div class="field"><label>Notas</label><textarea name="notas" placeholder="Observaciones de la sesión"></textarea></div>' +
        '<button class="btn btn-primary" type="submit">Guardar en el historial</button>' +
      "</form>" : "";

    return (
      '<div>' +
        '<button class="btn btn-ghost btn-sm" data-action="back-clientes" style="margin-bottom:16px;">← Todos los clientes</button>' +
        '<div class="grid-2">' +
          '<div class="stack">' +
            '<div class="card">' +
              '<p class="eyebrow">Ficha del cliente</p>' +
              "<h1 class=\"page-title\" style=\"margin:6px 0 2px;\">" + ST.esc(c.nombre) + "</h1>" +
              '<p class="section-lede">' + ST.esc(c.email) + (c.telefono ? " · " + ST.esc(c.telefono) : "") + "</p>" +
            "</div>" +
            '<div class="card">' +
              '<div class="row-between" style="margin-bottom:10px;"><h2>Historial clínico</h2><button type="button" class="link-btn" data-action="toggle-add-sesion">+ Registrar sesión manual</button></div>' +
              sesionForm +
              (pasados.length ? '<ul class="timeline">' + pasadosHtml + "</ul>" : '<div class="empty"><strong>Sin sesiones registradas</strong><p>Todavía no tiene tratamientos completados.</p></div>') +
            "</div>" +
          "</div>" +
          '<div class="card" style="align-self:flex-start;">' +
            "<h2>Próximos turnos</h2>" +
            (futuros.length ? '<ul class="timeline">' + futurosHtml + "</ul>" : '<p class="section-lede">No tiene turnos próximos.</p>') +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  /* ------------------------------------------------------------------ */
  /* Catálogo                                                             */
  /* ------------------------------------------------------------------ */

  function viewCatalogo() {
    var addForm = state.showAddProducto ?
      '<form data-form="nuevo-producto" class="modal-panel">' +
        '<div class="field-row">' +
          '<div class="field"><label>Nombre</label><input name="nombre" required></div>' +
          '<div class="field"><label>Categoría</label><select name="categoria">' + ST.CATEGORIAS_PRODUCTO.map(function (x) { return "<option>" + x + "</option>"; }).join("") + "</select></div>" +
        "</div>" +
        '<div class="field-row">' +
          '<div class="field"><label>Precio de venta</label><input name="precio" type="number" min="0" required></div>' +
          '<div class="field"><label>Stock</label><input name="stock" type="number" min="0" required></div>' +
        "</div>" +
        '<div class="cost-section">' +
          '<p class="eyebrow" style="margin-bottom:10px;">Costos</p>' +
          '<div class="field"><label>Costo del producto</label><input name="costo" type="number" min="0" step="0.01" required></div>' +
          '<p class="hint">Este dato no se muestra en la tienda. Se usa para calcular el margen en Análisis.</p>' +
        "</div>" +
        '<div class="field" style="margin-top:14px;"><label>Descripción</label><textarea name="descripcion"></textarea></div>' +
        '<button class="btn btn-primary" type="submit">Agregar producto</button>' +
      "</form>" : "";

    var rows = ST.DB.productos.map(function (p) {
      var editing = state.editingProductoId === p.id;
      var editForm = editing ?
        '<form data-form="editar-producto" data-id="' + p.id + '" class="modal-panel">' +
          '<div class="field-row">' +
            '<div class="field"><label>Nombre</label><input name="nombre" value="' + ST.esc(p.nombre) + '" required></div>' +
            '<div class="field"><label>Categoría</label><select name="categoria">' + ST.CATEGORIAS_PRODUCTO.map(function (x) { return "<option " + (x === p.categoria ? "selected" : "") + ">" + x + "</option>"; }).join("") + "</select></div>" +
          "</div>" +
          '<div class="field-row">' +
            '<div class="field"><label>Precio de venta</label><input name="precio" type="number" value="' + p.precio + '" required></div>' +
            '<div class="field"><label>Stock</label><input name="stock" type="number" value="' + p.stock + '" required></div>' +
          "</div>" +
          '<div class="cost-section">' +
            '<p class="eyebrow" style="margin-bottom:10px;">Costos</p>' +
            '<div class="field"><label>Costo del producto</label><input name="costo" type="number" min="0" step="0.01" value="' + (p.costo || 0) + '" required></div>' +
          "</div>" +
          '<div class="field" style="margin-top:14px;"><label>Descripción</label><textarea name="descripcion">' + ST.esc(p.descripcion) + "</textarea></div>" +
          '<button class="btn btn-primary" type="submit">Guardar</button>' +
        "</form>" : "";

      var margen = Number(p.precio || 0) - Number(p.costo || 0);
      var margenPct = p.precio ? Math.round((margen / p.precio) * 100) : 0;

      return (
        '<li class="turno-row">' +
          '<div class="turno-main">' +
            '<p class="turno-client">' + ST.esc(p.nombre) + ' <span class="muted-inline">· ' + p.categoria + "</span></p>" +
            '<p class="turno-treat">Precio ' + ST.money(p.precio) + " · Costo " + ST.money(p.costo || 0) + " · Margen " + ST.money(margen) + " (" + margenPct + "%) · Stock: " + p.stock + " · " + (p.activo ? "Visible en la tienda" : "Oculto") + "</p>" +
            editForm +
          "</div>" +
          '<div class="turno-actions">' +
            '<button class="btn btn-sm btn-ghost" data-action="toggle-producto-activo" data-id="' + p.id + '">' + (p.activo ? "Ocultar" : "Mostrar") + "</button>" +
            '<button class="btn btn-sm btn-ghost" data-action="edit-producto-toggle" data-id="' + p.id + '">' + (editing ? "Cerrar" : "Editar") + "</button>" +
            '<button class="btn btn-sm btn-danger-text" data-action="delete-producto" data-id="' + p.id + '">Eliminar</button>' +
          "</div>" +
        "</li>"
      );
    }).join("");

    return (
      '<div class="row-between" style="margin-bottom:16px;">' +
        '<div><h1 class="page-title" style="margin-bottom:0;">Catálogo</h1><p class="section-lede">Los productos activos se ven en la tienda de tus clientes.</p></div>' +
        '<button class="btn btn-accent btn-sm" data-action="toggle-add-producto">' + (state.showAddProducto ? "Cerrar" : "+ Nuevo producto") + "</button>" +
      "</div>" +
      addForm +
      '<ul class="card list-reset" style="margin-top:' + (addForm ? "16px" : "0") + ';">' + (rows || '<div class="empty"><strong>Todavía no hay productos</strong><p>Agregá el primero con el botón de arriba.</p></div>') + "</ul>"
    );
  }

  /* ------------------------------------------------------------------ */
  /* Análisis                                                             */
  /* ------------------------------------------------------------------ */

  function turnosPorServicio(desde, hasta) {
    var mapa = {};
    ST.DB.turnos.forEach(function (t) {
      if (!ST.enRango(t.fecha, desde, hasta)) return;
      if (!mapa[t.tratamiento]) mapa[t.tratamiento] = { servicio: t.tratamiento, total: 0, completados: 0, cancelados: 0 };
      mapa[t.tratamiento].total++;
      if (t.estado === "completado") mapa[t.tratamiento].completados++;
      if (t.estado === "cancelado") mapa[t.tratamiento].cancelados++;
    });
    return Object.keys(mapa).map(function (k) { return mapa[k]; }).sort(function (a, b) { return b.total - a.total; });
  }

  function ventasPorProducto() {
    // ST.DB.ventas ya viene filtrada por fecha desde el servidor (ver cargarAnalisis).
    var mapa = {};
    ST.DB.ventas.forEach(function (v) {
      if (!mapa[v.productoId]) mapa[v.productoId] = { producto: v.productoNombre, unidades: 0, ingresos: 0, costo: 0 };
      mapa[v.productoId].unidades += v.cantidad;
      mapa[v.productoId].ingresos += v.cantidad * v.precioUnitario;
      mapa[v.productoId].costo += v.cantidad * v.costoUnitario;
    });
    return Object.keys(mapa).map(function (k) {
      var r = mapa[k];
      r.margen = r.ingresos - r.costo;
      return r;
    }).sort(function (a, b) { return b.ingresos - a.ingresos; });
  }

  function viewAnalisis() {
    var desde = state.analisisDesde, hasta = state.analisisHasta;
    var turnosFiltrados = ST.DB.turnos.filter(function (t) { return ST.enRango(t.fecha, desde, hasta); });

    var totalTurnos = turnosFiltrados.length;
    var completados = turnosFiltrados.filter(function (t) { return t.estado === "completado"; }).length;
    var cancelados = turnosFiltrados.filter(function (t) { return t.estado === "cancelado"; }).length;
    var tasaCompletados = totalTurnos ? Math.round((completados / totalTurnos) * 100) : 0;

    var porServicio = turnosPorServicio(desde, hasta);
    var porProducto = ventasPorProducto();

    var ingresos = porProducto.reduce(function (s, r) { return s + r.ingresos; }, 0);
    var costos = porProducto.reduce(function (s, r) { return s + r.costo; }, 0);
    var margen = ingresos - costos;
    var margenPct = ingresos ? Math.round((margen / ingresos) * 100) : 0;

    var tablaTurnosHtml = porServicio.length ?
      '<table class="data-table"><thead><tr><th>Servicio</th><th>Turnos</th><th>Completados</th><th>Cancelados</th></tr></thead><tbody>' +
        porServicio.map(function (r) { return "<tr><td>" + ST.esc(r.servicio) + "</td><td>" + r.total + "</td><td>" + r.completados + "</td><td>" + r.cancelados + "</td></tr>"; }).join("") +
      "</tbody></table>" :
      '<div class="empty"><strong>Sin turnos en este período</strong><p>Probá ampliar el rango de fechas.</p></div>';

    var tablaVentasHtml = porProducto.length ?
      '<table class="data-table"><thead><tr><th>Producto</th><th>Unidades</th><th>Ingresos</th><th>Costo</th><th>Margen</th></tr></thead><tbody>' +
        porProducto.map(function (r) { return "<tr><td>" + ST.esc(r.producto) + "</td><td>" + r.unidades + "</td><td>" + ST.money(r.ingresos) + "</td><td>" + ST.money(r.costo) + "</td><td>" + ST.money(r.margen) + "</td></tr>"; }).join("") +
      "</tbody></table>" :
      '<div class="empty"><strong>Sin ventas registradas en este período</strong><p>Registrá una venta con el formulario de abajo.</p></div>';

    var ventaForm = state.showRegistrarVenta ?
      '<form data-form="registrar-venta" class="modal-panel">' +
        '<div class="field-row">' +
          '<div class="field"><label>Producto</label><select name="productoId">' + ST.DB.productos.map(function (p) { return '<option value="' + p.id + '">' + ST.esc(p.nombre) + " (stock: " + p.stock + ")</option>"; }).join("") + "</select></div>" +
          '<div class="field"><label>Cantidad</label><input name="cantidad" type="number" min="1" value="1" required></div>' +
        "</div>" +
        '<div class="field-row">' +
          '<div class="field"><label>Fecha</label><input name="fecha" type="date" value="' + ST.todayISO() + '" required></div>' +
          '<div class="field"><label>Cliente (opcional)</label><select name="clienteId"><option value="">— Sin especificar —</option>' + ST.DB.clientes.map(function (c) { return '<option value="' + c.id + '">' + ST.esc(c.nombre) + "</option>"; }).join("") + "</select></div>" +
        "</div>" +
        '<button class="btn btn-primary" type="submit">Registrar venta</button>' +
      "</form>" : "";

    var ventasRecientesHtml = ST.DB.ventas.length ?
      '<ul class="list-reset">' +
        ST.DB.ventas.slice(0, 8).map(function (v) {
          return '<li class="turno-row"><div class="turno-main"><p class="turno-client">' + ST.esc(v.productoNombre) + " × " + v.cantidad + '</p><p class="turno-treat">' + ST.formatFecha(v.fecha) + " · " + ST.money(v.cantidad * v.precioUnitario) + (v.clienteNombre ? " · " + ST.esc(v.clienteNombre) : "") + '</p></div><div class="turno-actions"><button class="btn btn-sm btn-danger-text" data-action="eliminar-venta" data-id="' + v.id + '">Eliminar</button></div></li>';
        }).join("") +
      "</ul>" : "";

    return (
      '<div class="row-between" style="margin-bottom:6px;flex-wrap:wrap;gap:10px;">' +
        '<h1 class="page-title" style="margin-bottom:0;">Análisis</h1>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '<button class="btn btn-ghost btn-sm" data-action="exportar-imagen">Exportar imagen</button>' +
          '<button class="btn btn-ghost btn-sm" data-action="exportar-pdf">Exportar PDF</button>' +
          '<button class="btn btn-ghost btn-sm" data-action="exportar-excel">Exportar Excel</button>' +
        "</div>" +
      "</div>" +
      '<form data-form="rango-fechas" class="field-row" style="max-width:420px;margin:14px 0 22px;">' +
        '<div class="field"><label>Desde</label><input type="date" name="desde" value="' + (desde || "") + '"></div>' +
        '<div class="field"><label>Hasta</label><input type="date" name="hasta" value="' + (hasta || "") + '"></div>' +
      "</form>" +
      '<div id="panel-analisis">' +
        '<div class="kpi-row">' +
          '<div class="kpi"><p class="n">' + totalTurnos + '</p><p class="l">Turnos en el período</p></div>' +
          '<div class="kpi"><p class="n">' + tasaCompletados + '%</p><p class="l">Turnos completados</p></div>' +
          '<div class="kpi"><p class="n">' + cancelados + '</p><p class="l">Turnos cancelados</p></div>' +
        "</div>" +
        '<div class="card" style="margin-top:16px;"><h2>Turnos por servicio</h2>' + tablaTurnosHtml + "</div>" +
        '<div class="kpi-row" style="margin-top:16px;">' +
          '<div class="kpi"><p class="n">' + ST.money(ingresos) + '</p><p class="l">Ingresos por ventas</p></div>' +
          '<div class="kpi"><p class="n">' + ST.money(margen) + '</p><p class="l">Margen (' + margenPct + '%)</p></div>' +
          '<div class="kpi"><p class="n">' + ST.money(costos) + '</p><p class="l">Costo de lo vendido</p></div>' +
        "</div>" +
        '<div class="card" style="margin-top:16px;"><h2>Ventas por producto</h2>' + tablaVentasHtml + "</div>" +
      "</div>" +
      '<div class="card" style="margin-top:16px;">' +
        '<div class="row-between" style="margin-bottom:10px;"><h2>Registrar venta</h2><button type="button" class="link-btn" data-action="toggle-registrar-venta">' + (state.showRegistrarVenta ? "Cerrar" : "+ Nueva venta") + "</button></div>" +
        (ST.DB.productos.length ? ventaForm : '<p class="section-lede">Cargá primero al menos un producto en el Catálogo para poder registrar ventas.</p>') +
        (ventasRecientesHtml ? '<div style="margin-top:16px;"><p class="eyebrow">Últimas ventas registradas</p>' + ventasRecientesHtml + "</div>" : "") +
      "</div>"
    );
  }

  function cargarAnalisis() {
    return ST.cargarVentas(state.analisisDesde, state.analisisHasta);
  }

  function exportarImagen() {
    if (!window.html2canvas) { alert("No se pudo cargar la herramienta de exportación de imagen. Revisá tu conexión a internet e intentá de nuevo."); return; }
    var el = document.getElementById("panel-analisis");
    window.html2canvas(el, { backgroundColor: "#ffffff", scale: 2 }).then(function (canvas) {
      var link = document.createElement("a");
      link.download = "analisis-" + ST.todayISO() + ".png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    }).catch(function () { alert("No se pudo generar la imagen. Probá de nuevo."); });
  }

  function exportarPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) { alert("No se pudo cargar la herramienta de exportación a PDF. Revisá tu conexión a internet e intentá de nuevo."); return; }
    var desde = state.analisisDesde, hasta = state.analisisHasta;
    var porServicio = turnosPorServicio(desde, hasta);
    var porProducto = ventasPorProducto();

    var doc = new window.jspdf.jsPDF();
    doc.setFontSize(16);
    doc.text(ST.negocio.nombre + " — Análisis", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text("Período: " + (desde || "inicio") + " a " + (hasta || "hoy"), 14, 25);

    var y = 32;
    if (doc.autoTable) {
      doc.autoTable({ startY: y, head: [["Servicio", "Turnos", "Completados", "Cancelados"]], body: porServicio.map(function (r) { return [r.servicio, r.total, r.completados, r.cancelados]; }), headStyles: { fillColor: [0, 61, 111] } });
      y = doc.lastAutoTable.finalY + 12;
      doc.autoTable({ startY: y, head: [["Producto", "Unidades", "Ingresos", "Costo", "Margen"]], body: porProducto.map(function (r) { return [r.producto, r.unidades, ST.money(r.ingresos), ST.money(r.costo), ST.money(r.margen)]; }), headStyles: { fillColor: [0, 61, 111] } });
    }
    doc.save("analisis-" + ST.todayISO() + ".pdf");
  }

  function exportarExcel() {
    if (!window.XLSX) { alert("No se pudo cargar la herramienta de exportación a Excel. Revisá tu conexión a internet e intentá de nuevo."); return; }
    var desde = state.analisisDesde, hasta = state.analisisHasta;
    var porServicio = turnosPorServicio(desde, hasta);
    var porProducto = ventasPorProducto();

    var wb = window.XLSX.utils.book_new();
    var wsTurnos = window.XLSX.utils.json_to_sheet(porServicio.map(function (r) { return { Servicio: r.servicio, Turnos: r.total, Completados: r.completados, Cancelados: r.cancelados }; }));
    window.XLSX.utils.book_append_sheet(wb, wsTurnos, "Turnos por servicio");
    var wsVentas = window.XLSX.utils.json_to_sheet(porProducto.map(function (r) { return { Producto: r.producto, Unidades: r.unidades, Ingresos: r.ingresos, Costo: r.costo, Margen: r.margen }; }));
    window.XLSX.utils.book_append_sheet(wb, wsVentas, "Ventas por producto");
    window.XLSX.writeFile(wb, "analisis-" + ST.todayISO() + ".xlsx");
  }

  /* ------------------------------------------------------------------ */
  /* Render + eventos                                                     */
  /* ------------------------------------------------------------------ */

  function render() {
    document.getElementById("app").innerHTML = state.authed ? renderApp() : renderLogin();
  }

  function onClick(e) {
    var el = e.target.closest("[data-action]");
    if (!el) return;
    var action = el.dataset.action;
    var id = el.dataset.id;

    if (action === "tab") {
      state.tab = el.dataset.tab; state.selectedClienteId = null; render();
      if (state.tab === "analisis") cargarAnalisis().then(render).catch(showError);
      return;
    }
    if (action === "logout") {
      ST.logout().then(function () { state.authed = false; render(); }).catch(showError);
      return;
    }
    if (action === "filtrar-turnos") { state.turnoFilter = el.dataset.filter; render(); return; }
    if (action === "toggle-add-turno") { state.showAddTurno = !state.showAddTurno; render(); return; }
    if (action === "turno-edit-toggle") { state.editingTurnoId = state.editingTurnoId === id ? null : id; render(); return; }
    if (action === "turno-confirm") { mutarTurnoEstado(id, "confirmado"); return; }
    if (action === "turno-complete") { mutarTurnoEstado(id, "completado"); return; }
    if (action === "turno-cancel") { mutarTurnoEstado(id, "cancelado"); return; }
    if (action === "open-cliente") { state.selectedClienteId = id; state.showAddSesion = false; render(); return; }
    if (action === "back-clientes") { state.selectedClienteId = null; render(); return; }
    if (action === "toggle-add-sesion") { state.showAddSesion = !state.showAddSesion; render(); return; }
    if (action === "toggle-producto-activo") {
      var producto = ST.DB.productos.filter(function (x) { return x.id === id; })[0];
      if (producto) ST.editarProducto(id, { activo: !producto.activo }).then(render).catch(showError);
      return;
    }
    if (action === "delete-producto") {
      if (!confirm("¿Eliminar este producto del catálogo?")) return;
      ST.eliminarProducto(id).then(render).catch(showError);
      return;
    }
    if (action === "edit-producto-toggle") { state.editingProductoId = state.editingProductoId === id ? null : id; render(); return; }
    if (action === "toggle-add-producto") { state.showAddProducto = !state.showAddProducto; render(); return; }
    if (action === "toggle-registrar-venta") { state.showRegistrarVenta = !state.showRegistrarVenta; render(); return; }
    if (action === "eliminar-venta") {
      if (!confirm("¿Eliminar esta venta? El stock del producto se va a restituir.")) return;
      ST.eliminarVenta(id).then(function () { return ST.cargarProductos(); }).then(render).catch(showError);
      return;
    }
    if (action === "exportar-imagen") { exportarImagen(); return; }
    if (action === "exportar-pdf") { exportarPDF(); return; }
    if (action === "exportar-excel") { exportarExcel(); return; }
  }

  function mutarTurnoEstado(id, estado) {
    ST.editarTurno(id, { estado: estado }).then(function () { state.editingTurnoId = null; render(); }).catch(showError);
  }

  function onSubmit(e) {
    var form = e.target.closest("[data-form]");
    if (!form) return;
    e.preventDefault();
    var type = form.dataset.form;
    var fd = new FormData(form);

    if (type === "admin-login") {
      if (state.busy) return;
      state.busy = true; state.loginError = ""; render();
      var email = (fd.get("email") || "").trim();
      var clave = fd.get("clave") || "";
      ST.login({ email: email, password: clave })
        .then(function (usuario) {
          if (usuario.rol !== "admin") {
            return ST.logout().then(function () {
              var e2 = new Error("Esta cuenta no tiene permisos de administrador.");
              e2.handled = true;
              throw e2;
            });
          }
          state.authed = true;
          return ST.cargarDatosAdmin();
        })
        .then(function () { state.busy = false; render(); })
        .catch(function (err) {
          state.busy = false;
          state.loginError = err.status === 401 ? "Email o contraseña incorrectos." : err.message;
          render();
        });
      return;
    }

    if (type === "editar-turno") {
      ST.editarTurno(form.dataset.id, {
        fecha: fd.get("fecha"), hora: fd.get("hora"), tratamiento: fd.get("tratamiento"), notas: fd.get("notas")
      }).then(function () { state.editingTurnoId = null; render(); }).catch(showError);
      return;
    }

    if (type === "nuevo-turno") {
      var clienteId = fd.get("clienteId") || undefined;
      var clienteNombre = clienteId ? undefined : (fd.get("clienteNombre") || "Sin nombre");
      var estadoDeseado = fd.get("estado");
      ST.crearTurno({
        clienteId: clienteId, clienteNombre: clienteNombre,
        tratamiento: fd.get("tratamiento"), fecha: fd.get("fecha"), hora: fd.get("hora"), notas: ""
      }).then(function (turno) {
        if (estadoDeseado && estadoDeseado !== "pendiente") {
          return ST.editarTurno(turno.id, { estado: estadoDeseado });
        }
      }).then(function () { state.showAddTurno = false; render(); }).catch(showError);
      return;
    }

    if (type === "nueva-sesion-manual") {
      ST.crearTurno({ clienteId: form.dataset.id, tratamiento: fd.get("tratamiento"), fecha: fd.get("fecha"), hora: "—", notas: fd.get("notas") || "" })
        .then(function (turno) { return ST.editarTurno(turno.id, { estado: "completado" }); })
        .then(function () { state.showAddSesion = false; render(); })
        .catch(showError);
      return;
    }

    if (type === "nuevo-producto") {
      ST.crearProducto({
        nombre: fd.get("nombre"), categoria: fd.get("categoria"),
        precio: Number(fd.get("precio") || 0), costo: Number(fd.get("costo") || 0), stock: Number(fd.get("stock") || 0),
        descripcion: fd.get("descripcion") || ""
      }).then(function () { state.showAddProducto = false; render(); }).catch(showError);
      return;
    }

    if (type === "editar-producto") {
      ST.editarProducto(form.dataset.id, {
        nombre: fd.get("nombre"), categoria: fd.get("categoria"),
        precio: Number(fd.get("precio") || 0), costo: Number(fd.get("costo") || 0), stock: Number(fd.get("stock") || 0),
        descripcion: fd.get("descripcion") || ""
      }).then(function () { state.editingProductoId = null; render(); }).catch(showError);
      return;
    }

    if (type === "rango-fechas") {
      state.analisisDesde = fd.get("desde") || null;
      state.analisisHasta = fd.get("hasta") || null;
      cargarAnalisis().then(render).catch(showError);
      return;
    }

    if (type === "registrar-venta") {
      ST.crearVenta({
        productoId: fd.get("productoId"), cantidad: Math.max(1, Number(fd.get("cantidad") || 1)),
        fecha: fd.get("fecha") || ST.todayISO(), clienteId: fd.get("clienteId") || null
      }).then(function () { return ST.cargarProductos(); })
        .then(function () { state.showRegistrarVenta = false; render(); })
        .catch(showError);
      return;
    }
  }

  document.addEventListener("click", onClick);
  document.addEventListener("submit", onSubmit);

  /* ------------------------------------------------------------------ */
  /* Arranque: ver si ya hay una sesión de administrador activa           */
  /* ------------------------------------------------------------------ */

  Promise.all([ST.cargarNegocio().catch(function () { return null; }), ST.me().catch(function () { return null; })])
    .then(function () {
      if (ST.currentUser && ST.currentUser.rol === "admin") {
        state.authed = true;
        return ST.cargarDatosAdmin().catch(function () {});
      }
    })
    .then(render)
    .catch(render);
})();
