/**
 * Netlify Function: Reenviar invitación o enviar reset de contraseña (Solo Admin)
 * POST /.netlify/functions/admin-resend-invite
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
      const { email } = JSON.parse(event.body || '{}');

      if (!email) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: 'Email es requerido'
          })
        };
      }

      // Enviar email de recuperación de contraseña
      // Esto funciona tanto para usuarios que nunca activaron su cuenta
      // como para usuarios que ya están activos y olvidaron su contraseña
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${process.env.URL || 'http://localhost:3000'}/auth/callback`
        }
      );

      if (resetError) throw resetError;

      // Auditoría
      await audit.logAction('resend_invite', 'user', email, {
        sentBy: auth.userEmail
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Email de recuperación enviado exitosamente'
        })
      };
    } catch (error) {
      console.error('[Admin Resend Invite] Error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: error.message || 'Error al enviar email'
        })
      };
    }
  })
);
