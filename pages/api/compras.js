// pages/api/compras.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { sku } = req.query;
    
    try {
      let query = supabase.from('compras').select('*');
      
      if (sku) {
        query = query.eq('sku', sku);
      }
      
      const { data, error } = await query.order('fecha_compra', { ascending: false });
      
      if (error) {
        console.error('Error GET compras:', error);
        return res.status(500).json({ error: error.message });
      }
      
      return res.status(200).json(data);
    } catch (error) {
      console.error('Error en API compras GET:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  if (req.method === 'POST') {
    const { numero_compra, sku, cantidad, fecha_compra, fecha_llegada_estimada, fecha_llegada_real, status_compra, container_number, proveedor, precio_compra } = req.body;
    
    // Validar campos requeridos
    if (!numero_compra || !sku || !cantidad) {
      return res.status(400).json({ error: 'numero_compra, SKU y cantidad son requeridos' });
    }
    
    if (cantidad <= 0) {
      return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
    }
    
    // Verificar que numero_compra no exista
    const { data: existing } = await supabase
      .from('compras')
      .select('numero_compra')
      .eq('numero_compra', numero_compra)
      .single();
    
    if (existing) {
      return res.status(400).json({ error: `Ya existe una compra con número ${numero_compra}` });
    }
    
    try {
      const newCompra = {
        numero_compra,
        sku,
        cantidad: parseInt(cantidad),
        fecha_compra: fecha_compra || new Date().toISOString(),
        fecha_llegada_estimada,
        fecha_llegada_real,
        status_compra: status_compra || 'en_transito',
        container_number,
        proveedor,
        precio_compra: precio_compra ? parseFloat(precio_compra) : null
      };
      
      const { data, error } = await supabase
        .from('compras')
        .insert(newCompra)
        .select();
      
      if (error) {
        console.error('Error POST compras:', error);
        return res.status(500).json({ error: error.message });
      }
      
      return res.status(201).json(data[0]);
    } catch (error) {
      console.error('Error en API compras POST:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}