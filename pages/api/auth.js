// pages/api/auth.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const { type, codigo, email } = req.body;

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

        if (type === 'admin') {
            // Autenticación con código de admin
            if (!codigo) {
                return res.status(400).json({ error: 'Código de admin requerido' });
            }

            // Obtener código admin de la configuración
            const codigoAdmin = config?.codigoAdmin;
            
            if (!codigoAdmin) {
                return res.status(500).json({ error: 'Código de admin no configurado. Contacte al administrador.' });
            }

            if (codigo === codigoAdmin) {
                // Crear usuario admin temporal
                const tempAdminUser = {
                    id: 'admin-temp',
                    name: 'Administrador',
                    email: 'admin@sistema.local',
                    role: 'admin',
                    temporal: true
                };

                return res.status(200).json({
                    success: true,
                    user: tempAdminUser,
                    message: 'Acceso admin autorizado'
                });
            } else {
                return res.status(401).json({ error: 'Código de admin incorrecto' });
            }
        }

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
            // Autenticación directa de usuario
            if (!email) {
                return res.status(400).json({ error: 'Email requerido para acceso directo' });
            }

            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            if (error || !user) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            return res.status(200).json({
                success: true,
                user: user,
                message: 'Usuario autenticado correctamente'
            });
        }

        return res.status(400).json({ error: 'Tipo de autenticación no válido' });

    } catch (error) {
        console.error('Error en autenticación:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}