// pages/api/check-data.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  try {
    // Contar registros en cada tabla
    const [ventas, compras, containers, products] = await Promise.all([
      supabase.from('ventas').select('*', { count: 'exact', head: true }),
      supabase.from('compras').select('*', { count: 'exact', head: true }),
      supabase.from('containers').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('*', { count: 'exact', head: true })
    ]);

    const result = {
      ventas: ventas.count || 0,
      compras: compras.count || 0,
      containers: containers.count || 0,
      products: products.count || 0
    };

    console.log('📊 Resumen de datos:', result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error consultando datos:', error);
    return res.status(500).json({ error: error.message });
  }
}
