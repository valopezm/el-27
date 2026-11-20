/* ============================================================
   Pruebas automáticas del "cerebro" (logica.js).
   - En el navegador: abre pruebas.html
   - En terminal:      node js/pruebas.js
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const L = require('./logica.js');
    const r = factory(L);
    r.imprimir();
    if (r.fallos > 0) process.exit(1);
  } else root.correrPruebas = function () { return factory(root.Logica); };
})(typeof self !== 'undefined' ? self : this, function (L) {
  'use strict';
  const resultados = [];
  let fallos = 0;
  function prueba(nombre, fn) {
    try { fn(); resultados.push({ nombre, ok: true }); }
    catch (e) { fallos++; resultados.push({ nombre, ok: false, error: e.message }); }
  }
  function igual(real, esperado, msg) {
    const a = JSON.stringify(real), b = JSON.stringify(esperado);
    if (a !== b) throw new Error((msg ? msg + ': ' : '') + 'esperaba ' + b + ' y obtuve ' + a);
  }
  function cierto(cond, msg) { if (!cond) throw new Error(msg || 'no se cumplió'); }

  const $ = p => L.aDecimas(p);              // pesos -> décimas
  const USUARIOS = [{ id: 'A', apodo: 'Val' }, { id: 'B', apodo: 'Santi' }, { id: 'C', apodo: 'Pegui' }];
  const TODOS = ['A', 'B', 'C'];
  function gasto(o) {
    return Object.assign({
      id: L.nuevoId(), descripcion: 'x', monto: 0, pagadoPor: 'A', fecha: '2026-11-05', categoriaId: 'otros', creadoPor: 'A',
      metodo: 'iguales', reparto: TODOS.map(u => ({ uid: u, valor: null, cuotas: 1 })), factura: null
    }, o);
  }
  function estadoCon(gastos, pagos) {
    const e = L.estadoVacio(USUARIOS);
    e.gastos = gastos || []; e.pagos = pagos || [];
    return e;
  }
  const suma = o => Object.keys(o).reduce((a, k) => a + o[k], 0);

  /* ----- Formato de dinero ----- */
  prueba('Formato 1.500.000 y un decimal', () => {
    igual(L.formatear($(1500000)), '$1.500.000');
    igual(L.formatear($(333333.3)), '$333.333,3');
    igual(L.formatear(-$(600000)), '-$600.000');
    igual(L.formatear(0), '$0');
  });
  prueba('Lee lo que escribe la gente', () => {
    igual(L.parsearDinero('1.500.000'), $(1500000));
    igual(L.parsearDinero('1500000'), $(1500000));
    igual(L.parsearDinero('$ 300.000'), $(300000));
    igual(L.parsearDinero('333,3'), $(333.3));
    igual(L.parsearDinero('1.500.000,5'), $(1500000.5));
    igual(L.parsearDinero('333.3'), $(333.3));
    igual(L.parsearDinero('abc'), null);
    igual(L.parsearDinero(''), null);
  });

  /* ----- Criterios de aceptación de Valentina ----- */
  prueba('ARRIENDO: A paga 1.500.000 en partes iguales -> B y C le deben 500.000 a A', () => {
    const e = estadoCon([gasto({ monto: $(1500000), pagadoPor: 'A' })]);
    const s = L.saldosDelMes(e, '2026-11');
    igual(s, { A: $(1000000), B: -$(500000), C: -$(500000) });
    const t = L.cruzar(s).sort((x, y) => (x.de < y.de ? -1 : 1));
    igual(t, [{ de: 'B', a: 'A', monto: $(500000) }, { de: 'C', a: 'A', monto: $(500000) }]);
  });
  prueba('MERCADO: B paga 300.000 entre los 3 -> C le paga 600.000 a A y B le paga 300.000 a A', () => {
    const e = estadoCon([
      gasto({ monto: $(1500000), pagadoPor: 'A' }),
      gasto({ monto: $(300000), pagadoPor: 'B', descripcion: 'Mercado' })
    ]);
    const s = L.saldosDelMes(e, '2026-11');
    igual(s, { A: $(900000), B: -$(300000), C: -$(600000) });
    const t = L.cruzar(s).sort((x, y) => (x.de < y.de ? -1 : 1));
    igual(t, [{ de: 'B', a: 'A', monto: $(300000) }, { de: 'C', a: 'A', monto: $(600000) }]);
    igual(t.length, 2, 'cantidad de pagos');
  });

  /* ----- Formas de dividir ----- */
  prueba('Redondeo: 100.000 entre 3 suma exacto y con máximo 1 decimal', () => {
    const c = L.calcularPartes(gasto({ monto: $(100000) }));
    cierto(c.ok);
    igual(suma(c.partes), $(100000));
    igual(Object.keys(c.partes).map(k => c.partes[k]).sort(), [333333, 333333, 333334].map(x => x).sort());
    Object.keys(c.partes).forEach(k => cierto(Number.isInteger(c.partes[k])));
  });
  prueba('Entre dos personas: 90.000 entre A y B (pagó A) -> B debe 45.000', () => {
    const g = gasto({ monto: $(90000), pagadoPor: 'A', reparto: [{ uid: 'A', cuotas: 1 }, { uid: 'B', cuotas: 1 }] });
    igual(L.saldosDelMes(estadoCon([g]), '2026-11'), { A: $(45000), B: -$(45000), C: 0 });
  });
  prueba('Una sola persona: A paga 50.000 solo para B -> B le debe 50.000 a A', () => {
    const g = gasto({ monto: $(50000), pagadoPor: 'A', reparto: [{ uid: 'B', cuotas: 1 }] });
    igual(L.cruzar(L.saldosDelMes(estadoCon([g]), '2026-11')), [{ de: 'B', a: 'A', monto: $(50000) }]);
  });
  prueba('Una sola persona y es quien pagó: no genera deuda', () => {
    const g = gasto({ monto: $(50000), pagadoPor: 'A', reparto: [{ uid: 'A', cuotas: 1 }] });
    igual(L.cruzar(L.saldosDelMes(estadoCon([g]), '2026-11')), []);
  });
  prueba('Por porcentaje: 100.000 al 50/30/20', () => {
    const g = gasto({ monto: $(100000), metodo: 'porcentaje', reparto: [{ uid: 'A', valor: 50 }, { uid: 'B', valor: 30 }, { uid: 'C', valor: 20 }] });
    const c = L.calcularPartes(g);
    igual(c.partes, { A: $(50000), B: $(30000), C: $(20000) });
  });
  prueba('Por porcentaje: si no suma 100% avisa', () => {
    const g = gasto({ monto: $(100000), metodo: 'porcentaje', reparto: [{ uid: 'A', valor: 50 }, { uid: 'B', valor: 30 }, { uid: 'C', valor: 10 }] });
    const c = L.calcularPartes(g);
    cierto(!c.ok && /90/.test(c.error), c.error);
  });
  prueba('Por porcentaje 33,33/33,33/33,34 suma exacto', () => {
    const g = gasto({ monto: $(100000), metodo: 'porcentaje', reparto: [{ uid: 'A', valor: 33.33 }, { uid: 'B', valor: 33.33 }, { uid: 'C', valor: 33.34 }] });
    const c = L.calcularPartes(g);
    cierto(c.ok); igual(suma(c.partes), $(100000));
  });
  prueba('Montos exactos: valida que sumen el total', () => {
    const base = { monto: $(100000), metodo: 'montos' };
    const mal = L.calcularPartes(gasto(Object.assign({}, base, { reparto: [{ uid: 'A', valor: $(60000) }, { uid: 'B', valor: $(30000) }, { uid: 'C', valor: $(5000) }] })));
    cierto(!mal.ok && /Faltan \$5\.000/.test(mal.error), mal.error);
    const bien = L.calcularPartes(gasto(Object.assign({}, base, { reparto: [{ uid: 'A', valor: $(60000) }, { uid: 'B', valor: $(30000) }, { uid: 'C', valor: $(10000) }] })));
    cierto(bien.ok);
  });

  /* ----- Cuotas ----- */
  prueba('Cuotas: licuadora 240.000 pagó C; A paga en 1 mes y B en 4 meses', () => {
    const g = gasto({
      monto: $(240000), pagadoPor: 'C', fecha: '2026-11-10',
      reparto: [{ uid: 'A', cuotas: 1 }, { uid: 'B', cuotas: 4 }, { uid: 'C', cuotas: 1 }]
    });
    const e = estadoCon([g]);
    igual(L.saldosDelMes(e, '2026-11'), { A: -$(80000), B: -$(20000), C: $(100000) });
    ['2026-12', '2027-01', '2027-02'].forEach(m => igual(L.saldosDelMes(e, m), { A: 0, B: -$(20000), C: $(20000) }, m));
    igual(L.saldosDelMes(e, '2027-03'), { A: 0, B: 0, C: 0 });
  });
  prueba('Cuotas con redondeo: 10 pesos en 3 cuotas = 3,4 + 3,3 + 3,3', () => {
    const t = L.repartirEntero($(10), 3);
    igual(t, [34, 33, 33]);
    igual(t.reduce((a, b) => a + b, 0), $(10));
  });
  prueba('Cuotas que cruzan de año (dic -> ene)', () => {
    igual(L.sumarMeses('2026-12', 1), '2027-01');
    igual(L.sumarMeses('2026-01', -1), '2025-12');
    igual(L.limitePago('2026-12'), '2027-01-11');
    igual(L.limitePago('2026-10'), '2026-11-11');
  });

  /* ----- Pagos entre roommates ----- */
  prueba('Pago "B le pagó a A" ajusta los saldos', () => {
    const e = estadoCon([gasto({ monto: $(1500000), pagadoPor: 'A' })], [{ id: 'p1', mes: '2026-11', de: 'B', a: 'A', monto: $(500000), fecha: '2026-11-20' }]);
    igual(L.saldosDelMes(e, '2026-11'), { A: $(500000), B: 0, C: -$(500000) });
  });

  /* ----- Cierre de mes ----- */
  prueba('Cierre: un mes pasado se cierra solo y queda guardado', () => {
    const e = estadoCon([gasto({ monto: $(1500000), pagadoPor: 'A', fecha: '2026-10-05' })]);
    igual(L.cerrarMesesVencidos(e, '2026-10-31'), [], 'el 31 aún está abierto');
    igual(L.cerrarMesesVencidos(e, '2026-11-01'), ['2026-10']);
    const c = e.cierres['2026-10'];
    igual(c.cerradoEn, '2026-10-31 23:59');
    igual(c.limitePago, '2026-11-11');
    igual(c.transferencias.length, 2);
    igual(L.cerrarMesesVencidos(e, '2026-11-15'), [], 'no se cierra dos veces');
  });
  prueba('Cierre: mes cerrado no se puede editar, el abierto sí', () => {
    const viejo = gasto({ fecha: '2026-10-05' }), nuevo = gasto({ fecha: '2026-11-05' });
    cierto(!L.puedeEditarGasto(viejo, '2026-11-10'));
    cierto(L.puedeEditarGasto(nuevo, '2026-11-10'));
  });
  prueba('Cierre: validación rechaza fechas de meses cerrados', () => {
    const e = estadoCon();
    const errs = L.validarGasto(e, gasto({ monto: $(1000), fecha: '2026-10-30', descripcion: 'x' }), '2026-11-10');
    cierto(errs.length === 1 && /mes abierto/.test(errs[0]), errs.join('|'));
    igual(L.validarGasto(e, gasto({ monto: $(1000), descripcion: 'ok' }), '2026-11-10'), []);
  });
  prueba('Cierre: un gasto en cuotas genera cierres en los meses siguientes', () => {
    const g = gasto({ monto: $(300000), pagadoPor: 'A', fecha: '2026-10-28', reparto: [{ uid: 'A', cuotas: 1 }, { uid: 'B', cuotas: 3 }, { uid: 'C', cuotas: 1 }] });
    const e = estadoCon([g]);
    L.cerrarMesesVencidos(e, '2026-12-01');
    igual(Object.keys(e.cierres).sort(), ['2026-10', '2026-11']);
    igual(e.cierres['2026-11'].transferencias, [{ de: 'B', a: 'A', monto: $(33333.3) }].map(t => ({ de: t.de, a: t.a, monto: 333333 })));
  });
  prueba('Transferencias: pagado / parcial / pendiente / vencido', () => {
    const e = estadoCon([gasto({ monto: $(1500000), pagadoPor: 'A', fecha: '2026-10-05' })]);
    L.cerrarMesesVencidos(e, '2026-11-02');
    let t = L.estadoTransferencias(e, '2026-10', '2026-11-05');
    cierto(t.every(x => x.estado === 'pendiente' && !x.vencido));
    e.pagos.push({ id: 'p', mes: '2026-10', postCierre: true, de: 'B', a: 'A', monto: $(200000), fecha: '2026-11-06' });
    t = L.estadoTransferencias(e, '2026-10', '2026-11-12');
    const b = t.find(x => x.de === 'B');
    igual([b.estado, b.falta, b.vencido], ['parcial', $(300000), true]);
    e.pagos.push({ id: 'q', mes: '2026-10', postCierre: true, de: 'B', a: 'A', monto: $(300000), fecha: '2026-11-07' });
    igual(L.estadoTransferencias(e, '2026-10', '2026-11-12').find(x => x.de === 'B').estado, 'pagado');
    igual(L.pendientesCerrados(e, '2026-11-12').length, 1);
  });

  /* ----- Catálogo de productos ----- */
  prueba('Productos: junta compras del mismo producto y calcula precios', () => {
    const f1 = { tienda: 'D1', items: [{ nombre: 'Arroz Diana 500g', cantidad: 2, precio: $(3200) }, { nombre: 'Leche', cantidad: 1, precio: $(4500) }] };
    const f2 = { tienda: 'Éxito', items: [{ nombre: 'ARROZ  diana 500g', cantidad: 1, precio: $(3500) }] };
    const e = estadoCon([gasto({ fecha: '2026-11-02', factura: f1, monto: $(10900) }), gasto({ fecha: '2026-11-20', factura: f2, monto: $(3500) })]);
    const p = L.productos(e);
    igual(p.length, 2);
    const arroz = p.find(x => /arroz/i.test(x.nombre));
    igual([arroz.veces, arroz.ultimoPrecio, arroz.promedio, arroz.min, arroz.max], [2, $(3500), $(3350), $(3200), $(3500)]);
    igual(L.totalItems(f1.items), $(10900));
  });

  /* ----- Categoría automática ----- */
  prueba('Categoría automática (si no se elige) y "Otros" por defecto', () => {
    const c = L.CATEGORIAS_BASE;
    igual(L.inferirCategoria('Mercado D1', c), 'mercado');
    igual(L.inferirCategoria('Arriendo de noviembre', c), 'arriendo');
    igual(L.inferirCategoria('Tarifa servicio de aseo', c), 'verynice');
    igual(L.inferirCategoria('Internet Claro', c), 'internet');
    igual(L.inferirCategoria('Factura de la luz', c), 'servicios');
    igual(L.inferirCategoria('Detergente y cloro', c), 'aseo');
    igual(L.inferirCategoria('cosas raras', c), 'otros');
  });

  /* ----- Prueba de estrés: siempre cuadra a cero ----- */
  prueba('200 gastos al azar: cada mes suma cero y cada reparto suma el total', () => {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const gs = [];
    for (let i = 0; i < 200; i++) {
      const monto = Math.max(10, Math.round(rnd() * 5000000));
      const n = 1 + Math.floor(rnd() * 3);
      const part = TODOS.slice().sort(() => rnd() - 0.5).slice(0, n);
      const metodo = ['iguales', 'porcentaje', 'montos'][Math.floor(rnd() * 3)];
      let reparto;
      if (metodo === 'porcentaje') {
        const ps = L.repartirEntero(10000, n).map(x => x / 100);
        reparto = part.map((u, k) => ({ uid: u, valor: ps[k], cuotas: 1 + Math.floor(rnd() * 5) }));
      } else if (metodo === 'montos') {
        const ms = L.repartirEntero(monto, n);
        reparto = part.map((u, k) => ({ uid: u, valor: ms[k], cuotas: 1 + Math.floor(rnd() * 5) }));
      } else reparto = part.map(u => ({ uid: u, cuotas: 1 + Math.floor(rnd() * 5) }));
      gs.push(gasto({ monto, metodo, reparto, pagadoPor: TODOS[Math.floor(rnd() * 3)], fecha: '2026-11-' + String(1 + Math.floor(rnd() * 28)).padStart(2, '0') }));
    }
    const e = estadoCon(gs);
    gs.forEach(g => { const c = L.calcularPartes(g); cierto(c.ok, c.error); igual(suma(c.partes), g.monto); });
    L.mesesConActividad(e).forEach(m => {
      const s = L.saldosDelMes(e, m);
      igual(suma(s), 0, m);
      cierto(L.cruzar(s).length <= 2, 'más de 2 pagos en ' + m);
    });
  });

  function imprimir() {
    resultados.forEach(r => console.log((r.ok ? '  ✔ ' : '  ✘ ') + r.nombre + (r.ok ? '' : '\n      -> ' + r.error)));
    console.log('\n' + (resultados.length - fallos) + ' de ' + resultados.length + ' pruebas correctas' + (fallos ? ' · ' + fallos + ' FALLARON' : ' 🎉'));
  }
  return { resultados, fallos, imprimir };
});
