// pages/api/users/reset-passwords.js
import { supabase } from '../../../lib/supabaseClient';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        // Verificar si el usuario que hace la petición tiene permisos (opcional)
        // En este caso permitimos que cualquier usuario autenticado lo haga
        
        console.log('Iniciando reset de contraseñas...');

        // Actualizar todas las contraseñas a 123456
        const { data, error } = await supabase
            .from('users')
            .update({ password: '123456' })
            .select('id, email, name');

        if (error) {
            console.error('Error resetting passwords:', error);
            return res.status(500).json({ 
                error: 'Error al resetear contraseñas',
                details: error.message 
            });
        }

        console.log(`Contraseñas reseteadas para ${data?.length || 0} usuarios`);

        return res.status(200).json({
            message: 'Contraseñas reseteadas exitosamente',
            usersUpdated: data?.length || 0,
            users: data || []
        });

    } catch (error) {
        console.error('Error en reset-passwords:', error);
        return res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
}