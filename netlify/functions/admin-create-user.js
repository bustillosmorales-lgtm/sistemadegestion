/**
 * Netlify Function: Crear usuario (Solo Admin)
 * POST /.netlify/functions/admin-create-user
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
      const { email, roleId } = JSON.parse(event.body || '{}');

      if (!email || !roleId) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: 'Email y roleId son requeridos'
          })
        };
      }

      // Crear usuario
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
      });

      if (createError) throw createError;

      // Asignar rol
      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: newUser.user.id,
        role_id: roleId,
        assigned_by: auth.userId
      });

      if (roleError) throw roleError;

      // Auditoría
      await audit.logCreate('user', newUser.user.id, { email, roleId });

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          user: {
            id: newUser.user.id,
            email: newUser.user.email
          }
        })
      };
    } catch (error) {
      console.error('[Admin Create User] Error:', error);
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
