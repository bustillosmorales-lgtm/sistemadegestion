// pages/api/modify-price.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { 
    sku, 
    originalPrice, 
    originalCurrency, 
    newPrice, 
    newCurrency, 
    notes, 
    modifiedBy 
  } = req.body;

  if (!sku || !newPrice || !notes) {
    return res.status(400).json({ error: 'SKU, nuevo precio y notas son requeridos' });
  }

  try {
    // 1. Obtener el producto original
    const { data: originalProduct, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('sku', sku)
      .single();

    if (productError || !originalProduct) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // 2. Obtener configuración para convertir precios si es necesario
    const { data: configData } = await supabase
      .from('configuration')
      .select('data')
      .eq('id', 1)
      .single();
    
    const config = configData?.data || {};

    // 3. Convertir el nuevo precio a RMB si viene en USD
    let newPriceInRMB = newPrice;
    if (newCurrency === 'USD' && config.rmbToUsd) {
      newPriceInRMB = newPrice / config.rmbToUsd; // Convertir USD a RMB
    }

    // 4. Crear historial de modificaciones de precio
    const currentPriceHistory = originalProduct.price_modification_history || [];
    const newPriceModification = {
      modificationId: `PM-${Date.now()}`,
      previousPrice: originalProduct.costo_fob_rmb,
      previousCurrency: 'RMB',
      newPrice: newPrice,
      newCurrency: newCurrency,
      newPriceInRMB: newPriceInRMB,
      modificationNotes: notes,
      modifiedBy: modifiedBy,
      modifiedAt: new Date().toISOString(),
      conversionRate: newCurrency === 'USD' ? config.rmbToUsd : 1
    };

    // 5. Actualizar el producto existente con el nuevo precio
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update({
        costo_fob_rmb: newPriceInRMB,
        status: 'QUOTED_PRICE_MODIFIED', // Cambiar status para re-análisis
        price_modification_details: newPriceModification,
        price_modification_history: [...currentPriceHistory, newPriceModification],
        is_price_modification: true,
        updated_at: new Date().toISOString()
      })
      .eq('sku', sku)
      .select()
      .single();

    if (updateError) {
      console.error('Error actualizando producto con precio modificado:', updateError);
      return res.status(500).json({ error: 'Error modificando precio: ' + updateError.message });
    }

    return res.status(200).json({
      message: 'Precio modificado exitosamente en la misma línea',
      sku: sku,
      previousPrice: originalProduct.costo_fob_rmb,
      newPrice: newPrice,
      newCurrency: newCurrency,
      newPriceInRMB: newPriceInRMB,
      product: updatedProduct
    });

  } catch (error) {
    console.error('Error en modify-price:', error);
    return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
}