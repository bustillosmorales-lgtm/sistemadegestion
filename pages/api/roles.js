// pages/api/roles.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('custom_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json(data || []);
    } catch (error) {
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, permissions } = req.body;

      if (!name || !permissions) {
        return res.status(400).json({ error: 'Nombre y permisos son requeridos' });
      }

      // Verificar que el nombre del rol no exista ya
      const { data: existingRole } = await supabase
        .from('custom_roles')
        .select('name')
        .eq('name', name.toLowerCase())
        .single();

      if (existingRole) {
        return res.status(400).json({ error: 'Ya existe un rol con ese nombre' });
      }

      // Verificar que no sea un rol del sistema
      const systemRoles = ['admin', 'chile', 'china'];
      if (systemRoles.includes(name.toLowerCase())) {
        return res.status(400).json({ error: 'No se puede crear un rol con nombre del sistema' });
      }

      const newRole = {
        name: name.toLowerCase(),
        display_name: name,
        permissions: permissions,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('custom_roles')
        .insert(newRole)
        .select();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(201).json(data[0]);
    } catch (error) {
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}