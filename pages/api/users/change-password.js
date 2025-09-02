// pages/api/users/change-password.js
import { supabase } from '../../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { userId, currentPassword, newPassword } = req.body;

  // Validar campos requeridos
  if (!userId || !currentPassword || !newPassword) {
    return res.status(400).json({ 
      error: 'Se requieren ID de usuario, contraseña actual y nueva contraseña' 
    });
  }

  // Validar longitud mínima de nueva contraseña
  if (newPassword.length < 6) {
    return res.status(400).json({ 
      error: 'La nueva contraseña debe tener al menos 6 caracteres' 
    });
  }

  try {
    // Obtener usuario actual
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, password')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar contraseña actual
    if (user.password !== currentPassword) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    // Actualizar contraseña
    const { data, error } = await supabase
      .from('users')
      .update({ password: newPassword })
      .eq('id', userId)
      .select('id, email, name, role');

    if (error) {
      console.error('Error updating password:', error);
      return res.status(500).json({ error: 'Error al actualizar la contraseña' });
    }

    return res.status(200).json({ 
      message: 'Contraseña actualizada correctamente',
      user: data[0]
    });

  } catch (error) {
    console.error('Error in change-password:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}