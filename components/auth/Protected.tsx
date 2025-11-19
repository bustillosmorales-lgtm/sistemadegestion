/**
 * Componentes de Protección basados en Permisos
 * Controlan la visibilidad de elementos UI según permisos del usuario
 */

import React from 'react';
import { usePermission, useAnyPermission, useRole, useIsAdmin } from '@/hooks/usePermissions';
import type { PermissionId, RoleId } from '@/lib/types/permissions';

// =====================================================
// Componente: Protected (requiere permiso específico)
// =====================================================

interface ProtectedProps {
  permission: PermissionId;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showDenied?: boolean; // Mostrar mensaje de "sin permiso" en vez de ocultar
}

/**
 * Componente que solo muestra contenido si el usuario tiene el permiso
 *
 * @example
 * <Protected permission="cotizaciones.approve">
 *   <Button>Aprobar Cotización</Button>
 * </Protected>
 */
export function Protected({ permission, children, fallback = null, showDenied = false }: ProtectedProps) {
  const hasPermission = usePermission(permission);

  if (!hasPermission) {
    if (showDenied) {
      return (
        <div className="text-sm text-muted-foreground italic">
          No tienes permiso para ver este contenido
        </div>
      );
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// =====================================================
// Componente: ProtectedAny (requiere al menos un permiso)
// =====================================================

interface ProtectedAnyProps {
  permissions: PermissionId[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Componente que muestra contenido si el usuario tiene al menos uno de los permisos
 *
 * @example
 * <ProtectedAny permissions={["cotizaciones.edit", "cotizaciones.approve"]}>
 *   <Button>Modificar</Button>
 * </ProtectedAny>
 */
export function ProtectedAny({ permissions, children, fallback = null }: ProtectedAnyProps) {
  const hasAnyPermission = useAnyPermission(permissions);

  if (!hasAnyPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// =====================================================
// Componente: AdminOnly (solo para administradores)
// =====================================================

interface AdminOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showDenied?: boolean;
}

/**
 * Componente que solo muestra contenido si el usuario es Admin
 *
 * @example
 * <AdminOnly>
 *   <Link href="/admin/usuarios">Gestionar Usuarios</Link>
 * </AdminOnly>
 */
export function AdminOnly({ children, fallback = null, showDenied = false }: AdminOnlyProps) {
  const isAdmin = useIsAdmin();

  if (!isAdmin) {
    if (showDenied) {
      return (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">
            Acceso Restringido
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Solo administradores pueden acceder a esta sección
          </p>
        </div>
      );
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// =====================================================
// Componente: RoleRequired (requiere rol específico)
// =====================================================

interface RoleRequiredProps {
  role: RoleId;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Componente que solo muestra contenido si el usuario tiene el rol
 *
 * @example
 * <RoleRequired role="GERENTE">
 *   <Button>Aprobar</Button>
 * </RoleRequired>
 */
export function RoleRequired({ role, children, fallback = null }: RoleRequiredProps) {
  const hasRole = useRole(role);

  if (!hasRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// =====================================================
// Componente: PermissionGuard (con loading state)
// =====================================================

interface PermissionGuardProps {
  permission: PermissionId;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
}

/**
 * Componente Guard con estado de carga
 * Útil cuando necesitas esperar a que se carguen los permisos
 */
export function PermissionGuard({
  permission,
  children,
  fallback = null,
  loadingFallback = <div>Verificando permisos...</div>,
}: PermissionGuardProps) {
  const { permissions, isAdmin, isLoading } = useUserPermissions();

  if (isLoading) {
    return <>{loadingFallback}</>;
  }

  const hasPermission = isAdmin || permissions.includes(permission);

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// =====================================================
// HOC: withPermission (para componentes funcionales)
// =====================================================

/**
 * Higher Order Component que envuelve un componente con protección de permisos
 *
 * @example
 * const ProtectedButton = withPermission(Button, 'cotizaciones.approve');
 */
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  permission: PermissionId,
  fallback?: React.ReactNode
) {
  return function ProtectedComponent(props: P) {
    return (
      <Protected permission={permission} fallback={fallback}>
        <Component {...props} />
      </Protected>
    );
  };
}

/**
 * HOC que requiere que el usuario sea Admin
 */
export function withAdminOnly<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode
) {
  return function AdminProtectedComponent(props: P) {
    return (
      <AdminOnly fallback={fallback}>
        <Component {...props} />
      </AdminOnly>
    );
  };
}

// =====================================================
// Exportar todo
// =====================================================

import { useUserPermissions } from '@/hooks/usePermissions';

export const PermissionComponents = {
  Protected,
  ProtectedAny,
  AdminOnly,
  RoleRequired,
  PermissionGuard,
  withPermission,
  withAdminOnly,
};
