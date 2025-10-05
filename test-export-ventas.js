// Script para probar el cálculo de ventas directamente
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testVentasCalculation() {
  console.log('🔍 Probando cálculo de ventas...\n');

  // 1. Obtener 5 SKUs de ejemplo del status NEEDS_REPLENISHMENT
  const { data: products } = await supabase
    .from('products')
    .select('sku, descripcion')
    .eq('status', 'NEEDS_REPLENISHMENT')
    .limit(5);

  if (!products || products.length === 0) {
    console.log('❌ No hay productos en NEEDS_REPLENISHMENT');
    return;
  }

  const skus = products.map(p => p.sku);
  console.log(`📦 Probando con ${skus.length} SKUs:`, skus.join(', '));

  // 2. Obtener ventas directamente (como lo hace export-by-status.js)
  const { data: todasVentas, error: ventasError } = await supabase
    .from('ventas')
    .select('sku, fecha_venta, cantidad')
    .in('sku', skus)
    .order('sku', { ascending: true })
    .order('fecha_venta', { ascending: true });

  if (ventasError) {
    console.error('❌ Error consultando ventas:', ventasError);
    return;
  }

  console.log(`\n📈 Obtenidas ${todasVentas?.length || 0} ventas totales\n`);

  // 3. Agrupar y calcular como lo hace el código
  const ventasPorSku = {};
  (todasVentas || []).forEach(v => {
    if (!ventasPorSku[v.sku]) {
      ventasPorSku[v.sku] = [];
    }
    ventasPorSku[v.sku].push(v);
  });

  // 4. Calcular para cada SKU
  const fechasMap = {};

  skus.forEach(sku => {
    const ventas = ventasPorSku[sku];
    const producto = products.find(p => p.sku === sku);

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📦 SKU: ${sku}`);
    console.log(`   Descripción: ${producto?.descripcion || 'N/A'}`);

    if (!ventas || ventas.length === 0) {
      console.log(`   ⚠️  SIN VENTAS REGISTRADAS`);
      fechasMap[sku] = {
        ventaDiaria: 0,
        fechaInicio: null,
        fechaFin: null,
        diasPeriodo: 0,
        unidadesVendidas: 0
      };
      return;
    }

    console.log(`   ✅ ${ventas.length} ventas encontradas`);

    // Mostrar primeras 3 ventas
    console.log(`\n   Primeras ventas:`);
    ventas.slice(0, 3).forEach(v => {
      console.log(`      - ${v.fecha_venta}: ${v.cantidad} unidades`);
    });

    const fechaInicio = ventas[0].fecha_venta;
    const fechaFin = ventas[ventas.length - 1].fecha_venta;
    const totalVendido = ventas.reduce((sum, v) => sum + (v.cantidad || 0), 0);

    const dias = Math.max(1, Math.ceil((new Date(fechaFin) - new Date(fechaInicio)) / (1000 * 60 * 60 * 24)));
    const ventaDiaria = dias > 0 ? totalVendido / dias : 0;

    const formatearFecha = (fecha) => {
      if (!fecha) return null;
      const fechaStr = String(fecha);
      return fechaStr.split('T')[0].split(' ')[0];
    };

    fechasMap[sku] = {
      ventaDiaria: parseFloat(ventaDiaria.toFixed(4)),
      fechaInicio: formatearFecha(fechaInicio),
      fechaFin: formatearFecha(fechaFin),
      diasPeriodo: dias,
      unidadesVendidas: totalVendido
    };

    console.log(`\n   📊 RESULTADOS DEL CÁLCULO:`);
    console.log(`      Fecha Inicial: ${fechasMap[sku].fechaInicio}`);
    console.log(`      Fecha Final: ${fechasMap[sku].fechaFin}`);
    console.log(`      Días del Periodo: ${fechasMap[sku].diasPeriodo}`);
    console.log(`      Unidades Vendidas: ${fechasMap[sku].unidadesVendidas}`);
    console.log(`      Venta Diaria: ${fechasMap[sku].ventaDiaria.toFixed(2)}`);
  });

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`✅ Prueba completada\n`);
  console.log(`📊 RESUMEN:`);
  console.log(`   - Total SKUs probados: ${skus.length}`);
  console.log(`   - Con ventas: ${Object.values(fechasMap).filter(f => f.unidadesVendidas > 0).length}`);
  console.log(`   - Sin ventas: ${Object.values(fechasMap).filter(f => f.unidadesVendidas === 0).length}`);
}

testVentasCalculation().catch(console.error);
