/* ============================================================
   El 27 · DATOS DE PRUEBA (solo Fase 1)
   Los 3 roommates y dos escenarios de ejemplo para probar.
   (Los correos NO van aquí: el repositorio será público.)
   ============================================================ */
(function () {
  'use strict';
  const L = window.Logica;

  const USUARIOS = [
    { id: 'val', nombre: 'Valentina', apodo: 'Val', color: '#d6456f' },
    { id: 'santi', nombre: 'Santiago Catano', apodo: 'Santi', color: '#1f8a7d' },
    { id: 'pegui', nombre: 'Esteban Upegui', apodo: 'Pegui', color: '#d2831a' }
  ];
  const TODOS = USUARIOS.map(u => u.id);
  const $ = p => L.aDecimas(p);
  const pad = n => String(n).padStart(2, '0');

  function vacio() { return L.estadoVacio(USUARIOS); }

  function agregar(estado, o) {
    estado.gastos.push(Object.assign({
      id: L.nuevoId(), descripcion: '', monto: 0, pagadoPor: 'val', fecha: '', categoriaId: 'otros', creadoPor: 'val',
      metodo: 'iguales', reparto: TODOS.map(u => ({ uid: u, valor: null, cuotas: 1 })), factura: null
    }, o));
  }

  // Escenario de aceptación: arriendo (Val) + mercado (Santi)
  function aceptacion(hoy) {
    const e = vacio();
    const mes = L.mesDe(hoy), dia = n => mes + '-' + pad(Math.min(n, Number(hoy.slice(8, 10))));
    agregar(e, { descripcion: 'Arriendo', monto: $(1500000), pagadoPor: 'val', creadoPor: 'val', fecha: dia(1), categoriaId: 'arriendo' });
    agregar(e, { descripcion: 'Mercado', monto: $(300000), pagadoPor: 'santi', creadoPor: 'santi', fecha: dia(2), categoriaId: 'mercado' });
    return e;
  }

  // Ejemplo completo: mes anterior (se cierra solo) + mes actual con cuotas, facturas y pagos
  function completo(hoy) {
    const e = vacio();
    const mes = L.mesDe(hoy), ant = L.sumarMeses(mes, -1);
    const dia = n => mes + '-' + pad(Math.min(n, Number(hoy.slice(8, 10))));
    const diaAnt = n => ant + '-' + pad(n);
    const todos = c => TODOS.map(u => ({ uid: u, valor: null, cuotas: c || 1 }));

    // --- Mes anterior ---
    agregar(e, { descripcion: 'Arriendo', monto: $(1500000), pagadoPor: 'val', creadoPor: 'val', fecha: diaAnt(1), categoriaId: 'arriendo' });
    agregar(e, { descripcion: 'Servicios (agua, luz, gas)', monto: $(214500), pagadoPor: 'santi', creadoPor: 'santi', fecha: diaAnt(8), categoriaId: 'servicios' });
    agregar(e, { descripcion: 'Mercado D1', monto: $(40200), pagadoPor: 'pegui', creadoPor: 'pegui', fecha: diaAnt(12), categoriaId: 'mercado',
      factura: { fotoId: null, tienda: 'D1', items: [
        { nombre: 'Arroz Diana 500g', cantidad: 2, precio: $(3100) },
        { nombre: 'Leche entera 1L', cantidad: 4, precio: $(4300) },
        { nombre: 'Huevos x30', cantidad: 1, precio: $(16800) }] } });
    agregar(e, { descripcion: 'Tarifa servicio de aseo', monto: $(90000), pagadoPor: 'pegui', creadoPor: 'pegui', fecha: diaAnt(20), categoriaId: 'verynice' });

    // --- Mes actual ---
    agregar(e, { descripcion: 'Arriendo', monto: $(1500000), pagadoPor: 'val', creadoPor: 'val', fecha: dia(1), categoriaId: 'arriendo' });
    agregar(e, { descripcion: 'Internet', monto: $(89900), pagadoPor: 'santi', creadoPor: 'santi', fecha: dia(3), categoriaId: 'internet' });
    agregar(e, { descripcion: 'Mercado Éxito', monto: $(86400), pagadoPor: 'santi', creadoPor: 'santi', fecha: dia(5), categoriaId: 'mercado',
      factura: { fotoId: null, tienda: 'Éxito', items: [
        { nombre: 'Arroz Diana 500g', cantidad: 2, precio: $(3200) },
        { nombre: 'Leche entera 1L', cantidad: 6, precio: $(4500) },
        { nombre: 'Huevos x30', cantidad: 1, precio: $(17500) },
        { nombre: 'Pollo entero', cantidad: 1, precio: $(22000) },
        { nombre: 'Detergente líquido', cantidad: 1, precio: $(13500) }] } });
    // Licuadora en cuotas: Val la paga en 1 mes, Santi en 4 meses
    agregar(e, { descripcion: 'Licuadora', monto: $(240000), pagadoPor: 'pegui', creadoPor: 'pegui', fecha: dia(6), categoriaId: 'otros',
      reparto: [{ uid: 'val', valor: null, cuotas: 1 }, { uid: 'santi', valor: null, cuotas: 4 }, { uid: 'pegui', valor: null, cuotas: 1 }] });
    // Cena entre dos, por porcentaje
    agregar(e, { descripcion: 'Cena (Val y Santi)', monto: $(70000), pagadoPor: 'val', creadoPor: 'val', fecha: dia(7), categoriaId: 'otros',
      metodo: 'porcentaje', reparto: [{ uid: 'val', valor: 60, cuotas: 1 }, { uid: 'santi', valor: 40, cuotas: 1 }] });
    agregar(e, { descripcion: 'Tarifa servicio de aseo', monto: $(90000), pagadoPor: 'pegui', creadoPor: 'pegui', fecha: dia(8), categoriaId: 'verynice' });
    return e;
  }

  window.DatosPrueba = { USUARIOS, vacio, aceptacion, completo };
})();
