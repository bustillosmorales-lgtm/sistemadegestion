/**
 * Netlify Function: Actualizar roles de usuario (Solo Admin)
 * POST /.netlify/functions/admin-update-user-roles
 */

const { withAuth } = require('./lib/middleware');
const { Middleware, Audit } = require('../../lib/auth/permissions');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = withAuth(
  Middleware.adminOnly(async (event, context, auth) => {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    const audit = Audit.logger(auth, event);

    try {
      const { userId, roleIds } = JSON.parse(event.body || '{}');

      if (!userId || !Array.isArray(roleIds)) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: 'userId y roleIds (array) son requeridos'
          })
        };
      }

      // Obtener roles actuales
      const { data: currentRoles } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', userId);

      // Eliminar todos los roles actuales
      await supabase.from('user_roles').delete().eq('user_id', userId);

      // Insertar nuevos roles
      if (roleIds.length > 0) {
        const { error } = await supabase
          .from('user_roles')
          .insert(
            roleIds.map((role_id) => ({
              user_id: userId,
              role_id,
              assigned_by: auth.userId
            }))
          );

        if (error) throw error;
      }

      // Auditoría
      await audit.logUpdate('user', userId,
        { roles: (currentRoles || []).map(r => r.role_id) },
        { roles: roleIds }
      );

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true
        })
      };
    } catch (error) {
      console.error('[Admin Update User Roles] Error:', error);
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
