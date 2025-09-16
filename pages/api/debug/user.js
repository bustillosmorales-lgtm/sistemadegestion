import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    // Obtener el token de la cookie o header
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Decodificar el token sin verificar para ver su contenido
    const decodedToken = jwt.decode(token);
    
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // Buscar el usuario en la base de datos
    const { data: userData, error: userError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('correo', decodedToken.correo)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      console.error('Error buscando usuario:', userError);
      return res.status(500).json({ error: 'Error buscando usuario', details: userError.message });
    }

    return res.status(200).json({
      success: true,
      token_data: {
        correo: decodedToken.correo,
        role: decodedToken.role,
        rol: decodedToken.rol,
        pais: decodedToken.pais,
        all_token_properties: decodedToken
      },
      database_user: userData || null,
      debug: {
        token_exists: !!token,
        token_decoded: !!decodedToken,
        user_found_in_db: !!userData
      }
    });

  } catch (error) {
    console.error('Error en debug user:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message,
      stack: error.stack
    });
  }
}