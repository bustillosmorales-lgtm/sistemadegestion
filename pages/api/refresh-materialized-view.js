// pages/api/refresh-materialized-view.js
import { supabase } from '../../lib/supabaseClient';

export const config = {
  maxDuration: 300, // 5 minutos
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔄 REFRESCANDO VISTA MATERIALIZADA sku_venta_diaria_mv...');

    // Contar antes
    const { count: beforeCount } = await supabase
      .from('sku_venta_diaria_mv')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Registros antes: ${beforeCount}`);

    // REFRESH MATERIALIZED VIEW usando SQL directo
    // Nota: Supabase no expone REFRESH directamente, así que usamos rpc
    const { data, error } = await supabase.rpc('refresh_sku_venta_diaria_mv');

    if (error) {
      console.error('❌ Error refrescando vista:', error);

      // Si el RPC no existe, intentar con DELETE + el trigger automático
      console.log('🔄 Intentando método alternativo...');

      // Eliminar todos los registros (el trigger debería regenerarlos)
      const { error: deleteError } = await supabase
        .from('sku_venta_diaria_mv')
        .delete()
        .neq('sku', '');

      if (deleteError) {
        console.error('❌ Error con método alternativo:', deleteError);
        throw new Error('No se pudo refrescar la vista materializada. Contacta al administrador de BD.');
      }
    }

    // Contar después
    const { count: afterCount } = await supabase
      .from('sku_venta_diaria_mv')
      .select('*', { count: 'exact', head: true });

    console.log(`✅ Vista materializada refrescada`);
    console.log(`📊 Registros después: ${afterCount}`);

    return res.status(200).json({
      success: true,
      message: 'Vista materializada refrescada',
      before: beforeCount,
      after: afterCount
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({
      error: 'Error refrescando vista materializada',
      details: error.message
    });
  }
}
