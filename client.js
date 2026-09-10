(function () {
  "use strict";
  var ST = window.ST;

  var state = {
    view: "cargando",
    dashboardTab: "inicio",
    showLogin: false,
    loginMode: "login",
    loginError: "",
    registerModalError: "",
    bookingStep: 1,
    bookingDraft: null,
    bookingBlocked: false,
    bookingError: "",
    registerError: "",
    justBooked: false,
    busy: false
  };

  var galeriaState = { index: 0, interval: null };
  var TRABAJOS = [
    { archivo: "images/trabajo-labios.jpg", alt: "Antes y después de micropigmentación de labios", titulo: "Micropigmentación de labios", sub: "Antes y después" },
    { archivo: "images/trabajo-cejas.jpg", alt: "Cejas efecto polvo y delineado inferior", titulo: "Cejas efecto polvo", sub: "Microblading + delineado inferior" },
    { archivo: "images/trabajo-delineado.jpg", alt: "Delineado de ojos superior e inferior", titulo: "Delineado de ojos", sub: "Superior e inferior" }
  ];

  function renderLanding() {
    return "" +
      renderHeader() +
      renderLoginModal() +
      '<main id="contenido-principal">' +
        renderHero() +
        renderServicios() +
        renderGaleria() +
        renderSobreEllocal() +
        renderMapa() +
        renderReserva() +
      "</main>" +
      renderFooter();
  }

  function renderHeader() {
    return (
      '<header class="site-header">' +
        '<div class="site-header-inner">' +
          '<a class="brand" href="#inicio">' +
            '<span class="brand-mark" aria-hidden="true">T</span>' +
            '<span class="brand-text">' + ST.esc(ST.negocio.nombre) + "</span>" +
          "</a>" +
          '<nav class="site-nav" aria-label="Navegación principal">' +
            '<a href="#servicios">Servicios</a>' +
            '<a href="#trabajos">Trabajos</a>' +
            '<a href="#el-local">El local</a>' +
            '<a href="#ubicacion">Ubicación</a>' +
            '<a href="#reservar" class="site-nav-cta">Reservar turno</a>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-action="open-login">Ingresar</button>' +
          "</nav>" +
        "</div>" +
      "</header>"
    );
  }

  function renderHero() {
    return (
      '<section class="hero" id="inicio">' +
        '<div class="hero-inner">' +
          '<p class="eyebrow">Reservá online, sin llamadas ni esperas</p>' +
          "<h1>Turnos simples, historial siempre a mano</h1>" +
          '<p class="hero-lede">Elegí el servicio, el día y el horario que te quede mejor. Nosotros confirmamos tu turno y vos podés ver tus próximas citas y el detalle de tus tratamientos cuando quieras.</p>' +
          '<div class="hero-actions">' +
            '<a class="btn btn-primary" href="#reservar">Reservar turno</a>' +
            '<a class="btn btn-ghost" href="#servicios">Ver servicios</a>' +
          "</div>" +
        "</div>" +
      "</section>"
    );
  }

  function renderServicios() {
    var cards = ST.TRATAMIENTOS.map(function (t) {
      return (
        '<li class="service-card">' +
          '<span class="service-name">' + ST.esc(t) + "</span>" +
          '<a href="#reservar" class="service-link">Reservar</a>' +
        "</li>"
      );
    }).join("");

    return (
      '<section class="section" id="servicios" aria-labelledby="servicios-titulo">' +
        '<div class="section-inner">' +
          '<h2 id="servicios-titulo">Servicios disponibles</h2>' +
          '<p class="section-lede">Deslizá para ver todos los servicios.</p>' +
          '<div class="service-carousel-wrap">' +
            '<button type="button" class="service-arrow service-arrow-prev" data-action="servicios-prev" aria-label="Servicios anteriores">&lsaquo;</button>' +
            '<ul class="service-carousel" id="service-carousel">' + cards + "</ul>" +
            '<button type="button" class="service-arrow service-arrow-next" data-action="servicios-next" aria-label="Más servicios">&rsaquo;</button>' +
          "</div>" +
        "</div>" +
      "</section>"
    );
  }

  function renderGaleria() {
    var slides = TRABAJOS.map(function (t, i) {
      return '<img src="' + t.archivo + '" alt="' + ST.esc(t.alt) + '" class="foto-banner-slide' + (i === 0 ? " is-active" : "") + '" data-slide="' + i + '" loading="' + (i === 0 ? "eager" : "lazy") + '">';
    }).join("");
    var dots = TRABAJOS.map(function (t, i) {
      return '<button type="button" class="foto-banner-dot' + (i === 0 ? " is-active" : "") + '" data-action="galeria-dot" data-index="' + i + '" aria-label="Ver foto ' + (i + 1) + '"></button>';
    }).join("");

    return (
      '<section class="section section-muted" id="trabajos" aria-labelledby="trabajos-titulo">' +
        '<div class="section-inner">' +
          '<h2 id="trabajos-titulo">Trabajos realizados</h2>' +
          '<p class="section-lede">Algunos resultados reales de tratamientos hechos en el local.</p>' +
          '<div class="foto-banner" id="foto-banner">' +
            '<div class="foto-banner-track">' + slides + "</div>" +
            '<button type="button" class="foto-banner-arrow foto-banner-arrow-prev" data-action="galeria-prev" aria-label="Foto anterior">&lsaquo;</button>' +
            '<button type="button" class="foto-banner-arrow foto-banner-arrow-next" data-action="galeria-next" aria-label="Foto siguiente">&rsaquo;</button>' +
            '<div class="foto-banner-glass">' +
              '<p class="foto-banner-title">' + ST.esc(TRABAJOS[0].titulo) + "</p>" +
              '<p class="foto-banner-sub">' + ST.esc(TRABAJOS[0].sub) + "</p>" +
              '<div class="foto-banner-dots">' + dots + "</div>" +
            "</div>" +
          "</div>" +
        "</div>" +
      "</section>"
    );
  }

  function actualizarGaleriaDOM(index) {
    var banner = document.getElementById("foto-banner");
    if (!banner) return;
    galeriaState.index = index;
    var slides = banner.querySelectorAll(".foto-banner-slide");
    for (var i = 0; i < slides.length; i++) slides[i].classList.toggle("is-active", i === index);
    var dots = banner.querySelectorAll(".foto-banner-dot");
    for (var j = 0; j < dots.length; j++) dots[j].classList.toggle("is-active", j === index);
    var titleEl = banner.querySelector(".foto-banner-title");
    var subEl = banner.querySelector(".foto-banner-sub");
    if (titleEl) titleEl.textContent = TRABAJOS[index].titulo;
    if (subEl) subEl.textContent = TRABAJOS[index].sub;
  }

  function iniciarGaleriaCarousel(resetIndex) {
    if (galeriaState.interval) { clearInterval(galeriaState.interval); galeriaState.interval = null; }
    var banner = document.getElementById("foto-banner");
    if (!banner) return;
    if (resetIndex) galeriaState.index = 0;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    galeriaState.interval = setInterval(function () {
      actualizarGaleriaDOM((galeriaState.index + 1) % TRABAJOS.length);
    }, 4500);
  }

  function renderSobreEllocal() {
    return (
      '<section class="section" id="el-local" aria-labelledby="local-titulo">' +
        '<div class="section-inner">' +
          '<h2 id="local-titulo">Sobre el local</h2>' +
          '<div class="info-grid">' +
            '<div class="info-card"><h3>Profesional</h3><p>Miriam García · Cosmetóloga matriculada (MP 23639)</p></div>' +
            '<div class="info-card"><h3>Dirección</h3><p>Av. Alvear 4877, Fontana, Chaco</p></div>' +
            '<div class="info-card"><h3>Horarios</h3><p>[Completar días y horario de atención]</p></div>' +
            '<div class="info-card"><h3>Contacto</h3><p>' +
              (ST.negocio.whatsapp ? "WhatsApp: " + ST.esc(ST.negocio.whatsapp) : "[Completar WhatsApp de contacto]") +
              '<br>Instagram: <a href="https://instagram.com/Miriam_garcia567" target="_blank" rel="noopener">@Miriam_garcia567</a>' +
            "</p></div>" +
          "</div>" +
        "</div>" +
      "</section>"
    );
  }

  function renderMapa() {
    return (
      '<section class="section section-muted" id="ubicacion" aria-labelledby="ubicacion-titulo">' +
        '<div class="section-inner">' +
          '<h2 id="ubicacion-titulo">Cómo llegar</h2>' +
          '<p class="section-lede">Av. Alvear 4877, Fontana, Chaco.</p>' +
          '<div class="map-embed">' +
            '<iframe src="https://www.google.com/maps?q=Av.+Alvear+4877,+Fontana,+Chaco,+Argentina&output=embed" width="100%" height="320" style="border:0;" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Ubicación de Miriam García Cosmetología en el mapa"></iframe>' +
          "</div>" +
        "</div>" +
      "</section>"
    );
  }

  function renderReserva() {
    return (
      '<section class="section" id="reservar" aria-labelledby="reservar-titulo">' +
        '<div class="section-inner section-inner-narrow">' +
          '<h2 id="reservar-titulo">Reservar turno</h2>' +
          '<p class="section-lede">Completá tus datos y elegí el horario. Tu turno queda pendiente hasta que lo confirmemos.</p>' +
          renderBookingCard() +
        "</div>" +
      "</section>"
    );
  }

  function renderBookingCard() {
    if (state.justBooked) {
      return (
        '<div class="card booking-success" role="status">' +
          "<h3>Listo, recibimos tu solicitud</h3>" +
          "<p>Tu turno quedó como pendiente de confirmación. Te vamos a contactar para confirmarlo.</p>" +
          '<button type="button" class="btn btn-primary" data-action="go-dashboard">Ver mi turno</button>' +
        "</div>"
      );
    }

    if (state.bookingBlocked) {
      return (
        '<div class="card">' +
          "<h3>Ya existe una cuenta con ese email</h3>" +
          "<p>Iniciá sesión para agendar este turno desde tu cuenta.</p>" +
          '<button type="button" class="btn btn-primary" data-action="open-login">Iniciar sesión</button>' +
          '<button type="button" class="link-btn" style="margin-top:10px;" data-action="booking-restart">Probar con otro email</button>' +
        "</div>"
      );
    }

    if (state.bookingStep === 2 && state.bookingDraft) {
      return (
        '<div class="card">' +
          '<p class="step-indicator">Paso 2 de 2</p>' +
          "<h3>Creá una contraseña para tu cuenta</h3>" +
          '<p class="section-lede" style="margin-bottom:16px;">La vas a usar para ver tu historial y tus próximos turnos la próxima vez que entres.</p>' +
          '<form data-form="crear-cuenta" novalidate>' +
            '<div class="field"><label for="reg-clave">Contraseña</label><input id="reg-clave" name="clave" type="password" minlength="6" required autocomplete="new-password"></div>' +
            '<div class="field"><label for="reg-clave2">Repetir contraseña</label><input id="reg-clave2" name="clave2" type="password" minlength="6" required autocomplete="new-password"></div>' +
            (state.registerError ? '<p class="form-error">' + ST.esc(state.registerError) + "</p>" : "") +
            '<button class="btn btn-primary btn-block" type="submit" ' + (state.busy ? "disabled" : "") + ">" + (state.busy ? "Guardando…" : "Confirmar y crear mi turno") + "</button>" +
            '<button class="link-btn" type="button" style="margin-top:10px;" data-action="booking-restart">Volver a empezar</button>' +
          "</form>" +
        "</div>"
      );
    }

    var opciones = ST.TRATAMIENTOS.map(function (t) { return "<option>" + ST.esc(t) + "</option>"; }).join("");
    var horas = ST.timeSlots().map(function (h) { return '<option value="' + h + '">' + h + " hs</option>"; }).join("");
    var draft = state.bookingDraft || {};

    return (
      '<div class="card">' +
        '<p class="step-indicator">Paso 1 de 2</p>' +
        '<form data-form="solicitar-turno" novalidate>' +
          '<div class="field"><label for="b-tratamiento">Servicio</label><select id="b-tratamiento" name="tratamiento" required>' + opciones + "</select></div>" +
          '<div class="field-row">' +
            '<div class="field"><label for="b-fecha">Fecha</label><input id="b-fecha" type="date" name="fecha" min="' + ST.todayISO() + '" value="' + ST.esc(draft.fecha || "") + '" required></div>' +
            '<div class="field"><label for="b-hora">Horario</label><select id="b-hora" name="hora" required>' + horas + "</select></div>" +
          "</div>" +
          '<div class="field"><label for="b-nombre">Nombre y apellido</label><input id="b-nombre" name="nombre" value="' + ST.esc(draft.nombre || "") + '" required></div>' +
          '<div class="field-row">' +
            '<div class="field"><label for="b-email">Email</label><input id="b-email" name="email" type="email" value="' + ST.esc(draft.email || "") + '" required></div>' +
            '<div class="field"><label for="b-telefono">WhatsApp</label><input id="b-telefono" name="telefono" type="tel" value="' + ST.esc(draft.telefono || "") + '" required></div>' +
          "</div>" +
          (state.bookingError ? '<p class="form-error">' + ST.esc(state.bookingError) + "</p>" : "") +
          '<button class="btn btn-primary btn-block" type="submit" ' + (state.busy ? "disabled" : "") + ">" + (state.busy ? "Enviando…" : "Continuar") + "</button>" +
        "</form>" +
        '<p class="hint" style="margin-top:14px;">¿Ya tenés cuenta? <button type="button" class="link-btn" data-action="open-login">Iniciá sesión</button></p>' +
      "</div>"
    );
  }

  function renderLoginModal() {
    if (!state.showLogin) return "";
    var isRegister = state.loginMode === "register";

    var tabsHtml =
      '<div class="modal-tabs">' +
        '<button type="button" class="modal-tab ' + (!isRegister ? "active" : "") + '" data-action="login-mode" data-mode="login">Iniciar sesión</button>' +
        '<button type="button" class="modal-tab ' + (isRegister ? "active" : "") + '" data-action="login-mode" data-mode="register">Crear cuenta</button>' +
      "</div>";

    var formHtml = isRegister ?
      (
        '<form data-form="registro-cliente" novalidate>' +
          '<div class="field"><label for="rg-nombre">Nombre y apellido</label><input id="rg-nombre" name="nombre" required></div>' +
          '<div class="field"><label for="rg-email">Email</label><input id="rg-email" name="email" type="email" required></div>' +
          '<div class="field"><label for="rg-telefono">WhatsApp</label><input id="rg-telefono" name="telefono" type="tel" required></div>' +
          '<div class="field"><label for="rg-clave">Contraseña</label><input id="rg-clave" name="clave" type="password" minlength="6" required autocomplete="new-password"></div>' +
          '<div class="field"><label for="rg-clave2">Repetir contraseña</label><input id="rg-clave2" name="clave2" type="password" minlength="6" required autocomplete="new-password"></div>' +
          (state.registerModalError ? '<p class="form-error">' + ST.esc(state.registerModalError) + "</p>" : "") +
          '<button class="btn btn-primary btn-block" type="submit" ' + (state.busy ? "disabled" : "") + ">" + (state.busy ? "Creando…" : "Crear mi cuenta") + "</button>" +
        "</form>"
      ) :
      (
        '<form data-form="login-cliente" novalidate>' +
          '<div class="field"><label for="lg-email">Email</label><input id="lg-email" name="email" type="email" required autofocus></div>' +
          '<div class="field"><label for="lg-clave">Contraseña</label><input id="lg-clave" name="clave" type="password" required></div>' +
          (state.loginError ? '<p class="form-error">' + ST.esc(state.loginError) + "</p>" : "") +
          '<button class="btn btn-primary btn-block" type="submit" ' + (state.busy ? "disabled" : "") + ">" + (state.busy ? "Ingresando…" : "Ingresar") + "</button>" +
        "</form>"
      );

    return (
      '<div class="modal-overlay" data-action="close-login">' +
        '<div class="modal-box" data-action="noop" role="dialog" aria-modal="true" aria-labelledby="login-titulo">' +
          '<button type="button" class="modal-close" data-action="close-login" aria-label="Cerrar">&times;</button>' +
          '<h2 id="login-titulo">' + (isRegister ? "Crear cuenta" : "Iniciar sesión") + "</h2>" +
          tabsHtml +
          formHtml +
        "</div>" +
      "</div>"
    );
  }

  function renderFooter() {
    return '<footer class="site-footer"><p>' + ST.esc(ST.negocio.nombre) + " · Av. Alvear 4877, Fontana, Chaco · " + (ST.negocio.whatsapp ? ST.esc(ST.negocio.whatsapp) : "[Teléfono de contacto]") + "</p></footer>";
  }

  function renderDashboard() {
    var c = ST.currentUser;
    if (!c) { state.view = "landing"; return renderLanding(); }

    var tabs = [
      { key: "inicio", label: "Inicio" },
      { key: "historial", label: "Mi historial" },
      { key: "agendar", label: "Agendar turno" },
      { key: "tienda", label: "Tienda" }
    ];
    var tabsHtml = tabs.map(function (t) {
      return '<button class="tab ' + (t.key === state.dashboardTab ? "active" : "") + '" data-action="dash-tab" data-tab="' + t.key + '">' + t.label + "</button>";
    }).join("");

    var body = "";
    if (state.dashboardTab === "inicio") body = dashInicio(c);
    else if (state.dashboardTab === "historial") body = dashHistorial(c);
    else if (state.dashboardTab === "agendar") body = dashAgendar(c);
    else if (state.dashboardTab === "tienda") body = dashTienda();

    return (
      '<header class="app-header">' +
        '<div class="app-header-inner">' +
          '<a class="brand" href="#" data-action="go-landing"><span class="brand-mark" aria-hidden="true">T</span><span class="brand-text">' + ST.esc(ST.negocio.nombre) + "</span></a>" +
          '<button type="button" class="btn btn-ghost btn-sm" data-action="logout">Cerrar sesión</button>' +
        "</div>" +
        '<nav class="tabs" aria-label="Secciones de mi cuenta">' + tabsHtml + "</nav>" +
      "</header>" +
      '<main id="contenido-principal" class="content">' + body + "</main>"
    );
  }

  function dashInicio(c) {
    var todos = ST.turnosDeCliente(c.id);
    var futuros = todos.filter(function (t) { return ST.isFuturo(t) && t.estado !== "cancelado" && t.estado !== "completado"; });
    var completados = todos.filter(function (t) { return t.estado === "completado"; });
    var proximo = futuros[0];
    var tratamientosDistintos = {};
    completados.forEach(function (t) { tratamientosDistintos[t.tratamiento] = true; });

    var proximoHtml = proximo ?
      '<div class="card">' +
        '<p class="eyebrow">Tu próximo turno</p>' +
        "<h2>" + ST.esc(proximo.tratamiento) + "</h2>" +
        '<p class="section-lede">' + ST.formatFecha(proximo.fecha, { weekday: "long", day: "numeric", month: "long" }) + " · " + proximo.hora + " hs</p>" +
        '<span class="badge badge-' + proximo.estado + '">' + ST.labelEstado(proximo.estado) + "</span>" +
      "</div>" :
      '<div class="empty"><strong>Todavía no tenés turnos agendados</strong><p>Elegí un servicio y reservá tu próximo turno.</p><button class="btn btn-primary" style="margin-top:14px;" data-action="dash-tab" data-tab="agendar">Agendar turno</button></div>';

    return (
      '<h1 class="page-title">Hola, ' + ST.esc((c.nombre || "").split(" ")[0]) + "</h1>" +
      '<div class="grid-2">' +
        '<div class="stack">' +
          proximoHtml +
          '<div class="kpi-row">' +
            '<div class="kpi"><p class="n">' + completados.length + '</p><p class="l">Sesiones realizadas</p></div>' +
            '<div class="kpi"><p class="n">' + Object.keys(tratamientosDistintos).length + '</p><p class="l">Tipos de tratamiento</p></div>' +
            '<div class="kpi"><p class="n">' + futuros.length + '</p><p class="l">Próximos turnos</p></div>' +
          "</div>" +
        "</div>" +
        '<div class="card">' +
          "<h2>Accesos rápidos</h2>" +
          '<div class="stack" style="margin-top:12px;">' +
            '<button class="btn btn-primary btn-block" data-action="dash-tab" data-tab="agendar">Agendar un turno</button>' +
            '<button class="btn btn-ghost btn-block" data-action="dash-tab" data-tab="historial">Ver mi historial</button>' +
            '<button class="btn btn-ghost btn-block" data-action="dash-tab" data-tab="tienda">Ver la tienda</button>' +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function dashHistorial(c) {
    var todos = ST.turnosDeCliente(c.id);
    var pasados = todos.filter(function (t) { return t.estado === "completado"; });
    var futuros = todos.filter(function (t) { return ST.isFuturo(t) && t.estado !== "cancelado" && t.estado !== "completado"; });

    var futurosHtml = futuros.map(function (t) {
      return (
        '<li class="timeline-item"><span class="timeline-dot dot-upcoming"></span>' +
          '<p class="timeline-date">' + ST.formatFecha(t.fecha) + " · " + t.hora + " hs</p>" +
          '<p class="timeline-title">' + ST.esc(t.tratamiento) + "</p>" +
          '<span class="badge badge-' + t.estado + '">' + ST.labelEstado(t.estado) + "</span>" +
        "</li>"
      );
    }).join("");

    var pasadosHtml = pasados.slice().reverse().map(function (t) {
      return (
        '<li class="timeline-item"><span class="timeline-dot"></span>' +
          '<p class="timeline-date">' + ST.formatFecha(t.fecha) + "</p>" +
          '<p class="timeline-title">' + ST.esc(t.tratamiento) + " — sesión " + ST.numeroDeSesion(c.id, t) + "</p>" +
          (t.notas ? '<p class="timeline-notes">' + ST.esc(t.notas) + "</p>" : "") +
        "</li>"
      );
    }).join("");

    return (
      '<h1 class="page-title">Mi historial</h1>' +
      '<div class="stack">' +
        (futuros.length ? '<div class="card"><h2>Próximos turnos</h2><ul class="timeline">' + futurosHtml + "</ul></div>" : "") +
        '<div class="card">' +
          "<h2>Tratamientos realizados</h2>" +
          (pasados.length ? '<ul class="timeline">' + pasadosHtml + "</ul>" : '<div class="empty"><strong>Todavía no hay tratamientos registrados</strong><p>Cuando se complete tu primer turno, va a aparecer acá.</p></div>') +
        "</div>" +
      "</div>"
    );
  }

  function dashAgendar(c) {
    var opciones = ST.TRATAMIENTOS.map(function (t) { return "<option>" + ST.esc(t) + "</option>"; }).join("");
    var horas = ST.timeSlots().map(function (h) { return '<option value="' + h + '">' + h + " hs</option>"; }).join("");
    return (
      '<h1 class="page-title">Agendar turno</h1>' +
      '<div class="card" style="max-width:520px;">' +
        '<form data-form="agendar-turno-logueado" novalidate>' +
          '<div class="field"><label for="a-tratamiento">Servicio</label><select id="a-tratamiento" name="tratamiento" required>' + opciones + "</select></div>" +
          '<div class="field-row">' +
            '<div class="field"><label for="a-fecha">Fecha</label><input id="a-fecha" type="date" name="fecha" min="' + ST.todayISO() + '" required></div>' +
            '<div class="field"><label for="a-hora">Horario</label><select id="a-hora" name="hora" required>' + horas + "</select></div>" +
          "</div>" +
          '<div class="field"><label for="a-nota">Nota (opcional)</label><textarea id="a-nota" name="nota"></textarea></div>' +
          '<button class="btn btn-primary btn-block" type="submit" ' + (state.busy ? "disabled" : "") + ">" + (state.busy ? "Enviando…" : "Solicitar turno") + "</button>" +
        "</form>" +
      "</div>"
    );
  }

  function dashTienda() {
    var activos = ST.DB.productos.filter(function (p) { return p.activo; });
    var cards = activos.map(function (p) {
      var texto = encodeURIComponent("Hola! Te consulto por " + p.nombre + " (" + ST.money(p.precio) + ")");
      var link = "https://wa.me/" + (ST.negocio.whatsapp || "") + "?text=" + texto;
      return (
        '<li class="product-card">' +
          '<div class="product-swatch ' + ST.catClass(p.categoria) + '" aria-hidden="true">' + ST.esc((p.nombre || "?").charAt(0)) + "</div>" +
          '<div class="product-body">' +
            "<h3>" + ST.esc(p.nombre) + "</h3>" +
            '<p class="product-desc">' + ST.esc(p.descripcion) + "</p>" +
            '<p class="product-price">' + ST.money(p.precio) + "</p>" +
            (p.stock > 0 ?
              '<a class="btn btn-primary btn-block" href="' + link + '" target="_blank" rel="noopener">Consultar por WhatsApp</a>' :
              '<p class="stock-out">Sin stock por el momento</p>') +
          "</div>" +
        "</li>"
      );
    }).join("");

    return (
      '<h1 class="page-title">Tienda</h1>' +
      (activos.length ?
        '<ul class="shop-grid">' + cards + "</ul>" :
        '<div class="empty"><strong>Todavía no hay productos cargados</strong><p>Cuando se agreguen productos al catálogo, van a aparecer acá.</p></div>')
    );
  }

  function render() {
    var app = document.getElementById("app");
    if (state.view === "cargando") {
      app.innerHTML = '<div class="landing"><p style="color:var(--grey);font-size:14px;">Cargando…</p></div>';
      return;
    }
    app.innerHTML = state.view === "dashboard" ? renderDashboard() : renderLanding();
    if (state.view === "landing") iniciarGaleriaCarousel(true);
  }

  function showError(err) {
    alert((err && err.message) || "Ocurrió un error de conexión. Probá de nuevo.");
  }

  function resetBooking() {
    state.bookingStep = 1;
    state.bookingDraft = null;
    state.bookingBlocked = false;
    state.bookingError = "";
    state.registerError = "";
    state.justBooked = false;
  }

  function onClick(e) {
    var el = e.target.closest("[data-action]");
    if (!el) return;
    var action = el.dataset.action;

    if (action === "open-login") { state.showLogin = true; state.loginMode = "login"; state.loginError = ""; state.registerModalError = ""; }
    else if (action === "close-login") { state.showLogin = false; }
    else if (action === "login-mode") { state.loginMode = el.dataset.mode; state.loginError = ""; state.registerModalError = ""; }
    else if (action === "noop") { return; }
    else if (action === "go-landing") { state.view = "landing"; resetBooking(); }
    else if (action === "go-dashboard") { state.view = "dashboard"; state.dashboardTab = "inicio"; resetBooking(); loadDashboardData(); }
    else if (action === "logout") {
      ST.logout().then(function () { state.view = "landing"; state.dashboardTab = "inicio"; resetBooking(); render(); }).catch(showError);
      return;
    }
    else if (action === "dash-tab") { state.dashboardTab = el.dataset.tab; }
    else if (action === "booking-restart") { resetBooking(); }
    else if (action === "galeria-prev") {
      actualizarGaleriaDOM((galeriaState.index - 1 + TRABAJOS.length) % TRABAJOS.length);
      iniciarGaleriaCarousel(false);
      return;
    }
    else if (action === "galeria-next") {
      actualizarGaleriaDOM((galeriaState.index + 1) % TRABAJOS.length);
      iniciarGaleriaCarousel(false);
      return;
    }
    else if (action === "galeria-dot") {
      actualizarGaleriaDOM(Number(el.dataset.index));
      iniciarGaleriaCarousel(false);
      return;
    }
    else if (action === "servicios-prev") {
      var carPrev = document.getElementById("service-carousel");
      if (carPrev) carPrev.scrollBy({ left: -232, behavior: "smooth" });
      return;
    }
    else if (action === "servicios-next") {
      var carNext = document.getElementById("service-carousel");
      if (carNext) carNext.scrollBy({ left: 232, behavior: "smooth" });
      return;
    }
    else return;
    render();
  }

  function loadDashboardData() {
    ST.cargarDatosCliente().then(render).catch(showError);
  }

  function onSubmit(e) {
    var form = e.target.closest("[data-form]");
    if (!form) return;
    e.preventDefault();
    if (state.busy) return;
    var type = form.dataset.form;
    var fd = new FormData(form);

    if (type === "login-cliente") {
      state.busy = true; state.loginError = ""; render();
      ST.login({ email: (fd.get("email") || "").trim(), password: fd.get("clave") || "" })
        .then(function () {
          state.busy = false; state.showLogin = false; state.view = "dashboard"; state.dashboardTab = "inicio";
          return ST.cargarDatosCliente();
        })
        .then(render)
        .catch(function (err) {
          state.busy = false;
          state.loginError = err.status === 401 ? "Email o contraseña incorrectos." : err.message;
          render();
        });
      return;
    }

    if (type === "registro-cliente") {
      var rClave1 = fd.get("clave") || "";
      var rClave2 = fd.get("clave2") || "";
      if (rClave1.length < 6) { state.registerModalError = "La contraseña debe tener al menos 6 caracteres."; render(); return; }
      if (rClave1 !== rClave2) { state.registerModalError = "Las contraseñas no coinciden."; render(); return; }

      state.busy = true; state.registerModalError = ""; render();
      ST.registro({
        nombre: (fd.get("nombre") || "").trim(),
        email: (fd.get("email") || "").trim(),
        telefono: (fd.get("telefono") || "").trim(),
        password: rClave1
      })
        .then(function () {
          state.busy = false; state.showLogin = false; state.view = "dashboard"; state.dashboardTab = "inicio";
          return ST.cargarDatosCliente();
        })
        .then(render)
        .catch(function (err) {
          state.busy = false;
          state.registerModalError = err.status === 409 ? "Ya existe una cuenta con ese email." : err.message;
          render();
        });
      return;
    }

    if (type === "solicitar-turno") {
      var draft = {
        tratamiento: fd.get("tratamiento"), fecha: fd.get("fecha"), hora: fd.get("hora"),
        nombre: (fd.get("nombre") || "").trim(), email: (fd.get("email") || "").trim(), telefono: (fd.get("telefono") || "").trim()
      };
      state.bookingDraft = draft;
      state.bookingStep = 2;
      state.bookingError = "";
      render();
      return;
    }

    if (type === "crear-cuenta") {
      var clave1 = fd.get("clave") || "";
      var clave2 = fd.get("clave2") || "";
      if (clave1.length < 6) { state.registerError = "La contraseña debe tener al menos 6 caracteres."; render(); return; }
      if (clave1 !== clave2) { state.registerError = "Las contraseñas no coinciden."; render(); return; }

      var d = state.bookingDraft;
      state.busy = true; state.registerError = ""; render();
      ST.registro({ nombre: d.nombre, email: d.email, telefono: d.telefono, password: clave1 })
        .then(function () {
          return ST.crearTurno({ tratamiento: d.tratamiento, fecha: d.fecha, hora: d.hora });
        })
        .then(function () {
          state.busy = false;
          state.bookingStep = 1; state.bookingDraft = null; state.bookingBlocked = false;
          state.justBooked = true;
          render();
        })
        .catch(function (err) {
          state.busy = false;
          if (err.status === 409) { state.bookingBlocked = true; }
          else { state.registerError = err.message; }
          render();
        });
      return;
    }

    if (type === "agendar-turno-logueado") {
      state.busy = true; render();
      ST.crearTurno({ tratamiento: fd.get("tratamiento"), fecha: fd.get("fecha"), hora: fd.get("hora"), notas: fd.get("nota") || "" })
        .then(function () {
          state.busy = false;
          state.dashboardTab = "inicio";
          render();
        })
        .catch(function (err) { state.busy = false; showError(err); render(); });
      return;
    }
  }

  document.addEventListener("click", onClick);
  document.addEventListener("submit", onSubmit);

  Promise.all([ST.cargarNegocio().catch(function () { return null; }), ST.me().catch(function () { return null; })])
    .then(function () {
      if (ST.currentUser) {
        state.view = "dashboard";
        return ST.cargarDatosCliente().catch(function () {});
      }
      state.view = "landing";
    })
    .then(render)
    .catch(function () { state.view = "landing"; render(); });
})();
