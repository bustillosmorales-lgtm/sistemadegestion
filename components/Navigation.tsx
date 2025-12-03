'use client';

/**
 * Componente de Navegación Principal
 * Muestra solo los links a los que el usuario tiene acceso según su rol
 */

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useUserPermissions } from '@/hooks/usePermissions';
import { getAccessiblePages } from '@/lib/config/pagePermissions';

export function Navigation() {
  const pathname = usePathname();
  const { roles, isLoading } = useUserPermissions();

  // Obtener páginas accesibles para el usuario
  const accessiblePages = getAccessiblePages(roles);

  // Filtrar páginas de navegación (excluir rutas administrativas del nav principal)
  const navPages = accessiblePages.filter(page =>
    !page.path.startsWith('/admin/')
  );

  if (isLoading) {
    return (
      <nav className="flex gap-4">
        <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
        <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
      </nav>
    );
  }

  return (
    <nav className="flex gap-4">
      {navPages.map((page) => {
        const isActive = pathname === page.path;

        return (
          <Link
            key={page.path}
            href={page.path}
            className={`
              text-sm font-medium transition-colors
              ${isActive
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-700 hover:text-blue-600'
              }
            `}
          >
            {page.icon && `${page.icon} `}{page.label}
          </Link>
        );
      })}
    </nav>
  );
}
