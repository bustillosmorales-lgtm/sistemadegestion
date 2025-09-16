// pages/api/ventas.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { sku, days = 60 } = req.query;
    
    try {
      let query = supabase.from('ventas').select('*');
      
      if (sku) {
        query = query.eq('sku', sku);
      }
      
      // Filtrar por últimos X días
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - parseInt(days));
      query = query.gte('fecha_venta', dateLimit.toISOString());
      
      const { data, error } = await query.order('fecha_venta', { ascending: false });
      
      if (error) {
        console.error('Error GET ventas:', error);
        return res.status(500).json({ error: error.message });
      }
      
      return res.status(200).json(data);
    } catch (error) {
      console.error('Error en API ventas GET:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  if (req.method === 'POST') {
    const { numero_venta, sku, cantidad, fecha_venta, precio_venta_clp } = req.body;
    
    // Validar campos requeridos
    if (!numero_venta || !sku || !cantidad) {
      return res.status(400).json({ error: 'numero_venta, SKU y cantidad son requeridos' });
    }
    
    if (cantidad <= 0) {
      return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
    }
    
    // Verificar que numero_venta no exista
    const { data: existing } = await supabase
      .from('ventas')
      .select('numero_venta')
      .eq('numero_venta', numero_venta)
      .single();
    
    if (existing) {
      return res.status(400).json({ error: `Ya existe una venta con número ${numero_venta}` });
    }
    
    try {
      const newVenta = {
        numero_venta,
        sku,
        cantidad: parseInt(cantidad),
        fecha_venta: fecha_venta || new Date().toISOString(),
        precio_venta_clp: precio_venta_clp ? parseFloat(precio_venta_clp) : null
      };
      
      const { data, error } = await supabase
        .from('ventas')
        .insert(newVenta)
        .select();
      
      if (error) {
        console.error('Error POST ventas:', error);
        return res.status(500).json({ error: error.message });
      }
      
      return res.status(201).json(data[0]);
    } catch (error) {
      console.error('Error en API ventas POST:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}