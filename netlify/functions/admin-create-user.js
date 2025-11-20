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

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: 'Email inválido'
          })
        };
      }

      // Invitar usuario por email - Supabase envía automáticamente el correo
      const { data: newUser, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
        email,
        {
          // URL a la que será redirigido después de aceptar la invitación
          redirectTo: `${process.env.URL || 'http://localhost:3000'}/auth/callback`
        }
      );

      if (inviteError) {
        // Si el usuario ya existe
        if (inviteError.message.includes('already registered')) {
          return {
            statusCode: 400,
            body: JSON.stringify({
              success: false,
              error: 'Este email ya está registrado'
            })
          };
        }
        throw inviteError;
      }

      // Asignar rol al usuario recién creado
      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: newUser.user.id,
        role_id: roleId,
        assigned_by: auth.userId
      });

      if (roleError) throw roleError;

      // Auditoría
      await audit.logCreate('user', newUser.user.id, {
        email,
        roleId,
        invited: true
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Invitación enviada exitosamente',
          user: {
            id: newUser.user.id,
            email: newUser.user.email,
            invited_at: newUser.user.invited_at
          }
        })
      };
    } catch (error) {
      console.error('[Admin Create User] Error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: error.message || 'Error al crear usuario'
        })
      };
    }
  })
);
