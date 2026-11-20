/* ============================================================
   El 27 · PANTALLAS (lo que se ve y se toca)
   Usa el "cerebro" (logica.js) para calcular y el "almacén"
   (almacen.js) para guardar.
   ============================================================ */
(function () {
  'use strict';
  const L = window.Logica, A = window.Almacen, D = window.DatosPrueba;
  const $app = document.getElementById('app');
  const $modal = document.getElementById('modal');
  const $toast = document.getElementById('toast');

  let estado = null;      // todos los datos
  let yo = null;          // id de quien está usando la app
  let form = null;        // borrador del gasto que se está escribiendo
  let pago = null;        // borrador del pago
  let mesVista = null;    // mes que se mira en "Gastos"
  let filtroProd = '';
  let sinAcceso = false;   // solo modo demo

  // ¿Hay Firebase configurado? Si sí, la app usa la nube; si no, sigue en modo demo (Fase 1).
  const NUBE = !!(window.Nube && window.Nube.disponible());
  let fase = NUBE ? 'cargando' : 'app';   // cargando | login | sinacceso | setup | sinlista | error | app
  let correoSesion = '';
  let errorMsg = '';
  let guardandoSetup = false;
  const cierresIntentados = {};

  /* ---------------- utilidades ---------------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $$ = t => L.formatear(t);
  const fmtIn = t => L.formatear(t, { simbolo: false });
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const pad2 = n => String(n).padStart(2, '0');

  function hoyReal() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function hoy() { return (!NUBE && A.pref('fechaSim')) || hoyReal(); }
  function fechaCorta(f) { const p = f.split('-').map(Number); return p[2] + ' ' + L.MESES[p[1] - 1].slice(0, 3); }
  function fechaLarga(f) { const p = f.split('-').map(Number); return p[2] + ' de ' + L.MESES[p[1] - 1] + ' de ' + p[0]; }
  function mesCorto(m) { return L.MESES[Number(m.slice(5, 7)) - 1].slice(0, 3); }

  function usuario(id) { return estado.usuarios.find(u => u.id === id) || { id, apodo: '?', nombre: '?', color: '#888' }; }
  function avatar(u, cls) { return '<span class="avatar ' + (cls || '') + '" style="border-color:' + esc(u.color) + '">' + esc(u.apodo.charAt(0)) + '</span>'; }
  function categoria(id) { return estado.categorias.find(c => c.id === id) || estado.categorias.find(c => c.id === 'otros') || { nombre: 'Otros', icono: '📦' }; }
  function quien(id) { return id === yo ? 'Tú' : usuario(id).apodo; }

  function guardar() { if (!A.guardar(estado)) toast('⚠️ No se pudo guardar: el almacenamiento está lleno.'); }

  // Guardar un cambio: en la nube escribe ese dato en Firestore; en modo demo guarda todo en el navegador.
  function persistir(op, dato) {
    if (!NUBE) { guardar(); return; }
    Promise.resolve().then(() => window.Nube[op](dato)).catch(e => {
      if (op === 'guardarCierre') return;   // otro celular ya cerró ese mes: está bien
      console.error(e);
      toast('⚠️ No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.');
    });
  }
  // Fotos de facturas (en la nube se leen solo cuando se abren)
  function fotoSync(id) { return NUBE ? window.Nube.fotoCache(id) : A.foto(id); }
  function fotoCargar(id) { return NUBE ? window.Nube.cargarFoto(id) : Promise.resolve(A.foto(id)); }
  function fotoGuardar(id, d) { return NUBE ? window.Nube.guardarFoto(id, d) : Promise.resolve(A.guardarFoto(id, d)); }
  function fotoBorrar(id) { if (NUBE) window.Nube.borrarFoto(id); else A.borrarFoto(id); }
  let toastT = null;
  function toast(msg) {
    $toast.textContent = msg; $toast.classList.add('ver');
    clearTimeout(toastT); toastT = setTimeout(() => $toast.classList.remove('ver'), 3200);
  }
  function abrirModal(html) {
    $modal.innerHTML = '<div class="fondo-modal"><div class="modal" role="dialog" aria-modal="true">' + html + '</div></div>';
  }
  function cerrarModal() { $modal.innerHTML = ''; pago = null; }

  function ruta() { return (location.hash.replace(/^#\/?/, '') || 'inicio').split('/')[0]; }
  function ir(r) { if (ruta() === r) render(); else location.hash = '#/' + r; }

  /* ---------------- arranque ---------------- */
  function iniciar() {
    window.addEventListener('hashchange', () => { cerrarModal(); render(); window.scrollTo(0, 0); });
    if (NUBE) { iniciarNube(); render(); return; }
    estado = A.cargar();
    if (!estado || !estado.usuarios) { estado = D.vacio(); guardar(); }
    yo = A.pref('yo') || null;
    if (yo && !estado.usuarios.some(u => u.id === yo)) yo = null;
    cerrarVencidos();
    render();
  }

  function iniciarNube() {
    window.Nube.iniciar({
      cargando(email) { correoSesion = email; fase = 'cargando'; render(); },
      sesion() { estado = null; yo = null; form = null; fase = 'login'; render(); },
      sinAcceso(email) { correoSesion = email; estado = null; yo = null; fase = 'sinacceso'; render(); },
      error(e) { console.error(e); errorMsg = (e && (e.code || e.message)) || String(e); fase = 'error'; render(); },
      estado(est, email) { correoSesion = email; recibirEstado(est, email); }
    });
  }
  // Llegan los datos de la nube (y cada vez que alguien cambia algo)
  function recibirEstado(est, email) {
    estado = est;
    if (!est.usuarios.length) { fase = 'setup'; guardandoSetup = false; render(); return; }
    const u = est.usuarios.find(x => String(x.email || '').toLowerCase() === email);
    if (!u) { yo = null; fase = 'sinlista'; render(); return; }
    yo = u.id;
    if (!est.categorias.length) est.categorias = L.CATEGORIAS_BASE.map(c => Object.assign({}, c));
    const yaEstabaAdentro = fase === 'app';
    fase = 'app';
    if (yaEstabaAdentro && form && ruta() === 'nuevo') return;   // no interrumpir a quien está escribiendo un gasto
    render();
  }

  function cerrarVencidos() {
    const nuevos = L.cerrarMesesVencidos(estado, hoy());
    if (!nuevos.length) return;
    if (NUBE) nuevos.forEach(m => { if (!cierresIntentados[m]) { cierresIntentados[m] = 1; persistir('guardarCierre', estado.cierres[m]); } });
    else guardar();
    setTimeout(() => toast('🔒 Se cerró ' + nuevos.map(m => L.nombreMes(m)).join(' y ') + ' automáticamente'), 400);
  }

  /* ---------------- dibujar ---------------- */
  function render() {
    if (NUBE && fase !== 'app') { $app.innerHTML = vistaFase(); return; }
    cerrarVencidos();
    if (sinAcceso) { $app.innerHTML = vistaSinAcceso(); return; }
    if (!yo) { $app.innerHTML = vistaLogin(); return; }
    const r = ruta();
    let cuerpo;
    if (r === 'gastos') cuerpo = vistaGastos();
    else if (r === 'nuevo') cuerpo = vistaNuevo();
    else if (r === 'cruce') cuerpo = vistaCruce();
    else if (r === 'perfil') cuerpo = vistaPerfil();
    else if (r === 'productos') cuerpo = vistaProductos();
    else cuerpo = vistaInicio();
    const u = usuario(yo);
    $app.innerHTML =
      '<div class="app"><header class="cab"><div class="logo">El <span class="num">27</span></div><div class="espacio"></div>' +
      '<button class="yo" data-acc="ir" data-arg="perfil" aria-label="Mi perfil">' + avatar(u) + '<span>' + esc(u.apodo) + '</span></button></header>' +
      cuerpo + '</div>' + navegacion(r);
    if (r === 'nuevo' && form && form.abrirSelector) {
      form.abrirSelector = false;
      const inp = document.getElementById('inp-foto'); if (inp) setTimeout(() => inp.click(), 50);
    }
  }

  function navegacion(r) {
    const b = (id, txt) => '<button data-acc="nav" data-arg="' + id + '" class="' + (r === id || (id === 'perfil' && r === 'productos') ? 'activo' : '') + '">' + txt + '</button>';
    return '<nav class="nav"><div class="nav-in">' + b('inicio', 'Inicio') + b('gastos', 'Gastos') +
      '<button class="mas" data-acc="nav" data-arg="nuevo" aria-label="Nuevo gasto"><span class="circ">+</span></button>' +
      b('cruce', 'Cruce') + b('perfil', 'Perfil') + '</div></nav>';
  }

  /* ---------------- entrada ---------------- */
  function vistaLogin() {
    return '<div class="app"><div class="entrada"><div class="logo">El <span class="num">27</span></div>' +
      '<p class="lema">Las cuentas de la casa, claras y sin peleas.</p>' +
      '<div class="tarjeta"><h2>¿Quién eres?</h2><p class="peq" style="margin:0 0 12px">Modo de prueba (Fase 1). En la Fase 2 aquí aparecerá el botón <b>Entrar con Google</b>.</p>' +
      '<div style="display:grid;gap:10px">' +
      estado.usuarios.map(u => '<button class="btn borde bloque" style="justify-content:flex-start" data-acc="entrar" data-arg="' + esc(u.id) + '">' + avatar(u) + ' Entrar como ' + esc(u.apodo) + '</button>').join('') +
      '</div></div>' +
      '<button class="btn sec bloque" data-acc="entrarNoAutorizado">🚫 Probar con una cuenta NO autorizada</button></div></div>';
  }
  function vistaSinAcceso() {
    const correo = NUBE ? correoSesion : 'otra.persona@gmail.com';
    return '<div class="app"><div class="entrada"><div class="logo">El <span class="num">27</span></div><div class="tarjeta" style="margin-top:20px">' +
      '<h2>🚫 Sin acceso</h2><p>La cuenta <b>' + esc(correo) + '</b> no está autorizada para usar El 27.</p>' +
      '<p class="peq">Esta app es solo para los 3 roommates del apartamento. No se puede ver ni guardar ningún dato con esta cuenta. Si crees que es un error, pídele a Val, Santi o Pegui que revisen la lista de correos autorizados.</p>' +
      '<button class="btn bloque" data-acc="' + (NUBE ? 'salir' : 'volverLogin') + '">' + (NUBE ? 'Entrar con otra cuenta' : 'Volver') + '</button></div></div></div>';
  }

  /* ---- pantallas del modo nube (Firebase) ---- */
  function cajaEntrada(contenido) {
    return '<div class="app"><div class="entrada"><div class="logo">El <span class="num">27</span></div>' + contenido + '</div></div>';
  }
  function vistaFase() {
    if (fase === 'cargando') return cajaEntrada('<p class="lema">Cargando las cuentas de la casa…</p>');
    if (fase === 'sinacceso') return vistaSinAcceso();
    if (fase === 'error') {
      return cajaEntrada('<div class="tarjeta" style="margin-top:20px"><h2>😕 Algo salió mal</h2><p>No pudimos conectar con la base de datos.</p><p class="peq">Detalle técnico: ' + esc(errorMsg) + '</p>' +
        '<button class="btn bloque" data-acc="recargar">Reintentar</button></div>');
    }
    if (fase === 'sinlista') {
      return cajaEntrada('<div class="tarjeta" style="margin-top:20px"><h2>🤔 No te encuentro en la lista</h2><p>Tu cuenta <b>' + esc(correoSesion) + '</b> tiene permiso, pero no aparece entre los roommates guardados.</p>' +
        '<p class="peq">Pídele a Val que revise el correo de cada roommate en la configuración inicial.</p><button class="btn bloque" data-acc="salir">Entrar con otra cuenta</button></div>');
    }
    if (fase === 'setup') {
      return cajaEntrada('<p class="lema">Configuración inicial (se hace una sola vez)</p><div class="tarjeta"><h2>👥 Correos de los 3 roommates</h2>' +
        '<p class="peq" style="margin:0 0 12px">Escribe el correo de Google de cada uno, el mismo que está en las reglas de seguridad. Así la app sabe quién es quién cuando entra. Estás entrando con <b>' + esc(correoSesion) + '</b>.</p>' +
        D.USUARIOS.map(u => '<div class="campo"><label for="s-' + u.id + '">' + avatar(u) + ' ' + esc(u.nombre) + ' (' + esc(u.apodo) + ')</label><input type="text" id="s-' + u.id + '" data-setup="' + u.id + '" inputmode="email" autocomplete="off" placeholder="correo@gmail.com"></div>').join('') +
        '<div class="aviso mal oculto" id="err-setup"></div><button class="btn bloque" data-acc="guardarSetup" id="btn-setup">Guardar y empezar</button></div>' +
        '<button class="btn borde bloque" data-acc="salir">Salir</button>');
    }
    // login
    const archivo = location.protocol === 'file:';
    return cajaEntrada('<p class="lema">Las cuentas de la casa, claras y sin peleas.</p><div class="tarjeta"><h2>Entrar</h2>' +
      (archivo ? '<div class="aviso">Para entrar con Google abre la app desde <b>iniciar-servidor.bat</b> (se abre en http://localhost:8127) o desde la página publicada. Con doble clic en el archivo, Google no deja entrar.</div>' : '<p class="peq" style="margin:0 0 12px">Solo pueden entrar los 3 roommates.</p>') +
      '<button class="btn bloque" data-acc="entrarGoogle" ' + (archivo ? 'disabled' : '') + '>🔐 Entrar con Google</button></div>');
  }

  /* ---------------- INICIO ---------------- */
  function fraseTransf(t) {
    return esc(quien(t.de)) + (t.de === yo ? ' le pagas a ' : ' le paga a ') + esc(t.a === yo ? 'ti' : usuario(t.a).apodo);
  }
  function filaTransferencia(t) {
    return '<div class="l"><span>' + fraseTransf(t) + '</span><i class="pt"></i><b class="monto">' + $$(t.monto) + '</b></div>';
  }

  function vistaInicio() {
    const h = hoy(), mes = L.mesDe(h);
    const saldos = L.saldosDelMes(estado, mes);
    const cruce = L.cruzar(saldos);
    const lineas = L.lineasDelMes(estado, mes);
    const total = L.totalDelMes(estado, mes);
    const dias = L.ultimoDia(mes) - Number(h.slice(8, 10));
    const pend = L.pendientesCerrados(estado, h);

    const nombreMes = cap(L.nombreMes(mes)).split(' ')[0];
    let html = '';
    if (!NUBE && A.pref('fechaSim')) html += '<div class="aviso">🧪 Estás usando una <strong>fecha simulada</strong>: ' + fechaLarga(h) + '. (Se cambia en Perfil → Modo de prueba)</div>';

    pend.forEach(t => {
      html += '<div class="aviso ' + (t.vencido ? 'mal' : '') + '">' + (t.vencido ? '<strong>Vencido</strong>' : '<strong>Pendiente</strong>') + ' de ' + L.nombreMes(t.mes) + ': ' +
        fraseTransf(t) + ', <strong>' + $$(t.falta) + '</strong>. Límite: ' + fechaCorta(t.limite) + '. ' +
        '<button class="link" data-acc="marcarPagado" data-arg="' + t.mes + '|' + t.de + '|' + t.a + '">Registrar pago</button></div>';
    });

    html += '<div class="tarjeta"><h2>Cuenta de ' + esc(nombreMes.toLowerCase()) + '</h2>' +
      '<p class="sub">Abierta. Cierra el ' + L.ultimoDia(mes) + ' a las 11:59 p. m. ' + (dias === 0 ? '(¡hoy!)' : '(faltan ' + dias + (dias === 1 ? ' día)' : ' días)')) + '</p>' +
      '<hr class="corte"><h3>Saldos</h3>' + estado.usuarios.map(u => {
        const s = saldos[u.id] || 0;
        const txt = s > 0 ? 'le deben' : s < 0 ? 'debe' : 'al día';
        return '<div class="l"><span class="quien">' + avatar(u) + '<span' + (u.id === yo ? ' class="marca"' : '') + '>' + esc(u.apodo) + (u.id === yo ? ' (tú)' : '') + '</span></span><i class="pt"></i>' +
          '<span class="peq">' + txt + '</span><b class="monto ' + (s > 0 ? 'pos' : s < 0 ? 'neg' : '') + '">' + $$(Math.abs(s)) + '</b></div>';
      }).join('') +
      '<hr class="corte"><h3>Para quedar a mano</h3>' +
      (cruce.length ? cruce.map(filaTransferencia).join('') + '<p class="peq" style="margin:6px 0 0">' + cruce.length + (cruce.length === 1 ? ' pago: el mínimo posible.' : ' pagos: el mínimo posible.') + '</p>'
        : '<p style="margin:0">Nadie le debe a nadie.</p>') +
      '<hr class="corte doble"><div class="l total"><span>Gastado</span><i class="pt"></i><span>' + $$(total) + '</span></div>' +
      '<div class="botones" style="margin-top:14px"><button class="btn" data-acc="nav" data-arg="nuevo">+ Nuevo gasto</button><button class="btn sec" data-acc="abrirPago">Registrar pago</button></div></div>';

    html += '<div class="seccion-titulo"><h2>Últimos gastos</h2><button class="link" data-acc="ir" data-arg="gastos">Ver todos</button></div>';
    html += lineas.length ? '<div class="tarjeta" style="padding:6px 16px">' + lineas.slice(0, 5).map(filaGasto).join('') + '</div>'
      : '<div class="tarjeta vacio"><span class="ico">🧾</span>Aún no hay gastos este mes.<br>Toca el botón <b>+</b> para agregar el primero.</div>';
    return html;
  }

  /* ---------------- GASTOS ---------------- */
  function filaGasto(l) {
    const g = l.gasto, c = categoria(g.categoriaId), base = L.mesDe(g.fecha);
    const mesLinea = l.entradas[0].mes;
    const n = g.reparto.length;
    const sub = 'Pagó ' + esc(usuario(g.pagadoPor).apodo) + ' · ' + (mesLinea === base ? fechaCorta(g.fecha) : 'compra del ' + fechaCorta(g.fecha)) + ' · ' + (n === 3 ? 'los 3' : n === 1 ? 'solo ' + esc(usuario(g.reparto[0].uid).apodo) : esc(g.reparto.map(x => usuario(x.uid).apodo).join(' y ')));
    return '<div class="fila tocable" data-acc="verGasto" data-arg="' + esc(g.id) + '"><span class="cat-ico">' + c.icono + '</span><div class="cuerpo"><div class="titulo">' + esc(g.descripcion) +
      (g.factura ? ' 🧾' : '') + '</div><div class="peq">' + sub + (l.enCuotas ? ' <span class="insignia">en cuotas</span>' : '') + '</div></div><div class="monto">' + $$(l.total) + '</div></div>';
  }

  function mesesDisponibles() {
    const set = {}; L.mesesConActividad(estado).forEach(m => { set[m] = 1; }); set[L.mesDe(hoy())] = 1;
    return Object.keys(set).sort();
  }
  function vistaGastos() {
    const meses = mesesDisponibles(), actual = L.mesDe(hoy());
    if (!mesVista || meses.indexOf(mesVista) < 0) mesVista = actual;
    const i = meses.indexOf(mesVista);
    const abierto = mesVista === actual, futuro = mesVista > actual;
    const lineas = L.lineasDelMes(estado, mesVista);
    const pagos = estado.pagos.filter(p => p.mes === mesVista).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    let html = '<div class="mes-nav"><button data-acc="mesPrev" ' + (i <= 0 ? 'disabled' : '') + ' aria-label="Mes anterior">‹</button><div class="t"><b>' + L.nombreMes(mesVista) + '</b><span class="peq">' +
      (abierto ? 'Mes abierto' : futuro ? 'Cuotas por venir' : '🔒 Cerrado') + ' · ' + $$(L.totalDelMes(estado, mesVista)) + '</span></div><button data-acc="mesNext" ' + (i >= meses.length - 1 ? 'disabled' : '') + ' aria-label="Mes siguiente">›</button></div>';
    if (!abierto && !futuro) html += '<div class="aviso azul">🔒 Este mes está cerrado: queda como historial y no se puede editar.</div>';
    if (futuro) html += '<div class="aviso azul">Aquí aparecen las cuotas de gastos diferidos que caerán en este mes.</div>';
    html += lineas.length ? '<div class="tarjeta" style="padding:6px 16px">' + lineas.map(filaGasto).join('') + '</div>'
      : '<div class="tarjeta vacio"><span class="ico">🧾</span>No hay gastos en este mes.</div>';
    if (pagos.length) {
      html += '<div class="seccion-titulo"><h2>Pagos entre nosotros</h2></div><div class="tarjeta" style="padding:6px 16px">' + pagos.map(p =>
        '<div class="fila">' + avatar(usuario(p.de)) + '<div class="cuerpo"><div class="titulo">' + esc(usuario(p.de).apodo) + ' le pagó a ' + esc(usuario(p.a).apodo) + '</div><div class="peq">' + fechaCorta(p.fecha) + (p.postCierre ? ' · pago del cruce' : '') + '</div></div>' +
        '<div class="monto pos">' + $$(p.monto) + '</div><button class="link" data-acc="borrarPago" data-arg="' + esc(p.id) + '" aria-label="Borrar pago">🗑</button></div>').join('') + '</div>';
    }
    return html;
  }

  function verGasto(id) {
    const g = estado.gastos.find(x => x.id === id); if (!g) return;
    const c = categoria(g.categoriaId), calc = L.calcularPartes(g), ent = L.entradasDelGasto(g);
    const editable = L.puedeEditarGasto(g, hoy());
    let html = '<h2>' + c.icono + ' ' + esc(g.descripcion) + '</h2>' +
      '<div class="fila"><div class="cuerpo"><div class="peq">Monto total</div></div><div class="monto grande">' + $$(g.monto) + '</div></div>' +
      '<p class="peq">' + esc(c.nombre) + ' · ' + fechaLarga(g.fecha) + '<br>Pagó <b>' + esc(usuario(g.pagadoPor).apodo) + '</b> · registrado por ' + esc(usuario(g.creadoPor).apodo) + '</p>';
    html += '<h3 style="margin:12px 0 6px">Cómo se dividió (' + (g.metodo === 'iguales' ? 'partes iguales' : g.metodo === 'porcentaje' ? 'por porcentaje' : 'montos exactos') + ')</h3>';
    html += g.reparto.map(x => {
      const u = usuario(x.uid), n = Number(x.cuotas || 1), parte = calc.ok ? calc.partes[x.uid] : 0;
      const mias = ent.filter(e => e.uid === x.uid);
      return '<div class="fila">' + avatar(u) + '<div class="cuerpo"><div class="titulo">' + esc(u.apodo) + '</div>' + (n > 1 ? '<div class="peq">' + n + ' cuotas: ' + mias.map(e => mesCorto(e.mes) + ' ' + $$(e.monto)).join(' · ') + '</div>' : '') + '</div><div class="monto">' + $$(parte) + '</div></div>';
    }).join('');
    if (g.factura) {
      const f = g.factura, foto = f.fotoId ? fotoSync(f.fotoId) : null;
      html += '<h3 style="margin:14px 0 6px">🧾 Factura' + (f.tienda ? ' · ' + esc(f.tienda) : '') + '</h3>';
      if (foto) html += '<img class="foto-grande" src="' + foto + '" alt="Foto de la factura">';
      else if (f.fotoId) html += '<div class="peq" id="foto-ph">📷 Cargando foto…</div>';
      if (f.items && f.items.length) {
        html += '<table class="tabla-cuotas" style="margin-top:8px"><tr><th>Producto</th><th>Cant.</th><th>Precio</th></tr>' +
          f.items.map(it => '<tr><td>' + esc(it.nombre) + '</td><td>' + esc(it.cantidad) + '</td><td>' + $$(it.precio) + '</td></tr>').join('') + '</table>';
      }
    }
    html += '<div class="botones" style="margin-top:16px">' +
      (editable ? '<button class="btn sec" data-acc="editarGasto" data-arg="' + esc(g.id) + '">✏️ Editar</button><button class="btn peligro" data-acc="borrarGasto" data-arg="' + esc(g.id) + '">🗑 Borrar</button>' :
        '<div class="aviso azul" style="flex:1;margin:0">🔒 Es de un mes cerrado: no se puede editar.</div>') +
      '<button class="btn borde" data-acc="cerrarModal">Cerrar</button></div>';
    abrirModal(html);
    if (g.factura && g.factura.fotoId && !fotoSync(g.factura.fotoId)) {
      fotoCargar(g.factura.fotoId).then(d => {
        const ph = document.getElementById('foto-ph'); if (!ph) return;
        if (d) { const img = document.createElement('img'); img.className = 'foto-grande'; img.alt = 'Foto de la factura'; img.src = d; ph.replaceWith(img); }
        else ph.textContent = 'No se pudo cargar la foto.';
      });
    }
  }

  /* ---------------- NUEVO GASTO ---------------- */
  function nuevoForm() {
    return {
      editId: null, descripcion: '', monto: '', fecha: hoy(), pagadoPor: yo, categoriaId: null,
      modo: 'todos', participantes: estado.usuarios.map(u => u.id), metodo: 'iguales', valores: {}, cuotas: {}, cuotasAbierto: false,
      facturaAbierta: false, abrirSelector: false, fotoId: null, fotoData: null, tienda: '', items: []
    };
  }
  function formDesdeGasto(g) {
    const f = nuevoForm();
    f.editId = g.id; f.descripcion = g.descripcion; f.monto = fmtIn(g.monto); f.fecha = g.fecha; f.pagadoPor = g.pagadoPor;
    f.categoriaId = g.categoriaId; f.participantes = g.reparto.map(x => x.uid);
    f.modo = f.participantes.length === 3 ? 'todos' : f.participantes.length === 2 ? 'dos' : 'uno';
    f.metodo = g.metodo;
    g.reparto.forEach(x => {
      f.cuotas[x.uid] = Number(x.cuotas || 1);
      if (g.metodo === 'porcentaje') f.valores[x.uid] = String(x.valor).replace('.', ',');
      if (g.metodo === 'montos') f.valores[x.uid] = fmtIn(x.valor);
    });
    f.cuotasAbierto = g.reparto.some(x => Number(x.cuotas || 1) > 1);
    if (g.factura) {
      f.facturaAbierta = true; f.fotoId = g.factura.fotoId || null; f.tienda = g.factura.tienda || '';
      f.items = (g.factura.items || []).map(it => ({ nombre: it.nombre, cantidad: String(it.cantidad).replace('.', ','), precio: fmtIn(it.precio) }));
    }
    return f;
  }

  function itemsLimpios() {
    return form.items.map(it => ({ nombre: it.nombre.trim(), cantidad: L.parsearNumero(it.cantidad) || 1, precio: L.parsearDinero(it.precio) || 0 })).filter(it => it.nombre && it.precio > 0);
  }
  function borrador() {
    const reparto = form.participantes.map(uid => ({
      uid,
      valor: form.metodo === 'porcentaje' ? (L.parsearNumero(form.valores[uid]) || 0) : form.metodo === 'montos' ? (L.parsearDinero(form.valores[uid]) || 0) : null,
      cuotas: uid === form.pagadoPor ? 1 : (form.cuotas[uid] || 1)
    }));
    return {
      id: form.editId || 'nuevo', descripcion: form.descripcion.trim(), monto: L.parsearDinero(form.monto) || 0, pagadoPor: form.pagadoPor,
      fecha: form.fecha, categoriaId: form.categoriaId, metodo: form.metodo, reparto, creadoPor: yo, factura: null
    };
  }
  function prefillValores() {
    const n = form.participantes.length; form.valores = {};
    if (!n) return;
    if (form.metodo === 'porcentaje') {
      const p = L.repartirEntero(10000, n);
      form.participantes.forEach((u, i) => { form.valores[u] = String(p[i] / 100).replace('.', ','); });
    } else if (form.metodo === 'montos') {
      const m = L.parsearDinero(form.monto) || 0, parts = L.repartirEntero(m, n);
      form.participantes.forEach((u, i) => { form.valores[u] = m ? fmtIn(parts[i]) : ''; });
    }
  }

  function htmlResumen() {
    const b = borrador();
    if (!(b.monto > 0)) return '<div class="r"><span>Escribe el monto para ver cómo queda la división.</span></div>';
    const calc = L.calcularPartes(b);
    if (!calc.ok) return '<div class="r error"><span>⚠️ ' + esc(calc.error) + '</span></div>';
    const ent = L.entradasDelGasto(b);
    let h = '<div class="r"><b>' + esc(usuario(b.pagadoPor).apodo) + ' pagó</b><b>' + $$(b.monto) + '</b></div>';
    b.reparto.forEach(x => {
      const u = usuario(x.uid), parte = calc.partes[x.uid], mias = ent.filter(e => e.uid === x.uid);
      const etiqueta = x.uid === b.pagadoPor ? 'su parte' : 'le debe a ' + usuario(b.pagadoPor).apodo;
      h += '<div class="r"><span>' + esc(u.apodo) + ' · ' + etiqueta + '</span><b>' + $$(parte) + '</b></div>';
      if (mias.length > 1) h += '<div class="r peq"><span>↳ ' + mias.length + ' cuotas: ' + mias.map(e => mesCorto(e.mes) + ' ' + $$(e.monto)).join(' · ') + '</span></div>';
    });
    return h;
  }
  function refrescarResumen() {
    const el = document.getElementById('resumen-form'); if (el) el.innerHTML = htmlResumen();
    const t = document.getElementById('total-items'); if (t) t.innerHTML = htmlTotalItems();
  }
  function htmlTotalItems() {
    const tot = L.totalItems(itemsLimpios());
    return tot > 0 ? 'Suma de productos: <b>' + $$(tot) + '</b> <button class="link" data-acc="usarTotalItems">Usar como monto</button>' : '';
  }

  function vistaNuevo() {
    if (!form) form = nuevoForm();
    const f = form, h = hoy(), mes = L.mesDe(h), us = estado.usuarios;
    const foto = f.fotoData || (f.fotoId ? fotoSync(f.fotoId) : null);
    let html = '<h1 style="font-size:24px;margin:4px 0 12px">' + (f.editId ? 'Editar gasto' : 'Nuevo gasto') + '</h1>';

    /* Factura (opcional) */
    if (!f.facturaAbierta) {
      html += '<button class="btn sec bloque" style="margin-bottom:14px" data-acc="toggleFactura">📷 Agregar foto de la factura (opcional)</button>';
    } else {
      html += '<div class="tarjeta"><h2>🧾 Factura <span class="peq">(opcional)</span></h2>' +
        (foto ? '<img class="foto-mini" src="' + foto + '" alt="Foto de la factura">' : '') +
        '<input type="file" id="inp-foto" accept="image/*" class="oculto">' +
        '<div class="botones" style="margin-bottom:12px"><button class="btn sec" data-acc="elegirFoto">📷 ' + (foto ? 'Cambiar foto' : 'Tomar o elegir foto') + '</button>' +
        (foto ? '<button class="btn borde" data-acc="quitarFoto">Quitar foto</button>' : '') + '</div>' +
        '<button class="btn borde bloque chico" disabled style="margin-bottom:12px">🪄 Leer la factura automáticamente — próximamente</button>' +
        '<div class="campo"><label for="f-tienda">Tienda</label><input type="text" id="f-tienda" data-campo="tienda" value="' + esc(f.tienda) + '" placeholder="Ej.: D1, Éxito, Plaza"></div>' +
        '<div class="etiqueta">Productos <span class="peq">(así la app aprende qué compramos y a qué precio)</span></div>' +
        (f.items.length ? '<div class="item-cab"><span>Producto</span><span>Cant.</span><span>Precio unit.</span><span></span></div>' : '') +
        f.items.map((it, i) => '<div class="item-fila"><input type="text" data-item="' + i + '" data-f="nombre" value="' + esc(it.nombre) + '" placeholder="Ej.: Arroz 500g" aria-label="Producto">' +
          '<input type="text" inputmode="decimal" data-item="' + i + '" data-f="cantidad" value="' + esc(it.cantidad) + '" aria-label="Cantidad">' +
          '<input type="text" inputmode="decimal" data-item="' + i + '" data-f="precio" value="' + esc(it.precio) + '" placeholder="0" aria-label="Precio unitario">' +
          '<button class="x" data-acc="itemQuitar" data-arg="' + i + '" aria-label="Quitar producto">✕</button></div>').join('') +
        '<button class="btn sec chico" data-acc="itemMas">＋ Agregar producto</button>' +
        '<p class="peq" id="total-items" style="margin:10px 0 0">' + htmlTotalItems() + '</p></div>';
    }

    /* Paso 1 */
    html += '<div class="paso" style="margin-top:6px"><span class="n">1</span><h2>¿Qué se pagó?</h2></div><div class="tarjeta">' +
      '<div class="campo"><label for="f-desc">Descripción</label><input type="text" id="f-desc" data-campo="descripcion" value="' + esc(f.descripcion) + '" placeholder="Ej.: Arriendo, Mercado, Internet…" autocomplete="off"></div>' +
      '<div class="campo"><label for="f-monto">Monto</label><div class="monto-input"><input type="text" id="f-monto" inputmode="decimal" data-campo="monto" value="' + esc(f.monto) + '" placeholder="0"></div><div class="ayuda">Pesos colombianos. Puedes usar un decimal (ej.: 1.250,5).</div></div>' +
      '<div class="campo"><label for="f-fecha">Fecha</label><input type="date" id="f-fecha" data-campo="fecha" value="' + esc(f.fecha) + '" min="' + mes + '-01" max="' + mes + '-' + pad2(L.ultimoDia(mes)) + '"></div>' +
      '<div class="campo"><div class="etiqueta">¿Quién pagó?</div><div class="chips">' + us.map(u => '<button class="chip ' + (f.pagadoPor === u.id ? 'activo' : '') + '" data-acc="setPagador" data-arg="' + esc(u.id) + '">' + avatar(u) + esc(u.apodo) + '</button>').join('') + '</div></div>' +
      '<div class="campo" style="margin-bottom:0"><div class="etiqueta">Categoría <span class="peq">(opcional)</span></div><div class="chips">' +
      estado.categorias.map(c => '<button class="chip ' + (f.categoriaId === c.id ? 'activo' : '') + '" data-acc="setCategoria" data-arg="' + esc(c.id) + '">' + c.icono + ' ' + esc(c.nombre) + '</button>').join('') +
      '<button class="chip" data-acc="nuevaCategoria">＋ Nueva</button></div>' +
      '<div class="ayuda">Si no eliges, la app la clasifica sola (según la descripción o la factura) o la deja en <b>Otros</b>.</div></div></div>';

    /* Paso 2: entre quiénes */
    const nOpc = { todos: 3, dos: 2, uno: 1 };
    html += '<div class="paso"><span class="n">2</span><h2>¿Entre quiénes se divide?</h2></div><div class="tarjeta">' +
      '<div class="opciones">' +
      '<button class="opcion ' + (f.modo === 'todos' ? 'activo' : '') + '" data-acc="setModo" data-arg="todos">Los 3<small>Val, Santi y Pegui</small></button>' +
      '<button class="opcion ' + (f.modo === 'dos' ? 'activo' : '') + '" data-acc="setModo" data-arg="dos">Dos personas<small>Elijo cuáles</small></button>' +
      '<button class="opcion ' + (f.modo === 'uno' ? 'activo' : '') + '" data-acc="setModo" data-arg="uno">Una persona<small>Solo uno debe</small></button></div>';
    if (f.modo !== 'todos') {
      html += '<div class="chips" style="margin-top:12px">' + us.map(u => '<button class="chip ' + (f.participantes.indexOf(u.id) >= 0 ? 'activo' : '') + '" data-acc="togglePart" data-arg="' + esc(u.id) + '">' + avatar(u) + esc(u.apodo) + '</button>').join('') + '</div>' +
        '<div class="ayuda">Elige ' + (f.modo === 'dos' ? '2 personas' : '1 persona') + ' (' + f.participantes.length + '/' + nOpc[f.modo] + ').</div>';
    }
    html += '</div>';

    /* Paso 3: cómo */
    if (f.participantes.length > 1) {
      html += '<div class="paso"><span class="n">3</span><h2>¿Cómo se divide?</h2></div><div class="tarjeta">' +
        '<div class="opciones">' +
        '<button class="opcion ' + (f.metodo === 'iguales' ? 'activo' : '') + '" data-acc="setMetodo" data-arg="iguales">＝<small>Partes iguales</small></button>' +
        '<button class="opcion ' + (f.metodo === 'porcentaje' ? 'activo' : '') + '" data-acc="setMetodo" data-arg="porcentaje">％<small>Por porcentaje</small></button>' +
        '<button class="opcion ' + (f.metodo === 'montos' ? 'activo' : '') + '" data-acc="setMetodo" data-arg="montos">$<small>Montos exactos</small></button></div>';
      if (f.metodo !== 'iguales') {
        html += '<div style="margin-top:10px">' + f.participantes.map(uid => {
          const u = usuario(uid);
          return '<div class="fila-reparto">' + avatar(u) + '<span class="nombre">' + esc(u.apodo) + '</span>' +
            '<input type="text" inputmode="decimal" data-val="' + esc(uid) + '" value="' + esc(f.valores[uid] || '') + '" aria-label="' + (f.metodo === 'porcentaje' ? 'Porcentaje' : 'Monto') + ' de ' + esc(u.apodo) + '" placeholder="0">' +
            '<span class="sufijo">' + (f.metodo === 'porcentaje' ? '%' : '$') + '</span></div>';
        }).join('') + '<button class="link" data-acc="repartirIguales">Repartir en partes iguales</button></div>';
      }
      html += '</div>';
    }

    /* Paso 4: cuotas */
    const pasoCuotas = f.participantes.length > 1 ? 4 : 3;
    const otros = f.participantes.filter(u => u !== f.pagadoPor);
    html += '<div class="paso"><span class="n">' + pasoCuotas + '</span><h2>¿En cuántos meses paga cada uno?</h2></div><div class="tarjeta">';
    if (!f.cuotasAbierto) {
      html += '<p style="margin:0 0 10px">Por defecto cada uno paga su parte <b>este mes</b> (1 cuota).</p><button class="btn sec bloque" data-acc="toggleCuotas">📆 Pagar en cuotas (varios meses)</button>';
    } else if (!otros.length) {
      html += '<p style="margin:0 0 10px" class="peq">Quien pagó no necesita cuotas con su propia parte.</p><button class="link" data-acc="toggleCuotas">Cerrar</button>';
    } else {
      html += '<p class="peq" style="margin:0 0 8px">Cada persona puede pagar su parte en los meses que quiera. La cuota 1 cuenta este mes; las demás entran al cruce de los meses siguientes.</p>' +
        otros.map(uid => {
          const u = usuario(uid), n = f.cuotas[uid] || 1;
          return '<div class="fila-reparto">' + avatar(u) + '<span class="nombre">' + esc(u.apodo) + '<br><span class="peq">' + (n === 1 ? 'Paga todo este mes' : n + ' cuotas mensuales') + '</span></span>' +
            '<span class="paso-cuotas"><button data-acc="cuotaMenos" data-arg="' + esc(uid) + '" aria-label="Menos cuotas">−</button><span>' + n + '</span><button data-acc="cuotaMas" data-arg="' + esc(uid) + '" aria-label="Más cuotas">＋</button></span></div>';
        }).join('') +
        '<div class="botones" style="margin-top:8px"><button class="link" data-acc="cuotasIgual">Las mismas cuotas para todos</button><button class="link" data-acc="toggleCuotas">Cerrar</button></div>';
    }
    html += '</div>';

    /* Resumen y guardar */
    html += '<div class="seccion-titulo" style="margin-top:22px"><h2>Resumen</h2></div><div class="resumen-form" id="resumen-form">' + htmlResumen() + '</div>' +
      '<div class="aviso mal oculto" id="errores" style="margin-top:12px"></div>' +
      '<div class="botones" style="margin-top:16px"><button class="btn" data-acc="guardarGasto">✔ ' + (f.editId ? 'Guardar cambios' : 'Guardar gasto') + '</button><button class="btn borde" data-acc="cancelarForm">Cancelar</button></div>';
    return html;
  }

  function reducirImagen(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const max = NUBE ? 1100 : 1280, k = Math.min(1, max / Math.max(img.width, img.height));   // en la nube cada foto debe pesar menos de ~1 MB
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', NUBE ? 0.62 : 0.72));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No se pudo leer la imagen')); };
      img.src = url;
    });
  }

  async function guardarGasto() {
    if (form.guardando) return;
    const b = borrador(), h = hoy();
    const items = itemsLimpios();
    const hayFactura = form.fotoData || form.fotoId || items.length || form.tienda.trim();
    if (!b.categoriaId) b.categoriaId = L.inferirCategoria(b.descripcion + ' ' + form.tienda + ' ' + items.map(i => i.nombre).join(' '), estado.categorias);
    const errores = L.validarGasto(estado, b, h);
    if (form.editId) {
      const orig = estado.gastos.find(g => g.id === form.editId);
      if (!orig || !L.puedeEditarGasto(orig, h)) errores.push('Este gasto es de un mes cerrado y no se puede editar.');
    }
    const caja = document.getElementById('errores');
    if (errores.length) {
      caja.innerHTML = errores.map(e => '• ' + esc(e)).join('<br>'); caja.classList.remove('oculto');
      caja.scrollIntoView({ behavior: 'smooth', block: 'center' }); return;
    }
    form.guardando = true;
    const btn = document.querySelector('[data-acc="guardarGasto"]'); if (btn) btn.disabled = true;
    if (hayFactura) {
      let fotoId = form.fotoId;
      if (form.fotoData) {
        const nuevoId = L.nuevoId();
        let ok = false;
        try { ok = await fotoGuardar(nuevoId, form.fotoData); } catch (e) { ok = false; }
        if (ok) { if (fotoId) fotoBorrar(fotoId); fotoId = nuevoId; }
        else toast('⚠️ La foto no se pudo guardar; se guardó el gasto sin ella.');
      }
      b.factura = { fotoId: fotoId || null, tienda: form.tienda.trim(), items };
    } else if (form.editId) {
      const orig = estado.gastos.find(g => g.id === form.editId);
      if (orig && orig.factura && orig.factura.fotoId) fotoBorrar(orig.factura.fotoId);
    }
    if (form.editId) {
      const i = estado.gastos.findIndex(g => g.id === form.editId);
      b.id = form.editId;
      if (i >= 0) { b.creadoPor = estado.gastos[i].creadoPor; estado.gastos[i] = b; } else estado.gastos.push(b);
    } else { b.id = L.nuevoId(); estado.gastos.push(b); }
    persistir('guardarGasto', b);
    const nombreCat = categoria(b.categoriaId).nombre;
    form = null; mesVista = null;
    toast('✔ Gasto guardado en ' + nombreCat);
    ir('inicio');
  }

  /* ---------------- PAGOS ---------------- */
  function modalPago() {
    const p = pago, us = estado.usuarios;
    const posts = p.postCierre;
    let html = '<h2>💸 Registrar pago</h2>' +
      (posts ? '<div class="aviso azul">Pago del cruce de <b>' + L.nombreMes(p.mes) + '</b> (límite ' + fechaCorta(L.limitePago(p.mes)) + ').</div>' : '') +
      '<div class="campo"><div class="etiqueta">¿Quién pagó?</div><div class="chips">' + us.map(u => '<button class="chip ' + (p.de === u.id ? 'activo' : '') + '" data-acc="pagoDe" data-arg="' + esc(u.id) + '">' + avatar(u) + esc(u.apodo) + '</button>').join('') + '</div></div>' +
      '<div class="campo"><div class="etiqueta">¿A quién le pagó?</div><div class="chips">' + us.filter(u => u.id !== p.de).map(u => '<button class="chip ' + (p.a === u.id ? 'activo' : '') + '" data-acc="pagoA" data-arg="' + esc(u.id) + '">' + avatar(u) + esc(u.apodo) + '</button>').join('') + '</div></div>' +
      '<div class="campo"><label for="p-monto">Monto</label><div class="monto-input"><input type="text" id="p-monto" inputmode="decimal" data-pcampo="monto" value="' + esc(p.monto) + '" placeholder="0"></div></div>' +
      (posts ? '' : '<div class="campo"><label for="p-fecha">Fecha</label><input type="date" id="p-fecha" data-pcampo="fecha" value="' + esc(p.fecha) + '" min="' + L.mesDe(hoy()) + '-01" max="' + L.mesDe(hoy()) + '-' + pad2(L.ultimoDia(L.mesDe(hoy()))) + '"></div>') +
      '<div class="aviso mal oculto" id="err-pago"></div>' +
      '<div class="botones"><button class="btn" data-acc="guardarPago">✔ Guardar pago</button><button class="btn borde" data-acc="cerrarModal">Cancelar</button></div>';
    abrirModal(html);
  }
  function abrirPago(pre) {
    const ids = estado.usuarios.map(u => u.id), de = (pre && pre.de) || yo;
    pago = Object.assign({ de, a: (pre && pre.a) || ids.find(i => i !== de), monto: '', fecha: hoy(), mes: L.mesDe(hoy()), postCierre: false }, pre || {});
    if (pre && pre.monto) pago.monto = fmtIn(pre.monto);
    modalPago();
  }
  function guardarPago() {
    const m = L.parsearDinero(pago.monto), err = [];
    if (pago.de === pago.a) err.push('Quien paga y quien recibe deben ser distintos.');
    if (!(m > 0)) err.push('Escribe un monto mayor a cero.');
    if (!pago.postCierre && L.mesDe(pago.fecha) !== L.mesDe(hoy())) err.push('La fecha debe estar en el mes abierto.');
    if (err.length) { const c = document.getElementById('err-pago'); c.innerHTML = err.join('<br>'); c.classList.remove('oculto'); return; }
    const nuevoPago = { id: L.nuevoId(), mes: pago.mes, de: pago.de, a: pago.a, monto: m, fecha: pago.postCierre ? hoy() : pago.fecha, creadoPor: yo, postCierre: !!pago.postCierre };
    estado.pagos.push(nuevoPago);
    persistir('guardarPago', nuevoPago); cerrarModal(); toast('✔ Pago registrado'); render();
  }

  /* ---------------- CRUCE ---------------- */
  function chipEstado(t) {
    if (t.estado === 'pagado') return '<span class="insignia bien">Pagado</span>';
    if (t.vencido) return '<span class="insignia mal">Vencido, faltan ' + $$(t.falta) + '</span>';
    if (t.estado === 'parcial') return '<span class="insignia aviso">Faltan ' + $$(t.falta) + '</span>';
    return '<span class="insignia aviso">Pendiente</span>';
  }
  function vistaCruce() {
    const h = hoy(), mes = L.mesDe(h);
    const saldos = L.saldosDelMes(estado, mes), cruce = L.cruzar(saldos);
    let html = '<h1 style="margin:8px 0 0">Cruce de cuentas</h1>' +
      '<div class="aviso azul" style="margin-top:12px">El mes se cierra solo el último minuto del último día. Tienes hasta el <strong>11 del mes siguiente</strong> para pagar. El informe llega por correo el día 1 a primera hora <span class="peq">(se activa en la Fase 4)</span>.</div>' +
      '<div class="tarjeta"><h2>Así va ' + esc(L.nombreMes(mes)) + '</h2>' +
      (cruce.length ? cruce.map(filaTransferencia).join('') : '<p style="margin:0">Nadie le debe a nadie.</p>') + '</div>';
    const cerrados = Object.keys(estado.cierres).sort().reverse();
    html += '<div class="seccion-titulo"><h2>Historial de meses cerrados</h2></div>';
    if (!cerrados.length) html += '<div class="tarjeta vacio"><span class="ico">📚</span>Cuando termine el mes, su cruce quedará guardado aquí.</div>';
    cerrados.forEach(m => {
      const c = estado.cierres[m], trs = L.estadoTransferencias(estado, m, h);
      html += '<div class="tarjeta"><span class="sello">Cerrado</span><h2>Cuenta de ' + esc(L.nombreMes(m).split(' ')[0]) + '</h2>' +
        '<p class="sub" style="max-width:190px">Cerrada el ' + fechaCorta(c.cerradoEn.slice(0, 10)) + ', 11:59 p. m.<br>Plazo para pagar: hasta el ' + fechaCorta(c.limitePago) + '</p>' +
        '<hr class="corte"><div class="l"><span>Gastado</span><i class="pt"></i><b class="monto">' + $$(c.total) + '</b></div><hr class="corte"><h3>Pagos del cruce</h3>' +
        (trs.length ? trs.map(t => '<div class="l" style="margin-top:6px"><span>' + fraseTransf(t) + '</span><i class="pt"></i><b class="monto">' + $$(t.monto) + '</b></div>' +
          '<div style="margin:2px 0 8px">' + chipEstado(t) + '</div>' +
          (t.falta > 0 ? '<button class="btn chico sec" data-acc="marcarPagado" data-arg="' + m + '|' + t.de + '|' + t.a + '">Marcar pagado</button>' : '')).join('') :
          '<p style="margin:0">Quedaron a mano.</p>') +
        '<hr class="corte"><div class="botones"><button class="btn chico borde" data-acc="verMes" data-arg="' + m + '">Ver los gastos de ese mes</button></div></div>';
    });
    return html;
  }

  /* ---------------- PERFIL ---------------- */
  function vistaPerfil() {
    const u = usuario(yo), h = hoy();
    const nProd = L.productos(estado).length;
    return '<div class="tarjeta centro">' + avatar(u, 'grande') + '<h2 style="margin-top:8px">' + esc(u.nombre) + '</h2><p class="peq" style="margin:2px 0 0">“' + esc(u.apodo) + '”</p></div>' +
      '<button class="btn bloque" style="margin-bottom:14px" data-acc="subirFactura">📷 Subir foto de una factura</button>' +
      vistaInstalar() +
      '<div class="tarjeta"><h2>🛒 Productos y precios</h2><p class="peq" style="margin:0 0 10px">Con las facturas, la app va aprendiendo qué compramos y a qué precio: ' + nProd + (nProd === 1 ? ' producto guardado.' : ' productos guardados.') + '</p>' +
      '<button class="btn sec bloque" data-acc="ir" data-arg="productos">Ver productos y precios</button></div>' +
      '<div class="tarjeta"><h2>🏷 Categorías</h2><div class="chips">' + estado.categorias.map(c => '<span class="chip">' + c.icono + ' ' + esc(c.nombre) + '</span>').join('') + '</div>' +
      '<p class="peq" style="margin:8px 0 10px">Very Nice = tarifa del servicio de aseo.</p><button class="btn sec bloque" data-acc="nuevaCategoria">＋ Crear categoría nueva</button></div>' +
      (NUBE ? '' :
        '<div class="tarjeta"><h2>🧪 Modo de prueba</h2><p class="peq" style="margin:0 0 10px">Solo en modo demo. Aquí puedes cargar ejemplos y viajar en el tiempo para ver el cierre de mes.</p>' +
        '<div class="campo"><label for="f-sim">Fecha simulada</label><input type="date" id="f-sim" value="' + h + '">' + '<div class="ayuda">Hoy (real): ' + fechaLarga(hoyReal()) + '. Prueba con el último día del mes y luego con el día siguiente.</div></div>' +
        '<div class="botones" style="margin-bottom:14px"><button class="btn sec" data-acc="simFecha">Aplicar fecha</button><button class="btn borde" data-acc="simReal">Fecha real</button></div>' +
        '<div style="display:grid;gap:10px"><button class="btn borde bloque" data-acc="cargarAceptacion">Cargar ejemplo: arriendo + mercado</button>' +
        '<button class="btn borde bloque" data-acc="cargarCompleto">Cargar ejemplo completo (cuotas, facturas, mes cerrado)</button>' +
        '<button class="btn peligro bloque" data-acc="borrarTodo">Borrar todos los datos de prueba</button></div></div>') +
      '<button class="btn borde bloque" data-acc="salir">' + (NUBE ? 'Cerrar sesión' : 'Cambiar de usuario') + '</button>' +
      '<p class="peq centro" style="margin-top:14px">' + (NUBE ? 'El 27 · Conectado como ' + esc(correoSesion) : 'El 27 · Modo demo · datos guardados solo en este navegador') + '</p>';
  }

  /* ---- Instalar como app en el celular (PWA) ---- */
  let instalador = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); instalador = e; if (ruta() === 'perfil' && (!NUBE || fase === 'app')) render(); });
  window.addEventListener('appinstalled', () => { instalador = null; toast('Listo: El 27 quedó en tu pantalla de inicio'); if (ruta() === 'perfil') render(); });
  function vistaInstalar() {
    const instalada = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    if (instalada) return '';
    const esIphone = /iphone|ipad|ipod/i.test(navigator.userAgent);
    return '<div class="tarjeta"><h2>Instalar en el celular</h2>' +
      (instalador
        ? '<p class="peq" style="margin:0 0 10px">Crea un acceso directo en tu pantalla de inicio. Abre como una app, sin barra del navegador.</p><button class="btn sec bloque" data-acc="instalar">Instalar El 27</button>'
        : esIphone
          ? '<p style="margin:0">En Safari: toca el botón <strong>Compartir</strong> (el cuadro con la flecha hacia arriba), baja y elige <strong>Añadir a pantalla de inicio</strong>.</p>'
          : '<p style="margin:0">En Chrome: toca el menú <strong>⋮</strong> (arriba a la derecha) y elige <strong>Instalar app</strong> o <strong>Añadir a pantalla de inicio</strong>.</p>') +
      '</div>';
  }

  function vistaProductos() {
    const todos = L.productos(estado), q = L.normalizarNombre(filtroProd);
    const lista = todos.filter(p => !q || p.clave.indexOf(q) >= 0);
    let html = '<div style="display:flex;align-items:center;gap:8px;margin:4px 0 12px"><button class="link" data-acc="ir" data-arg="perfil">‹ Perfil</button></div>' +
      '<h1 style="font-size:24px;margin:0 0 12px">Productos y precios</h1>' +
      '<div class="campo"><input type="search" id="f-prod" value="' + esc(filtroProd) + '" placeholder="Buscar producto…" aria-label="Buscar producto"></div>';
    if (!todos.length) return html + '<div class="tarjeta vacio"><span class="ico">🛒</span>Aún no hay productos.<br>Sube la foto de una factura y agrega los productos para empezar.</div>';
    html += '<div class="tarjeta" style="padding:6px 16px" id="lista-prod">' + htmlListaProductos(lista) + '</div>';
    return html;
  }
  function htmlListaProductos(lista) {
    if (!lista.length) return '<div class="vacio">Nada con ese nombre.</div>';
    return lista.map(p => '<div class="fila tocable" data-acc="verProducto" data-arg="' + esc(p.clave) + '"><div class="cuerpo"><div class="titulo">' + esc(p.nombre) + '</div>' +
      '<div class="peq">Comprado ' + p.veces + (p.veces === 1 ? ' vez' : ' veces') + ' · promedio ' + $$(p.promedio) + '</div></div><div class="monto">' + $$(p.ultimoPrecio) + '</div></div>').join('');
  }
  function verProducto(clave) {
    const p = L.productos(estado).find(x => x.clave === clave); if (!p) return;
    abrirModal('<h2>🛒 ' + esc(p.nombre) + '</h2><div class="resumen-form" style="margin-bottom:12px"><div class="r"><span>Último precio</span><b>' + $$(p.ultimoPrecio) + '</b></div><div class="r"><span>Precio promedio</span><b>' + $$(p.promedio) + '</b></div>' +
      '<div class="r"><span>Más barato</span><b>' + $$(p.min) + '</b></div><div class="r"><span>Más caro</span><b>' + $$(p.max) + '</b></div></div>' +
      '<h3 style="margin-bottom:6px">Historial</h3>' + p.historial.map(x => '<div class="fila"><div class="cuerpo"><div class="titulo">' + fechaCorta(x.fecha) + (x.tienda ? ' · ' + esc(x.tienda) : '') + '</div><div class="peq">Cantidad: ' + esc(x.cantidad) + ' · compró ' + esc(usuario(x.pagadoPor).apodo) + '</div></div><div class="monto">' + $$(x.precio) + '</div></div>').join('') +
      '<div class="botones" style="margin-top:14px"><button class="btn borde" data-acc="cerrarModal">Cerrar</button></div>');
  }

  /* ---------------- nueva categoría ---------------- */
  let catIcono = '🧾';
  function modalCategoria() {
    const sug = ['🧾', '🍕', '🚌', '🐶', '🎉', '🔧', '👕', '💊', '🎬', '☕', '🎁', '🧴'];
    abrirModal('<h2>Nueva categoría</h2><div class="campo"><label for="c-nombre">Nombre</label><input type="text" id="c-nombre" placeholder="Ej.: Mascotas" autocomplete="off"></div>' +
      '<div class="campo"><div class="etiqueta">Ícono</div><div class="chips">' + sug.map(s => '<button class="chip ' + (s === catIcono ? 'activo' : '') + '" data-acc="catIcono" data-arg="' + s + '">' + s + '</button>').join('') + '</div></div>' +
      '<div class="aviso mal oculto" id="err-cat"></div><div class="botones"><button class="btn" data-acc="guardarCategoria">Crear</button><button class="btn borde" data-acc="cerrarModal">Cancelar</button></div>');
  }

  /* ---------------- ACCIONES (botones) ---------------- */
  const ACC = {
    entrar(id) { yo = id; A.ponerPref('yo', id); render(); },
    entrarNoAutorizado() { sinAcceso = true; render(); },
    volverLogin() { sinAcceso = false; render(); },
    salir() {
      form = null;
      if (NUBE) { window.Nube.salir(); yo = null; estado = null; fase = 'login'; render(); return; }
      yo = null; A.ponerPref('yo', null); render();
    },
    recargar() { location.reload(); },
    instalar() {
      if (!instalador) return;
      instalador.prompt();
      instalador.userChoice.then(() => { instalador = null; render(); });
    },
    entrarGoogle() {
      if (!NUBE) return;
      window.Nube.entrarConGoogle().catch(e => {
        if (e && (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request')) return;
        if (e && e.code === 'auth/popup-blocked') { toast('Tu navegador bloqueó la ventana de Google. Permite las ventanas emergentes e inténtalo de nuevo.'); return; }
        console.error(e); toast('No se pudo entrar: ' + ((e && (e.code || e.message)) || 'error desconocido'));
      });
    },
    guardarSetup() {
      if (guardandoSetup) return;
      const caja = document.getElementById('err-setup'), vistos = {}, usuarios = [];
      let err = '';
      D.USUARIOS.forEach(u => {
        const v = String(document.getElementById('s-' + u.id).value || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) err = err || 'Revisa el correo de ' + u.apodo + '.';
        else if (vistos[v]) err = err || 'Hay un correo repetido.';
        vistos[v] = 1; usuarios.push(Object.assign({}, u, { email: v }));
      });
      if (!err && !vistos[correoSesion]) err = 'Tu propio correo (' + correoSesion + ') debe estar en la lista.';
      if (err) { caja.textContent = err; caja.classList.remove('oculto'); return; }
      guardandoSetup = true; document.getElementById('btn-setup').disabled = true;
      window.Nube.configurarCasa(usuarios, L.CATEGORIAS_BASE).catch(e => {
        guardandoSetup = false; console.error(e);
        caja.textContent = 'No se pudo guardar la configuración (' + ((e && e.code) || 'error') + ').'; caja.classList.remove('oculto');
        const b = document.getElementById('btn-setup'); if (b) b.disabled = false;
      });
    },
    ir(r) { ir(r); },
    nav(r) { if (r === 'nuevo') { if (ruta() !== 'nuevo' || !form) form = nuevoForm(); } ir(r); },
    cerrarModal() { cerrarModal(); },
    mesPrev() { const m = mesesDisponibles(), i = m.indexOf(mesVista); if (i > 0) { mesVista = m[i - 1]; render(); } },
    mesNext() { const m = mesesDisponibles(), i = m.indexOf(mesVista); if (i < m.length - 1) { mesVista = m[i + 1]; render(); } },
    verMes(m) { mesVista = m; ir('gastos'); },
    verGasto(id) { verGasto(id); },
    editarGasto(id) {
      const g = estado.gastos.find(x => x.id === id);
      if (!g || !L.puedeEditarGasto(g, hoy())) { toast('Ese gasto es de un mes cerrado.'); return; }
      form = formDesdeGasto(g); cerrarModal(); ir('nuevo');
      if (g.factura && g.factura.fotoId && !fotoSync(g.factura.fotoId)) fotoCargar(g.factura.fotoId).then(() => { if (form && ruta() === 'nuevo') render(); });
    },
    borrarGasto(id) {
      const g = estado.gastos.find(x => x.id === id);
      if (!g || !L.puedeEditarGasto(g, hoy())) { toast('Ese gasto es de un mes cerrado.'); return; }
      if (!window.confirm('¿Borrar "' + g.descripcion + '" por ' + $$(g.monto) + '? No se puede deshacer.')) return;
      if (g.factura && g.factura.fotoId) fotoBorrar(g.factura.fotoId);
      estado.gastos = estado.gastos.filter(x => x.id !== id); persistir('borrarGasto', id); cerrarModal(); toast('Gasto borrado'); render();
    },
    subirFactura() { form = nuevoForm(); form.facturaAbierta = true; form.abrirSelector = true; ir('nuevo'); },
    cancelarForm() { form = null; ir('inicio'); },

    setPagador(id) { form.pagadoPor = id; render(); },
    setCategoria(id) { form.categoriaId = form.categoriaId === id ? null : id; render(); },
    nuevaCategoria() { catIcono = '🧾'; modalCategoria(); },
    catIcono(ic) { const n = (document.getElementById('c-nombre') || {}).value || ''; catIcono = ic; modalCategoria(); document.getElementById('c-nombre').value = n; },
    guardarCategoria() {
      const nombre = document.getElementById('c-nombre').value.trim(), caja = document.getElementById('err-cat');
      const clave = L.normalizarNombre(nombre);
      let err = '';
      if (!nombre) err = 'Escribe un nombre.';
      else if (estado.categorias.some(c => L.normalizarNombre(c.nombre) === clave)) err = 'Ya existe una categoría con ese nombre.';
      if (err) { caja.textContent = err; caja.classList.remove('oculto'); return; }
      const c = { id: 'c_' + clave.replace(/\s/g, '_') + '_' + Date.now().toString(36).slice(-3), nombre, icono: catIcono };
      c.orden = Date.now(); estado.categorias.push(c); persistir('guardarCategoria', c); cerrarModal();
      if (form && ruta() === 'nuevo') form.categoriaId = c.id;
      toast('Categoría creada'); render();
    },

    setModo(m) {
      const ids = estado.usuarios.map(u => u.id), otro = ids.filter(i => i !== form.pagadoPor);
      form.modo = m;
      if (m === 'todos') form.participantes = ids.slice();
      else if (m === 'dos') { const base = form.participantes.slice(0, 2); form.participantes = base.length === 2 ? base : [form.pagadoPor, otro[0]]; }
      else form.participantes = [form.participantes.filter(u => u !== form.pagadoPor)[0] || otro[0]];
      if (form.participantes.length < 2) form.metodo = 'iguales'; else prefillValores();
      render();
    },
    togglePart(id) {
      const p = form.participantes, i = p.indexOf(id);
      if (form.modo === 'uno') form.participantes = [id];
      else if (i >= 0) p.splice(i, 1);
      else { p.push(id); if (p.length > 2) p.shift(); }
      if (form.participantes.length < 2) form.metodo = 'iguales'; else if (form.metodo !== 'iguales') prefillValores();
      render();
    },
    setMetodo(m) { form.metodo = m; prefillValores(); render(); },
    repartirIguales() { prefillValores(); render(); },
    toggleCuotas() { form.cuotasAbierto = !form.cuotasAbierto; render(); },
    cuotaMas(id) { form.cuotas[id] = Math.min(36, (form.cuotas[id] || 1) + 1); render(); },
    cuotaMenos(id) { form.cuotas[id] = Math.max(1, (form.cuotas[id] || 1) - 1); render(); },
    cuotasIgual() {
      const otros = form.participantes.filter(u => u !== form.pagadoPor), n = form.cuotas[otros[0]] || 1;
      otros.forEach(u => { form.cuotas[u] = n; }); render();
    },
    toggleFactura() { form.facturaAbierta = true; render(); },
    elegirFoto() { const i = document.getElementById('inp-foto'); if (i) i.click(); },
    quitarFoto() { form.fotoData = null; form.fotoId = null; render(); },
    itemMas() { form.items.push({ nombre: '', cantidad: '1', precio: '' }); render(); const n = document.querySelectorAll('[data-f="nombre"]'); if (n.length) n[n.length - 1].focus(); },
    itemQuitar(i) { form.items.splice(Number(i), 1); render(); },
    usarTotalItems() { form.monto = fmtIn(L.totalItems(itemsLimpios())); if (form.metodo !== 'iguales') prefillValores(); render(); },
    guardarGasto() { guardarGasto().catch(e => { console.error(e); if (form) form.guardando = false; toast('⚠️ No se pudo guardar el gasto.'); }); },

    abrirPago() { abrirPago(); },
    pagoDe(id) { pago.de = id; if (pago.a === id) pago.a = estado.usuarios.find(u => u.id !== id).id; modalPago(); },
    pagoA(id) { pago.a = id; modalPago(); },
    guardarPago() { guardarPago(); },
    marcarPagado(arg) {
      const p = arg.split('|'), t = L.estadoTransferencias(estado, p[0], hoy()).find(x => x.de === p[1] && x.a === p[2]);
      abrirPago({ de: p[1], a: p[2], mes: p[0], postCierre: true, monto: t ? t.falta : 0 });
    },
    borrarPago(id) {
      if (!window.confirm('¿Borrar este pago?')) return;
      estado.pagos = estado.pagos.filter(p => p.id !== id); persistir('borrarPago', id); toast('Pago borrado'); render();
    },
    verProducto(c) { verProducto(c); },

    simFecha() {
      const v = document.getElementById('f-sim').value;
      if (!v) { toast('Elige una fecha.'); return; }
      const ultimo = Object.keys(estado.cierres).sort().pop();
      if (ultimo && L.mesDe(v) <= ultimo) { toast('No se puede volver a un mes ya cerrado. Borra los datos de prueba para empezar de cero.'); return; }
      A.ponerPref('fechaSim', v); mesVista = null; render(); toast('Fecha simulada: ' + fechaLarga(v));
    },
    simReal() {
      const ultimo = Object.keys(estado.cierres).sort().pop();
      if (ultimo && L.mesDe(hoyReal()) <= ultimo) { toast('Ya se cerraron meses "del futuro". Borra los datos de prueba para volver a la fecha real.'); return; }
      A.ponerPref('fechaSim', null); mesVista = null; render(); toast('Volviste a la fecha real'); },
    cargarAceptacion() {
      if (!window.confirm('Esto reemplaza los datos actuales por el ejemplo: arriendo $1.500.000 (Val) y mercado $300.000 (Santi). ¿Seguir?')) return;
      A.borrarTodo(); estado = D.aceptacion(hoy()); guardar(); mesVista = null; toast('Ejemplo cargado'); ir('inicio');
    },
    cargarCompleto() {
      if (!window.confirm('Esto reemplaza los datos actuales por un ejemplo completo con mes anterior cerrado, cuotas y facturas. ¿Seguir?')) return;
      A.borrarTodo(); estado = D.completo(hoy()); guardar(); cerrarVencidos(); mesVista = null; toast('Ejemplo cargado'); ir('inicio');
    },
    borrarTodo() {
      if (!window.confirm('¿Borrar TODOS los datos de prueba (gastos, pagos, fotos y cierres)?')) return;
      A.borrarTodo(); estado = D.vacio(); guardar(); form = null; mesVista = null; toast('Datos borrados'); ir('inicio');
    }
  };

  document.addEventListener('click', e => {
    if (e.target.classList && e.target.classList.contains('fondo-modal')) { cerrarModal(); return; }
    const el = e.target.closest('[data-acc]'); if (!el) return;
    const f = ACC[el.dataset.acc];
    if (f) { e.preventDefault(); f(el.dataset.arg, el); }
  });

  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'f-prod') { filtroProd = t.value; const q = L.normalizarNombre(filtroProd); document.getElementById('lista-prod').innerHTML = htmlListaProductos(L.productos(estado).filter(p => !q || p.clave.indexOf(q) >= 0)); return; }
    if (t.dataset.pcampo && pago) { pago[t.dataset.pcampo] = t.value; return; }
    if (!form) return;
    if (t.dataset.campo) { form[t.dataset.campo] = t.value; refrescarResumen(); }
    else if (t.dataset.val) { form.valores[t.dataset.val] = t.value; refrescarResumen(); }
    else if (t.dataset.item !== undefined) { form.items[Number(t.dataset.item)][t.dataset.f] = t.value; refrescarResumen(); }
  });

  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.pcampo === 'monto' && pago) { const m = L.parsearDinero(t.value); if (m !== null) { pago.monto = fmtIn(m); t.value = pago.monto; } return; }
    if (!form) return;
    if (t.dataset.campo === 'monto') {
      const m = L.parsearDinero(t.value);
      if (m !== null) { form.monto = fmtIn(m); t.value = form.monto; if (form.metodo === 'montos') { prefillValores(); render(); return; } }
      refrescarResumen();
    } else if (t.dataset.val && form.metodo === 'montos') {
      const m = L.parsearDinero(t.value); if (m !== null) { form.valores[t.dataset.val] = fmtIn(m); t.value = form.valores[t.dataset.val]; refrescarResumen(); }
    } else if (t.dataset.f === 'precio') {
      const m = L.parsearDinero(t.value); if (m !== null) { form.items[Number(t.dataset.item)].precio = fmtIn(m); t.value = fmtIn(m); refrescarResumen(); }
    } else if (t.id === 'inp-foto' && t.files && t.files[0]) {
      reducirImagen(t.files[0]).then(d => { form.fotoData = d; render(); toast('📷 Foto agregada'); }).catch(() => toast('No se pudo leer esa imagen.'));
    }
  });

  iniciar();
})();
