// pages/api/products.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { sku } = req.query;
    if (sku) {
        const { data, error } = await supabase.from('products').select('*').eq('sku', sku).single();
        if (error || !data) return res.status(404).json({ error: 'Producto no encontrado' });
        return res.status(200).json(data);
    } else {
        const { data, error } = await supabase.from('products').select('*');
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
    }
  }

  if (req.method === 'POST') {
    const { descripcion, cantidad, link, costoFOB_RMB, cbm, ventaDiaria } = req.body;
    
    // Aquí puedes añadir más validaciones si lo deseas

    const newSku = `SKU-${Math.floor(100000 + Math.random() * 900000)}`;
    const newProduct = {
        sku: newSku,
        descripcion,
        link: link || '',
        costo_fob_rmb: parseFloat(costoFOB_RMB) || 0,
        cbm: parseFloat(cbm) || 0,
        stock_actual: 0,
        status: 'QUOTE_REQUESTED',  // Cambiar de NEEDS_REPLENISHMENT a QUOTE_REQUESTED
        desconsiderado: false,
        isNewProduct: true,  // Marcar como producto nuevo
        hasInternalSku: false,  // No tiene SKU interno todavía
        // Agregar la cantidad especificada en el formulario en request_details
        request_details: {
            quantityToQuote: parseInt(cantidad) || 0,
            timestamp: new Date().toISOString(),
            previousStatus: null,
            nextStatus: 'QUOTE_REQUESTED',
            sku: newSku,
            descripcion: descripcion,
            createdFromForm: true
        }
    };

    const { data, error } = await supabase.from('products').insert(newProduct).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data[0]);
  }

  if (req.method === 'PATCH') {
    const { sku } = req.query;
    const { desconsiderado } = req.body;
    
    if (!sku) {
      return res.status(400).json({ error: 'SKU requerido' });
    }
    
    const { data, error } = await supabase
      .from('products')
      .update({ desconsiderado: desconsiderado })
      .eq('sku', sku)
      .select();
      
    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    return res.status(200).json(data[0]);
  }

  res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
