'use client';

/**
 * Componente para proteger páginas según roles permitidos
 */

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUserPermissions } from '@/hooks/usePermissions';
import { canAccessPage, getDefaultPage } from '@/lib/config/pagePermissions';
import type { RoleId } from '@/lib/types/permissions';

interface PageGuardProps {
  children: React.ReactNode;
  allowedRoles?: RoleId[]; // Si no se especifica, usa PAGE_PERMISSIONS
  fallback?: React.ReactNode;
  showDenied?: boolean;
}

/**
 * Componente que protege una página según los roles permitidos
 *
 * Si allowedRoles no se especifica, usa la configuración de PAGE_PERMISSIONS
 * basada en la ruta actual
 *
 * @example
 * // En una página:
 * export default function CotizacionesPage() {
 *   return (
 *     <PageGuard allowedRoles={['ADMIN', 'GERENTE', 'OPERADOR']}>
 *       <div>Contenido de cotizaciones</div>
 *     </PageGuard>
 *   );
 * }
 */
export function PageGuard({
  children,
  allowedRoles,
  fallback,
  showDenied = true
}: PageGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { roles, isLoading } = useUserPermissions();

  // Determinar si el usuario tiene acceso
  const hasAccess = React.useMemo(() => {
    if (isLoading) return false;

    // Si se especificaron roles permitidos, usarlos
    if (allowedRoles) {
      return allowedRoles.some(role => roles.includes(role));
    }

    // Si no, usar la configuración de PAGE_PERMISSIONS
    return canAccessPage(roles, pathname);
  }, [roles, pathname, allowedRoles, isLoading]);

  // Mostrar loading mientras se verifican permisos
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  // Si no tiene acceso, mostrar mensaje o redirigir
  if (!hasAccess) {
    if (showDenied) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Acceso Restringido
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                No tienes permisos para acceder a esta página
              </p>
              <button
                onClick={() => {
                  const defaultPage = getDefaultPage(roles);
                  router.push(defaultPage);
                }}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Ir a Inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (fallback) {
      return <>{fallback}</>;
    }

    // Redirigir automáticamente a la página por defecto
    React.useEffect(() => {
      const defaultPage = getDefaultPage(roles);
      router.push(defaultPage);
    }, [roles, router]);

    return null;
  }

  return <>{children}</>;
}
