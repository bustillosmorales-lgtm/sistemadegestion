const { supabase } = require('./lib/supabaseClient');

async function test() {
  console.log('Probando consulta a vista materializada...');
  
  const { data: products } = await supabase
    .from('products')
    .select('sku')
    .limit(5);
  
  const skus = products.map(p => p.sku);
  console.log('SKUs de prueba:', skus);
  
  const { data: ventasDiariasFechas, error } = await supabase
    .from('sku_venta_diaria_mv')
    .select('sku, fecha_inicio, fecha_fin, dias_periodo, total_vendido')
    .in('sku', skus);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Registros retornados:', ventasDiariasFechas.length);
  
  ventasDiariasFechas.forEach(v => {
    console.log('---');
    console.log('SKU:', v.sku);
    console.log('fecha_inicio:', v.fecha_inicio, 'tipo:', typeof v.fecha_inicio);
    console.log('fecha_fin:', v.fecha_fin, 'tipo:', typeof v.fecha_fin);
    
    const formatearFecha = (fecha) => {
      if (!fecha) return null;
      const fechaStr = String(fecha);
      return fechaStr.split('T')[0].split(' ')[0];
    };
    
    console.log('fecha_inicio FORMATEADA:', formatearFecha(v.fecha_inicio));
    console.log('fecha_fin FORMATEADA:', formatearFecha(v.fecha_fin));
  });
}

test().catch(console.error);
