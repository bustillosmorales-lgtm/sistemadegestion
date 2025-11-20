/**
 * Netlify Function: Eliminar usuario (Solo Admin)
 * DELETE /.netlify/functions/admin-delete-user
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
    if (event.httpMethod !== 'DELETE') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    const audit = Audit.logger(auth, event);

    try {
      const { userId } = JSON.parse(event.body || '{}');

      if (!userId) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: 'userId es requerido'
          })
        };
      }

      // Prevenir auto-eliminación
      if (userId === auth.userId) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: 'No puedes eliminar tu propia cuenta'
          })
        };
      }

      // Obtener info del usuario antes de eliminar (para auditoría)
      const { data: userToDelete } = await supabase.auth.admin.getUserById(userId);

      // Eliminar usuario
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

      if (deleteError) throw deleteError;

      // Auditoría
      await audit.logDelete('user', userId, {
        email: userToDelete?.user?.email,
        deletedBy: auth.userEmail
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Usuario eliminado exitosamente'
        })
      };
    } catch (error) {
      console.error('[Admin Delete User] Error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: error.message || 'Error al eliminar usuario'
        })
      };
    }
  })
);
