// pages/api/clean-en-proceso.js - Limpia SKUs con status "en proceso"
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔍 Buscando SKUs con status "en proceso"...');

    // Primero consultar cuántos hay
    const { data: enProcesoProducts, error: checkError } = await supabase
      .from('products')
      .select('sku, status, descripcion')
      .eq('status', 'en proceso')
      .order('sku');

    if (checkError) {
      throw new Error('Error consultando productos: ' + checkError.message);
    }

    if (!enProcesoProducts || enProcesoProducts.length === 0) {
      console.log('✅ No hay SKUs con status "en proceso"');
      return res.status(200).json({
        success: true,
        message: 'No hay SKUs con status "en proceso"',
        count: 0,
        products: []
      });
    }

    console.log(`📊 Total SKUs encontrados con "en proceso": ${enProcesoProducts.length}`);

    // Solo consultar si es POST (ejecutar limpieza)
    if (req.method === 'POST') {
      const newStatus = req.body?.newStatus || 'NEEDS_REPLENISHMENT';

      console.log(`🧹 Actualizando ${enProcesoProducts.length} SKUs a "${newStatus}"...`);

      // Actualizar todos a nuevo status
      const { data: updatedProducts, error: updateError } = await supabase
        .from('products')
        .update({
          status: newStatus
        })
        .eq('status', 'en proceso')
        .select('sku, status');

      if (updateError) {
        throw new Error('Error actualizando productos: ' + updateError.message);
      }

      console.log(`✅ ${updatedProducts.length} SKUs actualizados`);

      // Verificar que no queden
      const { count: remainingCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'en proceso');

      console.log(`🔍 Verificación: ${remainingCount || 0} SKUs quedan en proceso`);

      return res.status(200).json({
        success: true,
        message: `${updatedProducts.length} SKUs actualizados de "en proceso" a "${newStatus}"`,
        count: updatedProducts.length,
        products: updatedProducts,
        remaining: remainingCount || 0
      });
    }

    // Si es GET, solo retornar los productos encontrados
    return res.status(200).json({
      success: true,
      message: `Encontrados ${enProcesoProducts.length} SKUs con status "en proceso"`,
      count: enProcesoProducts.length,
      products: enProcesoProducts.map(p => ({
        sku: p.sku,
        status: p.status,
        descripcion: p.descripcion
      }))
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
