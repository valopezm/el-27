/* ============================================================
   El 27 · LÓGICA (el "cerebro")
   Aquí van SOLO los cálculos: dividir gastos, saldos, cuotas,
   cruce de cuentas, cierre de mes y catálogo de productos.
   No toca la pantalla, así se puede probar sola (pruebas.html).

   DINERO: todo se guarda en "décimas de peso" (números enteros).
   Ej.: $1.500.000  ->  15000000   |   $333.333,3  ->  3333333
   Así nunca hay errores de redondeo y el máximo es 1 decimal.
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Logica = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Categorías básicas ---------- */
  const CATEGORIAS_BASE = [
    { id: 'arriendo', nombre: 'Arriendo', icono: '🏠' },
    { id: 'servicios', nombre: 'Servicios', icono: '💡' },
    { id: 'mercado', nombre: 'Mercado', icono: '🛒' },
    { id: 'aseo', nombre: 'Aseo', icono: '🧼' },
    { id: 'internet', nombre: 'Internet', icono: '📶' },
    { id: 'verynice', nombre: 'Very Nice', icono: '✨', nota: 'Tarifa del servicio de aseo' },
    { id: 'otros', nombre: 'Otros', icono: '📦' }
  ];

  /* ---------- Dinero ---------- */
  function aDecimas(pesos) { return Math.round(Number(pesos) * 10); }

  // 15000000 -> "$1.500.000" ; 3333333 -> "$333.333,3"
  function formatear(t, opc) {
    opc = opc || {};
    const neg = t < 0;
    const abs = Math.abs(Math.round(t));
    const ent = Math.floor(abs / 10);
    const dec = abs % 10;
    let s = String(ent).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (dec) s += ',' + dec;
    return (neg ? '-' : '') + (opc.simbolo === false ? '' : '$') + s;
  }

  // Lee lo que escribe la persona: "1.500.000", "1500000", "333,3", "$ 2.000"
  // Devuelve décimas (entero) o null si no se entiende.
  function parsearDinero(texto) {
    if (typeof texto === 'number') return Number.isFinite(texto) ? Math.round(texto * 10) : null;
    let s = String(texto == null ? '' : texto).replace(/[$\s]/g, '');
    if (!s) return null;
    let n;
    if (s.indexOf(',') >= 0) {
      if (!/^\d{1,3}(\.\d{3})*,\d+$|^\d+,\d+$/.test(s)) return null;
      n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      n = parseFloat(s.replace(/\./g, ''));
    } else if (/^\d+(\.\d+)?$/.test(s)) {
      n = parseFloat(s);
    } else return null;
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 10);
  }

  // Números normales (porcentajes, cantidades): acepta coma o punto decimal
  function parsearNumero(texto) {
    const s = String(texto == null ? '' : texto).replace(/\s/g, '').replace(',', '.');
    if (!s || !/^\d*\.?\d+$/.test(s)) return null;
    return parseFloat(s);
  }

  /* ---------- Fechas (siempre texto 'AAAA-MM-DD' y mes 'AAAA-MM') ---------- */
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function mesDe(fecha) { return String(fecha).slice(0, 7); }
  function sumarMeses(mes, n) {
    const p = mes.split('-').map(Number);
    const t = p[0] * 12 + (p[1] - 1) + n;
    return Math.floor(t / 12) + '-' + String((t % 12) + 1).padStart(2, '0');
  }
  function ultimoDia(mes) {
    const p = mes.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1], 0)).getUTCDate();
  }
  function nombreMes(mes, corto) {
    const p = mes.split('-').map(Number);
    const m = MESES[p[1] - 1];
    return (corto ? m.slice(0, 3) : m) + ' ' + p[0];
  }
  // La ventana de pago llega hasta el día 11 del mes siguiente
  function limitePago(mes) { return sumarMeses(mes, 1) + '-11'; }

  /* ---------- Repartos ---------- */
  // Divide un entero en n partes que suman EXACTO (el sobrante se reparte de a 0,1)
  function repartirEntero(total, n) {
    const base = Math.floor(total / n);
    const resto = total - base * n;
    const out = [];
    for (let i = 0; i < n; i++) out.push(base + (i < resto ? 1 : 0));
    return out;
  }

  /* Un gasto es:
     { id, descripcion, monto, pagadoPor, fecha, categoriaId, creadoPor,
       metodo: 'iguales' | 'porcentaje' | 'montos',
       reparto: [ { uid, valor, cuotas } ],     // valor: % o décimas según el método
       factura: { fotoId, tienda, items:[{nombre,cantidad,precio}] } | null }          */
  function calcularPartes(g) {
    const r = g.reparto || [];
    const n = r.length;
    if (!n) return { ok: false, error: 'Elige entre quiénes se divide el gasto.' };
    const T = g.monto;
    if (!(T > 0)) return { ok: false, error: 'Escribe un monto mayor a cero.' };
    let montos;
    if (g.metodo === 'porcentaje') {
      const suma = r.reduce((a, x) => a + (Number(x.valor) || 0), 0);
      if (Math.abs(suma - 100) > 0.001) {
        return { ok: false, error: 'Los porcentajes suman ' + (Math.round(suma * 100) / 100) + '%. Deben sumar 100%.', diferencia: 100 - suma };
      }
      const crudo = r.map(x => (T * (Number(x.valor) || 0)) / 100);
      montos = crudo.map(c => Math.floor(c + 1e-9));
      let resto = T - montos.reduce((a, b) => a + b, 0);
      const orden = crudo.map((c, i) => ({ i, f: c - Math.floor(c + 1e-9) })).sort((a, b) => b.f - a.f);
      for (let k = 0; resto > 0 && k < orden.length * 2; k++, resto--) montos[orden[k % orden.length].i] += 1;
    } else if (g.metodo === 'montos') {
      montos = r.map(x => Math.round(Number(x.valor) || 0));
      const suma = montos.reduce((a, b) => a + b, 0);
      if (suma !== T) {
        return { ok: false, error: suma < T ? 'Faltan ' + formatear(T - suma) + ' por repartir.' : 'Te pasaste por ' + formatear(suma - T) + '.', diferencia: T - suma };
      }
    } else {
      montos = repartirEntero(T, n);
    }
    const partes = {};
    r.forEach((x, i) => { partes[x.uid] = montos[i]; });
    return { ok: true, partes };
  }

  function numCuotas(x) { return Math.max(1, Math.floor(Number(x && x.cuotas) || 1)); }

  // Cada persona paga su parte en N cuotas (una por mes, empezando en el mes del gasto)
  function entradasDelGasto(g) {
    const calc = calcularPartes(g);
    if (!calc.ok) return [];
    const base = mesDe(g.fecha);
    const out = [];
    g.reparto.forEach(x => {
      const n = numCuotas(x);
      repartirEntero(calc.partes[x.uid], n).forEach((monto, k) => {
        out.push({ mes: sumarMeses(base, k), uid: x.uid, monto, k: k + 1, n });
      });
    });
    return out;
  }

  // { 'AAAA-MM': { uid: saldo } }  (+ le deben, - debe)
  function saldosDelGasto(g) {
    const res = {};
    entradasDelGasto(g).forEach(e => {
      if (!res[e.mes]) res[e.mes] = {};
      res[e.mes][e.uid] = (res[e.mes][e.uid] || 0) - e.monto;
      res[e.mes][g.pagadoPor] = (res[e.mes][g.pagadoPor] || 0) + e.monto;
    });
    return res;
  }

  /* ---------- Estado vacío ---------- */
  function estadoVacio(usuarios) {
    return { version: 1, usuarios: usuarios.slice(), categorias: CATEGORIAS_BASE.map(c => Object.assign({}, c)), gastos: [], pagos: [], cierres: {} };
  }

  function nuevoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ---------- Saldos y líneas por mes ---------- */
  function saldosDelMes(estado, mes) {
    const s = {};
    estado.usuarios.forEach(u => { s[u.id] = 0; });
    estado.gastos.forEach(g => {
      const m = saldosDelGasto(g)[mes];
      if (m) Object.keys(m).forEach(u => { s[u] = (s[u] || 0) + m[u]; });
    });
    // Un pago "B le pagó a A" sube el saldo de B y baja el de A.
    // (Los pagos hechos DESPUÉS del cierre no cambian el mes; solo marcan transferencias como pagadas)
    estado.pagos.forEach(p => {
      if (p.mes === mes && !p.postCierre) {
        s[p.de] = (s[p.de] || 0) + p.monto;
        s[p.a] = (s[p.a] || 0) - p.monto;
      }
    });
    return s;
  }

  // Gastos que tienen movimiento en el mes (con el total de ese mes)
  function lineasDelMes(estado, mes) {
    const out = [];
    estado.gastos.forEach(g => {
      const ent = entradasDelGasto(g).filter(e => e.mes === mes);
      if (!ent.length) return;
      out.push({ gasto: g, entradas: ent, total: ent.reduce((a, e) => a + e.monto, 0), enCuotas: ent.some(e => e.n > 1) });
    });
    out.sort((a, b) => (a.gasto.fecha < b.gasto.fecha ? 1 : a.gasto.fecha > b.gasto.fecha ? -1 : a.gasto.id < b.gasto.id ? 1 : -1));
    return out;
  }

  function totalDelMes(estado, mes) {
    return lineasDelMes(estado, mes).reduce((a, l) => a + l.total, 0);
  }

  /* ---------- Cruce de cuentas (menos pagos posibles) ---------- */
  function cruzar(saldos) {
    const deudores = [], acreedores = [];
    Object.keys(saldos).forEach(u => {
      if (saldos[u] < 0) deudores.push({ u, s: -saldos[u] });
      else if (saldos[u] > 0) acreedores.push({ u, s: saldos[u] });
    });
    const out = [];
    // 1) Primero emparejamos montos idénticos (1 pago resuelve 2 personas)
    deudores.forEach(d => {
      const a = acreedores.find(x => x.s === d.s && d.s > 0);
      if (a) { out.push({ de: d.u, a: a.u, monto: d.s }); d.s = 0; a.s = 0; }
    });
    // 2) Luego, el que más debe le paga al que más le deben
    let ds = deudores.filter(d => d.s > 0), as = acreedores.filter(a => a.s > 0);
    while (ds.length && as.length) {
      ds.sort((x, y) => y.s - x.s);
      as.sort((x, y) => y.s - x.s);
      const d = ds[0], a = as[0];
      const m = Math.min(d.s, a.s);
      out.push({ de: d.u, a: a.u, monto: m });
      d.s -= m; a.s -= m;
      ds = ds.filter(x => x.s > 0); as = as.filter(x => x.s > 0);
    }
    return out;
  }

  /* ---------- Cierre de mes (automático, último minuto del último día) ---------- */
  function mesesConActividad(estado) {
    const set = {};
    estado.gastos.forEach(g => entradasDelGasto(g).forEach(e => { set[e.mes] = true; }));
    estado.pagos.forEach(p => { if (!p.postCierre) set[p.mes] = true; });
    Object.keys(estado.cierres).forEach(m => { set[m] = true; });
    return Object.keys(set).sort();
  }

  // Cierra todos los meses anteriores al de "hoy" que aún no estén cerrados. Devuelve los que cerró.
  function cerrarMesesVencidos(estado, hoy) {
    const actual = mesDe(hoy);
    const nuevos = [];
    mesesConActividad(estado).filter(m => m < actual && !estado.cierres[m]).forEach(m => {
      const saldos = saldosDelMes(estado, m);
      estado.cierres[m] = {
        mes: m,
        cerradoEn: m + '-' + String(ultimoDia(m)).padStart(2, '0') + ' 23:59',
        saldos,
        transferencias: cruzar(saldos),
        total: totalDelMes(estado, m),
        limitePago: limitePago(m)
      };
      nuevos.push(m);
    });
    return nuevos;
  }

  function mesAbierto(mes, hoy) { return mes === mesDe(hoy); }
  function puedeEditarGasto(g, hoy) { return mesDe(g.fecha) === mesDe(hoy); }

  // Estado de cada transferencia sugerida de un mes cerrado
  function estadoTransferencias(estado, mes, hoy) {
    const c = estado.cierres[mes];
    if (!c) return [];
    return c.transferencias.map(t => {
      const pagado = estado.pagos
        .filter(p => p.mes === mes && p.postCierre && p.de === t.de && p.a === t.a)
        .reduce((a, p) => a + p.monto, 0);
      const falta = Math.max(0, t.monto - pagado);
      return {
        de: t.de, a: t.a, monto: t.monto, pagado, falta,
        estado: falta === 0 ? 'pagado' : pagado > 0 ? 'parcial' : 'pendiente',
        vencido: falta > 0 && hoy > c.limitePago
      };
    });
  }

  // Transferencias pendientes de meses ya cerrados
  function pendientesCerrados(estado, hoy) {
    const out = [];
    Object.keys(estado.cierres).sort().forEach(m => {
      estadoTransferencias(estado, m, hoy).forEach(t => { if (t.falta > 0) out.push(Object.assign({ mes: m, limite: estado.cierres[m].limitePago }, t)); });
    });
    return out;
  }

  /* ---------- Validación ---------- */
  function validarGasto(estado, g, hoy) {
    const errores = [];
    if (!g.descripcion || !g.descripcion.trim()) errores.push('Escribe una descripción.');
    if (!(g.monto > 0)) errores.push('Escribe un monto mayor a cero.');
    if (!estado.usuarios.some(u => u.id === g.pagadoPor)) errores.push('Elige quién pagó.');
    if (!g.fecha || mesDe(g.fecha) !== mesDe(hoy)) errores.push('La fecha debe estar dentro del mes abierto (' + nombreMes(mesDe(hoy)) + ').');
    if (g.monto > 0) {
      const c = calcularPartes(g);
      if (!c.ok) errores.push(c.error);
    } else if (!(g.reparto || []).length) errores.push('Elige entre quiénes se divide el gasto.');
    (g.reparto || []).forEach(x => {
      const n = Number(x.cuotas || 1);
      if (!Number.isInteger(n) || n < 1 || n > 36) errores.push('Las cuotas deben ser entre 1 y 36.');
    });
    return errores;
  }

  /* ---------- Categoría automática ---------- */
  function sinTildes(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  const REGLAS = [
    ['verynice', /very\s*nice|tarifa.*aseo|servicio.*aseo|aseo.*(tarifa|servicio)|empleada/],
    ['arriendo', /arriendo|alquiler|\bcanon\b|\brenta\b|administracion/],
    ['internet', /internet|wifi|fibra|\bclaro\b|\btigo\b|movistar|\betb\b/],
    ['servicios', /\b(luz|energia|agua|gas|acueducto|epm|codensa|enel|servicios?)\b/],
    ['aseo', /aseo|limpieza|detergente|jabon|cloro|escoba|trapero|suavizante|desinfectante|ambientador/],
    ['mercado', /mercado|supermercado|exito|\bd1\b|\bara\b|jumbo|olimpica|carulla|fruver|plaza|arroz|leche|huevo|\bpan\b|carne|pollo|verdura|fruta|queso|aceite|panaderia/]
  ];
  function inferirCategoria(texto, categorias) {
    const t = sinTildes(texto);
    for (let i = 0; i < REGLAS.length; i++) {
      if (REGLAS[i][1].test(t) && categorias.some(c => c.id === REGLAS[i][0])) return REGLAS[i][0];
    }
    return 'otros';
  }

  /* ---------- Catálogo de productos (de las facturas) ---------- */
  function normalizarNombre(s) {
    return sinTildes(s).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function productos(estado) {
    const mapa = {};
    estado.gastos.forEach(g => {
      if (!g.factura || !g.factura.items) return;
      g.factura.items.forEach(it => {
        const clave = normalizarNombre(it.nombre);
        if (!clave || !(it.precio > 0)) return;
        if (!mapa[clave]) mapa[clave] = { clave, nombre: it.nombre.trim(), historial: [] };
        mapa[clave].historial.push({ fecha: g.fecha, precio: it.precio, cantidad: it.cantidad || 1, tienda: g.factura.tienda || '', gastoId: g.id, pagadoPor: g.pagadoPor });
      });
    });
    return Object.keys(mapa).map(k => {
      const p = mapa[k];
      p.historial.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
      const precios = p.historial.map(h => h.precio);
      p.veces = p.historial.length;
      p.ultimoPrecio = p.historial[0].precio;
      p.ultimaFecha = p.historial[0].fecha;
      p.promedio = Math.round(precios.reduce((a, b) => a + b, 0) / precios.length);
      p.min = Math.min.apply(null, precios);
      p.max = Math.max.apply(null, precios);
      return p;
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  function totalItems(items) {
    return (items || []).reduce((a, it) => a + Math.round((it.cantidad || 1) * (it.precio || 0)), 0);
  }

  return {
    CATEGORIAS_BASE, aDecimas, formatear, parsearDinero, parsearNumero,
    mesDe, sumarMeses, ultimoDia, nombreMes, limitePago, MESES,
    repartirEntero, calcularPartes, entradasDelGasto, saldosDelGasto,
    estadoVacio, nuevoId, saldosDelMes, lineasDelMes, totalDelMes, cruzar,
    mesesConActividad, cerrarMesesVencidos, mesAbierto, puedeEditarGasto,
    estadoTransferencias, pendientesCerrados, validarGasto,
    inferirCategoria, normalizarNombre, productos, totalItems
  };
});
