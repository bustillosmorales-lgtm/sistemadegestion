/**
 * Sistema de Permisos - Autorización y Auditoría
 * Uso en funciones Netlify y frontend
 */

import { createClient } from '@supabase/supabase-js';
import type {
  PermissionId,
  RoleId,
  CreateAuditLogParams,
  AuditAction,
  AuditResource,
} from '../types/permissions';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// =====================================================
// Verificación de Permisos
// =====================================================

/**
 * Verifica si un usuario tiene un permiso específico
 * Usa la función SQL has_permission que considera:
 * 1. Si es ADMIN → siempre tiene permiso
 * 2. Permisos custom (overrides)
 * 3. Permisos del rol
 */
export async function checkPermission(
  userId: string,
  permissionId: PermissionId
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('has_permission', {
      user_id_param: userId,
      permission_id_param: permissionId,
    });

    if (error) {
      console.error('[Permissions] Error checking permission:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('[Permissions] Exception checking permission:', error);
    return false;
  }
}

/**
 * Obtiene todos los permisos de un usuario
 */
export async function getUserPermissions(
  userId: string
): Promise<PermissionId[]> {
  try {
    const { data, error } = await supabase.rpc('get_user_permissions', {
      user_id_param: userId,
    });

    if (error) {
      console.error('[Permissions] Error getting user permissions:', error);
      return [];
    }

    return (data || []).map((p: any) => p.permission_id);
  } catch (error) {
    console.error('[Permissions] Exception getting user permissions:', error);
    return [];
  }
}

/**
 * Verifica si un usuario tiene alguno de los permisos especificados
 */
export async function checkAnyPermission(
  userId: string,
  permissionIds: PermissionId[]
): Promise<boolean> {
  for (const permissionId of permissionIds) {
    const hasPermission = await checkPermission(userId, permissionId);
    if (hasPermission) return true;
  }
  return false;
}

/**
 * Verifica si un usuario tiene todos los permisos especificados
 */
export async function checkAllPermissions(
  userId: string,
  permissionIds: PermissionId[]
): Promise<boolean> {
  for (const permissionId of permissionIds) {
    const hasPermission = await checkPermission(userId, permissionId);
    if (!hasPermission) return false;
  }
  return true;
}

/**
 * Obtiene los roles de un usuario
 */
export async function getUserRoles(userId: string): Promise<RoleId[]> {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', userId);

    if (error) {
      console.error('[Permissions] Error getting user roles:', error);
      return [];
    }

    return (data || []).map((r) => r.role_id);
  } catch (error) {
    console.error('[Permissions] Exception getting user roles:', error);
    return [];
  }
}

/**
 * Verifica si un usuario tiene un rol específico
 */
export async function hasRole(userId: string, roleId: RoleId): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.includes(roleId);
}

/**
 * Verifica si un usuario es Admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  return hasRole(userId, 'ADMIN');
}

// =====================================================
// Auditoría
// =====================================================

/**
 * Registra una acción en el log de auditoría
 */
export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    const { error } = await supabase.from('audit_log').insert({
      user_id: params.user_id,
      user_email: params.user_email,
      action: params.action,
      resource: params.resource,
      resource_id: params.resource_id || null,
      old_value: params.old_value || null,
      new_value: params.new_value || null,
      metadata: params.metadata || null,
      ip_address: params.ip_address || null,
      user_agent: params.user_agent || null,
    });

    if (error) {
      console.error('[Audit] Error creating audit log:', error);
    }
  } catch (error) {
    console.error('[Audit] Exception creating audit log:', error);
  }
}

/**
 * Helper para extraer IP y User-Agent de event de Netlify
 */
export function extractRequestInfo(event: any): {
  ip_address: string | null;
  user_agent: string | null;
} {
  return {
    ip_address: event.headers['x-forwarded-for'] || event.headers['client-ip'] || null,
    user_agent: event.headers['user-agent'] || null,
  };
}

// =====================================================
// Middleware de Autorización para Netlify Functions
// =====================================================

interface AuthContext {
  userId: string;
  userEmail: string;
}

/**
 * Middleware que requiere un permiso específico
 * Uso: exports.handler = withPermission('cotizaciones.approve', async (event, context, auth) => { ... })
 */
export function withPermission(
  permissionId: PermissionId,
  handler: (
    event: any,
    context: any,
    auth: AuthContext
  ) => Promise<{ statusCode: number; body: string }>
) {
  return async (event: any, context: any, authContext: AuthContext) => {
    const { userId, userEmail } = authContext;

    // Verificar permiso
    const hasPermission = await checkPermission(userId, permissionId);

    if (!hasPermission) {
      // Registrar intento de acceso no autorizado
      const requestInfo = extractRequestInfo(event);
      await createAuditLog({
        user_id: userId,
        user_email: userEmail,
        action: 'view_sensitive',
        resource: 'system',
        metadata: {
          permission_required: permissionId,
          access_denied: true,
          path: event.path,
        },
        ...requestInfo,
      });

      return {
        statusCode: 403,
        body: JSON.stringify({
          error: 'Forbidden',
          message: `No tienes permiso para realizar esta acción. Permiso requerido: ${permissionId}`,
        }),
      };
    }

    // Usuario tiene permiso, ejecutar handler
    return handler(event, context, authContext);
  };
}

/**
 * Middleware que requiere al menos uno de los permisos especificados
 */
export function withAnyPermission(
  permissionIds: PermissionId[],
  handler: (event: any, context: any, auth: AuthContext) => Promise<any>
) {
  return async (event: any, context: any, authContext: AuthContext) => {
    const { userId, userEmail } = authContext;

    const hasAnyPermission = await checkAnyPermission(userId, permissionIds);

    if (!hasAnyPermission) {
      const requestInfo = extractRequestInfo(event);
      await createAuditLog({
        user_id: userId,
        user_email: userEmail,
        action: 'view_sensitive',
        resource: 'system',
        metadata: {
          permissions_required: permissionIds,
          access_denied: true,
          path: event.path,
        },
        ...requestInfo,
      });

      return {
        statusCode: 403,
        body: JSON.stringify({
          error: 'Forbidden',
          message: `No tienes ninguno de los permisos requeridos: ${permissionIds.join(', ')}`,
        }),
      };
    }

    return handler(event, context, authContext);
  };
}

/**
 * Middleware que requiere un rol específico
 */
export function withRole(
  roleId: RoleId,
  handler: (event: any, context: any, auth: AuthContext) => Promise<any>
) {
  return async (event: any, context: any, authContext: AuthContext) => {
    const { userId, userEmail } = authContext;

    const userHasRole = await hasRole(userId, roleId);

    if (!userHasRole) {
      const requestInfo = extractRequestInfo(event);
      await createAuditLog({
        user_id: userId,
        user_email: userEmail,
        action: 'view_sensitive',
        resource: 'system',
        metadata: {
          role_required: roleId,
          access_denied: true,
          path: event.path,
        },
        ...requestInfo,
      });

      return {
        statusCode: 403,
        body: JSON.stringify({
          error: 'Forbidden',
          message: `Esta acción requiere el rol: ${roleId}`,
        }),
      };
    }

    return handler(event, context, authContext);
  };
}

/**
 * Middleware que solo permite admins
 */
export function adminOnly(
  handler: (event: any, context: any, auth: AuthContext) => Promise<any>
) {
  return withRole('ADMIN', handler);
}

// =====================================================
// Helpers para Auditoría en Handlers
// =====================================================

/**
 * Crea un logger de auditoría pre-configurado para un handler
 */
export function createAuditLogger(auth: AuthContext, event: any) {
  const requestInfo = extractRequestInfo(event);

  return {
    log: async (
      action: AuditAction,
      resource: AuditResource,
      resourceId?: string,
      metadata?: Record<string, any>
    ) => {
      await createAuditLog({
        user_id: auth.userId,
        user_email: auth.userEmail,
        action,
        resource,
        resource_id: resourceId,
        metadata,
        ...requestInfo,
      });
    },

    logCreate: async (resource: AuditResource, resourceId: string, newValue: any) => {
      await createAuditLog({
        user_id: auth.userId,
        user_email: auth.userEmail,
        action: 'create',
        resource,
        resource_id: resourceId,
        new_value: newValue,
        ...requestInfo,
      });
    },

    logUpdate: async (
      resource: AuditResource,
      resourceId: string,
      oldValue: any,
      newValue: any
    ) => {
      await createAuditLog({
        user_id: auth.userId,
        user_email: auth.userEmail,
        action: 'update',
        resource,
        resource_id: resourceId,
        old_value: oldValue,
        new_value: newValue,
        ...requestInfo,
      });
    },

    logDelete: async (resource: AuditResource, resourceId: string, oldValue: any) => {
      await createAuditLog({
        user_id: auth.userId,
        user_email: auth.userEmail,
        action: 'delete',
        resource,
        resource_id: resourceId,
        old_value: oldValue,
        ...requestInfo,
      });
    },

    logApprove: async (resource: AuditResource, resourceId: string, metadata?: any) => {
      await createAuditLog({
        user_id: auth.userId,
        user_email: auth.userEmail,
        action: 'approve',
        resource,
        resource_id: resourceId,
        metadata,
        ...requestInfo,
      });
    },
  };
}

// =====================================================
// Exportar todo junto
// =====================================================

export const Permissions = {
  check: checkPermission,
  checkAny: checkAnyPermission,
  checkAll: checkAllPermissions,
  getUserPermissions,
  getUserRoles,
  hasRole,
  isAdmin,
};

export const Audit = {
  log: createAuditLog,
  logger: createAuditLogger,
};

export const Middleware = {
  withPermission,
  withAnyPermission,
  withRole,
  adminOnly,
};
