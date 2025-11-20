/**
 * React Hooks para Sistema de Permisos
 * Verifica permisos del usuario actual en la UI
 */

import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/lib/SupabaseProvider';
import type { PermissionId, RoleId } from '@/lib/types/permissions';

// =====================================================
// Hook: Obtener permisos del usuario actual
// =====================================================

interface UserPermissionsData {
  permissions: PermissionId[];
  roles: RoleId[];
  isAdmin: boolean;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook para obtener todos los permisos y roles del usuario actual
 */
export function useUserPermissions(): UserPermissionsData {
  const { client, user } = useSupabase();

  const { data, isLoading, error } = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      // Obtener roles del usuario usando RPC (evita problema de RLS circular)
      const { data: userRoles, error: rolesError } = await client.rpc(
        'get_user_roles',
        { user_id_param: user.id }
      );

      if (rolesError) throw rolesError;

      const roles = (userRoles || []).map((r: any) => r.role_id as RoleId);
      const isAdmin = roles.includes('ADMIN');

      // Obtener permisos usando la función SQL
      const { data: permissions, error: permsError } = await client.rpc(
        'get_user_permissions',
        { user_id_param: user.id }
      );

      if (permsError) throw permsError;

      return {
        permissions: (permissions || []).map((p: any) => p.permission_id as PermissionId),
        roles,
        isAdmin,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    gcTime: 10 * 60 * 1000,
  });

  return {
    permissions: data?.permissions || [],
    roles: data?.roles || [],
    isAdmin: data?.isAdmin || false,
    isLoading,
    error: error as Error | null,
  };
}

// =====================================================
// Hook: Verificar permiso específico
// =====================================================

/**
 * Hook para verificar si el usuario tiene un permiso específico
 * @param permissionId - ID del permiso a verificar
 * @returns boolean - true si tiene el permiso
 */
export function usePermission(permissionId: PermissionId): boolean {
  const { permissions, isAdmin } = useUserPermissions();

  // Admins tienen todos los permisos
  if (isAdmin) return true;

  return permissions.includes(permissionId);
}

/**
 * Hook para verificar si el usuario tiene al menos uno de los permisos
 * @param permissionIds - Array de IDs de permisos
 * @returns boolean - true si tiene al menos uno
 */
export function useAnyPermission(permissionIds: PermissionId[]): boolean {
  const { permissions, isAdmin } = useUserPermissions();

  if (isAdmin) return true;

  return permissionIds.some((p) => permissions.includes(p));
}

/**
 * Hook para verificar si el usuario tiene todos los permisos
 * @param permissionIds - Array de IDs de permisos
 * @returns boolean - true si tiene todos
 */
export function useAllPermissions(permissionIds: PermissionId[]): boolean {
  const { permissions, isAdmin } = useUserPermissions();

  if (isAdmin) return true;

  return permissionIds.every((p) => permissions.includes(p));
}

// =====================================================
// Hook: Verificar rol específico
// =====================================================

/**
 * Hook para verificar si el usuario tiene un rol específico
 * @param roleId - ID del rol a verificar
 * @returns boolean - true si tiene el rol
 */
export function useRole(roleId: RoleId): boolean {
  const { roles } = useUserPermissions();
  return roles.includes(roleId);
}

/**
 * Hook para verificar si el usuario es Admin
 * @returns boolean - true si es Admin
 */
export function useIsAdmin(): boolean {
  const { isAdmin } = useUserPermissions();
  return isAdmin;
}

// =====================================================
// Hook: Obtener función de verificación
// =====================================================

/**
 * Hook que retorna una función para verificar permisos
 * Útil cuando necesitas verificar múltiples permisos dinámicamente
 */
export function usePermissionChecker() {
  const { permissions, isAdmin } = useUserPermissions();

  return {
    hasPermission: (permissionId: PermissionId) => {
      if (isAdmin) return true;
      return permissions.includes(permissionId);
    },
    hasAnyPermission: (permissionIds: PermissionId[]) => {
      if (isAdmin) return true;
      return permissionIds.some((p) => permissions.includes(p));
    },
    hasAllPermissions: (permissionIds: PermissionId[]) => {
      if (isAdmin) return true;
      return permissionIds.every((p) => permissions.includes(p));
    },
    isAdmin,
  };
}

// =====================================================
// Hook: Auditoría de acciones del usuario
// =====================================================

interface UseAuditOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook para registrar acciones en el audit log
 */
export function useAudit(options?: UseAuditOptions) {
  const { client, user } = useSupabase();

  const logAction = async (
    action: string,
    resource: string,
    resourceId?: string,
    metadata?: Record<string, any>
  ) => {
    if (!user) {
      console.warn('[Audit] Cannot log action: user not authenticated');
      return;
    }

    try {
      const { error } = await client.from('audit_log').insert({
        user_id: user.id,
        user_email: user.email,
        action,
        resource,
        resource_id: resourceId || null,
        metadata: metadata || null,
      });

      if (error) {
        console.error('[Audit] Error logging action:', error);
        options?.onError?.(error as Error);
      } else {
        options?.onSuccess?.();
      }
    } catch (error) {
      console.error('[Audit] Exception logging action:', error);
      options?.onError?.(error as Error);
    }
  };

  return {
    logAction,
    logCreate: (resource: string, resourceId: string, newValue: any) =>
      logAction('create', resource, resourceId, { new_value: newValue }),
    logUpdate: (resource: string, resourceId: string, oldValue: any, newValue: any) =>
      logAction('update', resource, resourceId, { old_value: oldValue, new_value: newValue }),
    logDelete: (resource: string, resourceId: string, oldValue: any) =>
      logAction('delete', resource, resourceId, { old_value: oldValue }),
    logApprove: (resource: string, resourceId: string, metadata?: any) =>
      logAction('approve', resource, resourceId, metadata),
    logView: (resource: string, resourceId?: string) =>
      logAction('view_sensitive', resource, resourceId),
  };
}

// =====================================================
// Re-exportar todo
// =====================================================

export const PermissionHooks = {
  useUserPermissions,
  usePermission,
  useAnyPermission,
  useAllPermissions,
  useRole,
  useIsAdmin,
  usePermissionChecker,
  useAudit,
};
