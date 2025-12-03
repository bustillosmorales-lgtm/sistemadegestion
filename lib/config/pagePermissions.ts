/**
 * Configuración de Permisos por Página
 * Define qué roles pueden acceder a cada página del sistema
 */

import type { RoleId } from '../types/permissions';

export interface PagePermission {
  path: string;
  label: string;
  roles: RoleId[];
  icon?: string;
}

/**
 * Configuración de permisos por página
 *
 * Resumen de permisos por rol:
 * - ADMIN: Acceso a todo
 * - GERENTE: Dashboard, Cotizaciones, Respondidas, Contenedores
 * - COMPRADOR: Dashboard, Respondidas, Contenedores
 * - OPERADOR: Cotizaciones, Contenedores
 */
export const PAGE_PERMISSIONS: PagePermission[] = [
  {
    path: '/',
    label: 'Dashboard',
    roles: ['ADMIN', 'GERENTE', 'COMPRADOR'],
    icon: '📊'
  },
  {
    path: '/cotizaciones',
    label: 'Cotizaciones',
    roles: ['ADMIN', 'GERENTE', 'OPERADOR'],
    icon: '📝'
  },
  {
    path: '/cotizaciones-respondidas',
    label: 'Respondidas',
    roles: ['ADMIN', 'GERENTE', 'COMPRADOR'],
    icon: '✅'
  },
  {
    path: '/contenedores',
    label: 'Contenedores',
    roles: ['ADMIN', 'GERENTE', 'COMPRADOR', 'OPERADOR'],
    icon: '📦'
  },
  {
    path: '/admin/usuarios',
    label: 'Usuarios',
    roles: ['ADMIN'],
    icon: '👥'
  },
];

/**
 * Verifica si un rol tiene acceso a una página específica
 */
export function canAccessPage(userRoles: RoleId[], pagePath: string): boolean {
  // Los admins pueden acceder a todo
  if (userRoles.includes('ADMIN')) {
    return true;
  }

  const pagePermission = PAGE_PERMISSIONS.find(p =>
    pagePath === p.path || pagePath.startsWith(p.path + '/')
  );

  if (!pagePermission) {
    // Si no hay configuración de permisos, denegar por defecto
    return false;
  }

  // Verificar si el usuario tiene alguno de los roles requeridos
  return pagePermission.roles.some(role => userRoles.includes(role));
}

/**
 * Obtiene las páginas a las que el usuario tiene acceso
 */
export function getAccessiblePages(userRoles: RoleId[]): PagePermission[] {
  return PAGE_PERMISSIONS.filter(page =>
    canAccessPage(userRoles, page.path)
  );
}

/**
 * Obtiene el primer path al que el usuario tiene acceso (para redirección)
 */
export function getDefaultPage(userRoles: RoleId[]): string {
  const accessiblePages = getAccessiblePages(userRoles);
  return accessiblePages[0]?.path || '/login';
}
