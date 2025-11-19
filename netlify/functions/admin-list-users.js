/**
 * Netlify Function: Listar usuarios (Solo Admin)
 * GET /.netlify/functions/admin-list-users
 */

const { withAuth } = require('./lib/middleware');
const { Middleware } = require('../../lib/auth/permissions');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = withAuth(
  Middleware.adminOnly(async (event, context, auth) => {
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    try {
      // Obtener todos los usuarios
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

      if (authError) throw authError;

      // Obtener roles de cada usuario
      const usersWithRoles = await Promise.all(
        (authData.users || []).map(async (user) => {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role_id')
            .eq('user_id', user.id);

          return {
            id: user.id,
            email: user.email || '',
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at,
            roles: roles || [],
          };
        })
      );

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          users: usersWithRoles
        })
      };
    } catch (error) {
      console.error('[Admin List Users] Error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: error.message
        })
      };
    }
  })
);
