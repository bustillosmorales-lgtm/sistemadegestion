// pages/api/reminders.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('replenishment_reminders')
        .select('*')
        .order('reminder_date', { ascending: true });
      
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { sku, reminder_date, notes } = req.body;
      
      if (!sku || !reminder_date) {
        return res.status(400).json({ error: 'SKU y fecha de recordatorio son requeridos' });
      }

      // Verificar que el producto existe
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('sku, descripcion, status')
        .eq('sku', sku)
        .single();

      if (productError || !product) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      // Crear el recordatorio
      const newReminder = {
        sku,
        product_description: product.descripcion,
        current_status: product.status,
        reminder_date,
        notes: notes || '',
        is_active: true,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('replenishment_reminders')
        .insert(newReminder)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    } catch (err) {
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'ID del recordatorio requerido' });
      }

      const { data, error } = await supabase
        .from('replenishment_reminders')
        .delete()
        .eq('id', id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Recordatorio no encontrado' });
      
      return res.status(200).json({ message: 'Recordatorio eliminado exitosamente' });
    } catch (err) {
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { id } = req.query;
      const { is_active } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'ID del recordatorio requerido' });
      }

      const { data, error } = await supabase
        .from('replenishment_reminders')
        .update({ is_active, activated_at: is_active ? null : new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Recordatorio no encontrado' });
      
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE', 'PATCH']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}