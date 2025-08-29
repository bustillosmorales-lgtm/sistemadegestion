// pages/api/users.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
   if (req.method === 'GET') {
       const { data, error } = await supabase.from('users').select('*');
       if (error) {
           console.error('Error GET users:', error);
           return res.status(500).json({ error: error.message });
       }
       return res.status(200).json(data);
   }

   if (req.method === 'POST') {
       const { email, role, name } = req.body;
       
       // Validar campos requeridos
       if (!email || !role) {
           return res.status(400).json({ error: 'Faltan el correo y el rol.' });
       }

       // Verificar si el usuario ya existe
       const { data: existingUser, error: checkError } = await supabase
           .from('users')
           .select('email')
           .eq('email', email)
           .single();
           
       if (checkError && checkError.code !== 'PGRST116') {
           // PGRST116 = "not found", que es lo que esperamos si no existe
           console.error('Error checking existing user:', checkError);
           return res.status(500).json({ error: checkError.message });
       }
           
       if (existingUser) {
           return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
       }

       // Crear nuevo usuario (SIN el campo id, se auto-genera)
       const newUser = {
           email,
           role,
           name: name || `Usuario ${role} (${email.split('@')[0]})`
       };

       const { data, error } = await supabase
           .from('users')
           .insert(newUser)
           .select();
           
       if (error) {
           console.error('Error POST users:', error);
           return res.status(500).json({ error: error.message });
       }
       
       return res.status(201).json(data[0]);
   }

   if (req.method === 'PUT') {
       const { id, email, role, name } = req.body;
       
       if (!id) {
           return res.status(400).json({ error: 'ID es requerido para actualizar.' });
       }

       const updates = {};
       if (email) updates.email = email;
       if (role) updates.role = role;
       if (name) updates.name = name;

       const { data, error } = await supabase
           .from('users')
           .update(updates)
           .eq('id', id)
           .select();

       if (error) {
           console.error('Error PUT users:', error);
           return res.status(500).json({ error: error.message });
       }

       if (data.length === 0) {
           return res.status(404).json({ error: 'Usuario no encontrado.' });
       }

       return res.status(200).json(data[0]);
   }

   if (req.method === 'DELETE') {
       const { id } = req.body;
       
       if (!id) {
           return res.status(400).json({ error: 'ID es requerido para eliminar.' });
       }

       const { data, error } = await supabase
           .from('users')
           .delete()
           .eq('id', id)
           .select();

       if (error) {
           console.error('Error DELETE users:', error);
           return res.status(500).json({ error: error.message });
       }

       if (data.length === 0) {
           return res.status(404).json({ error: 'Usuario no encontrado.' });
       }

       return res.status(200).json({ message: 'Usuario eliminado correctamente.' });
   }

   res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
   res.status(405).end(`Method ${req.method} Not Allowed`);
}