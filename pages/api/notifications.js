require('dotenv').config();
const supabase = require('../../lib/supabase');

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { 
        limit = 20, 
        offset = 0, 
        type, 
        read,
        priority 
      } = req.query;

      let query = supabase
        .from('system_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      // Aplicar filtros
      if (type) query = query.eq('type', type);
      if (read !== undefined) query = query.eq('read', read === 'true');
      if (priority) query = query.eq('priority', priority);

      const { data: notifications, error } = await query;

      if (error) throw error;

      res.status(200).json({
        success: true,
        notifications: notifications || [],
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          count: notifications?.length || 0
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo notificaciones:', error);
      res.status(500).json({
        error: 'Error al obtener notificaciones',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  } 
  
  else if (req.method === 'PATCH') {
    try {
      const { ids, read = true } = req.body;

      if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ error: 'IDs de notificaciones requeridos' });
      }

      const { data, error } = await supabase
        .from('system_notifications')
        .update({ read: read })
        .in('id', ids);

      if (error) throw error;

      res.status(200).json({
        success: true,
        message: `${ids.length} notificaciones actualizadas`,
        updated_count: ids.length
      });

    } catch (error) {
      console.error('❌ Error actualizando notificaciones:', error);
      res.status(500).json({
        error: 'Error al actualizar notificaciones',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  else {
    res.status(405).json({ error: 'Método no permitido' });
  }
}