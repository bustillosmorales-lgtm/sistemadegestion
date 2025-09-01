// pages/api/users/[id].js
import { supabase } from '../../../lib/supabaseClient';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      if (!data) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { name, role, codigo_admin, codigo_sistema } = req.body;

      // Si es actualización de códigos de seguridad, solo permitir al usuario ID 1
      if (codigo_admin !== undefined || codigo_sistema !== undefined) {
        if (parseInt(id) !== 3) {
          return res.status(403).json({ error: 'Solo el administrador principal puede modificar los códigos de seguridad' });
        }

        const updateData = { updated_at: new Date().toISOString() };
        if (codigo_admin !== undefined) updateData.codigo_admin = codigo_admin;
        if (codigo_sistema !== undefined) updateData.codigo_sistema = codigo_sistema;

        const { data, error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', id)
          .select();

        if (error) {
          return res.status(500).json({ error: error.message });
        }

        if (!data || data.length === 0) {
          return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        return res.status(200).json(data[0]);
      }

      // Actualización normal de usuario
      if (!name || !role) {
        return res.status(400).json({ error: 'Nombre y rol son requeridos' });
      }

      const { data, error } = await supabase
        .from('users')
        .update({ 
          name: name,
          role: role,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      if (!data || data.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      return res.status(200).json(data[0]);
    } catch (error) {
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      // Verificar que no sea un usuario admin
      const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('id', id)
        .single();

      if (user && user.role === 'admin') {
        return res.status(403).json({ error: 'No se puede eliminar el usuario administrador' });
      }

      const { data, error } = await supabase
        .from('users')
        .delete()
        .eq('id', id)
        .select();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      if (!data || data.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      return res.status(200).json({ message: 'Usuario eliminado exitosamente' });
    } catch (error) {
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}