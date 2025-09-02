// pages/api/auth.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const { type, codigo, email, password } = req.body;

    if (!type) {
        return res.status(400).json({ error: 'Tipo de autenticación requerido' });
    }

    try {
        // Obtener configuración
        const { data: configData } = await supabase
            .from('configuration')
            .select('data')
            .eq('id', 3)
            .single();

        const config = configData?.data || {};


        if (type === 'sistema') {
            // Autenticación con código del sistema
            if (!codigo) {
                return res.status(400).json({ error: 'Código del sistema requerido' });
            }

            // Obtener código del sistema de la configuración
            const codigoSistema = config?.codigoSistema || '987654'; // Fallback al código original
            
            if (codigo === codigoSistema) {
                return res.status(200).json({
                    success: true,
                    requiresUserSelection: true,
                    message: 'Acceso al sistema autorizado'
                });
            } else {
                return res.status(401).json({ error: 'Código del sistema incorrecto' });
            }
        }

        if (type === 'usuario') {
            // Autenticación directa de usuario con email y contraseña
            if (!email || !password) {
                return res.status(400).json({ error: 'Email y contraseña requeridos' });
            }

            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            if (error || !user) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            // Verificar contraseña
            if (user.password !== password) {
                return res.status(401).json({ error: 'Contraseña incorrecta' });
            }

            // No devolver la contraseña en la respuesta
            const { password: _, ...userWithoutPassword } = user;

            return res.status(200).json({
                success: true,
                user: userWithoutPassword,
                message: 'Usuario autenticado correctamente'
            });
        }

        return res.status(400).json({ error: 'Tipo de autenticación no válido' });

    } catch (error) {
        console.error('Error en autenticación:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}