/**
 * Sistema de Roles y Permisos - Tipos TypeScript
 */

// =====================================================
// Roles
// =====================================================

export type RoleId =
  | 'ADMIN'
  | 'GERENTE'
  | 'OPERADOR'
  | 'VIEWER'
  | 'COTIZACIONES_MANAGER'
  | 'RESPONDIDAS_MANAGER';

export interface Role {
  id: RoleId;
  name: string;
  description: string;
  created_at: string;
}

// =====================================================
// Permisos
// =====================================================

export type ResourceType =
  | 'config'
  | 'users'
  | 'cotizaciones'
  | 'predicciones'
  | 'dashboard'
  | 'contenedores'
  | 'inventario'
  | 'ventas'
  | 'audit'
  | 'reportes';

export type ActionType =
  | 'view'
  | 'create'
  | 'edit'
  | 'approve'
  | 'delete'
  | 'execute'
  | 'import'
  | 'export'
  | 'cotizaciones'
  | 'respondidas';

export type PermissionId = `${ResourceType}.${ActionType}`;

export interface Permission {
  id: PermissionId;
  resource: ResourceType;
  action: ActionType;
  description: string;
  created_at: string;
}

// =====================================================
// Constantes de Permisos (para type-safety)
// =====================================================

export const PERMISSIONS = {
  // Configuración
  CONFIG_VIEW: 'config.view' as const,
  CONFIG_EDIT: 'config.edit' as const,

  // Usuarios
  USERS_VIEW: 'users.view' as const,
  USERS_CREATE: 'users.create' as const,
  USERS_EDIT: 'users.edit' as const,
  USERS_DELETE: 'users.delete' as const,

  // Cotizaciones
  COTIZACIONES_VIEW: 'cotizaciones.view' as const,
  COTIZACIONES_CREATE: 'cotizaciones.create' as const,
  COTIZACIONES_EDIT: 'cotizaciones.edit' as const,
  COTIZACIONES_APPROVE: 'cotizaciones.approve' as const,
  COTIZACIONES_DELETE: 'cotizaciones.delete' as const,

  // Predicciones
  PREDICCIONES_VIEW: 'predicciones.view' as const,
  PREDICCIONES_EDIT: 'predicciones.edit' as const,
  PREDICCIONES_EXECUTE: 'predicciones.execute' as const,

  // Dashboards
  DASHBOARD_VIEW: 'dashboard.view' as const,
  DASHBOARD_COTIZACIONES: 'dashboard.cotizaciones' as const,
  DASHBOARD_RESPONDIDAS: 'dashboard.respondidas' as const,

  // Contenedores
  CONTENEDORES_VIEW: 'contenedores.view' as const,
  CONTENEDORES_CREATE: 'contenedores.create' as const,
  CONTENEDORES_EDIT: 'contenedores.edit' as const,
  CONTENEDORES_DELETE: 'contenedores.delete' as const,

  // Inventario
  INVENTARIO_VIEW: 'inventario.view' as const,
  INVENTARIO_EDIT: 'inventario.edit' as const,

  // Ventas
  VENTAS_VIEW: 'ventas.view' as const,
  VENTAS_IMPORT: 'ventas.import' as const,

  // Auditoría
  AUDIT_VIEW: 'audit.view' as const,

  // Reportes
  REPORTES_VIEW: 'reportes.view' as const,
  REPORTES_EXPORT: 'reportes.export' as const,
} as const;

// =====================================================
// Relaciones
// =====================================================

export interface RolePermission {
  role_id: RoleId;
  permission_id: PermissionId;
}

export interface UserRole {
  user_id: string;
  role_id: RoleId;
  assigned_at: string;
  assigned_by: string | null;
}

export interface UserCustomPermission {
  user_id: string;
  permission_id: PermissionId;
  granted: boolean;
  assigned_at: string;
  assigned_by: string | null;
}

// =====================================================
// Auditoría
// =====================================================

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'view_sensitive'
  | 'export'
  | 'import'
  | 'login'
  | 'logout'
  | 'config_change'
  | 'role_assign'
  | 'permission_grant'
  | 'migration';

export type AuditResource =
  | 'cotizacion'
  | 'prediccion'
  | 'config'
  | 'user'
  | 'role'
  | 'permission'
  | 'contenedor'
  | 'inventario'
  | 'venta'
  | 'system';

export interface AuditLog {
  id: number;
  user_id: string | null;
  user_email: string | null;
  action: AuditAction;
  resource: AuditResource;
  resource_id: string | null;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  metadata: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// =====================================================
// DTOs y Helpers
// =====================================================

export interface UserWithRoles {
  id: string;
  email: string;
  roles: RoleId[];
  custom_permissions: UserCustomPermission[];
  created_at: string;
  last_sign_in_at: string | null;
}

export interface PermissionCheck {
  user_id: string;
  permission_id: PermissionId;
  granted: boolean;
  source: 'role' | 'custom' | 'admin';
}

export interface CreateAuditLogParams {
  user_id: string;
  user_email: string;
  action: AuditAction;
  resource: AuditResource;
  resource_id?: string;
  old_value?: Record<string, any>;
  new_value?: Record<string, any>;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

// =====================================================
// Mapeo de Roles a Nombres en Español
// =====================================================

export const ROLE_NAMES: Record<RoleId, string> = {
  ADMIN: 'Administrador',
  GERENTE: 'Gerente',
  OPERADOR: 'Operador/Vendedor',
  VIEWER: 'Solo Lectura',
  COTIZACIONES_MANAGER: 'Gestor de Cotizaciones',
  RESPONDIDAS_MANAGER: 'Gestor de Respondidas',
};

// =====================================================
// Mapeo de Recursos a Nombres en Español
// =====================================================

export const RESOURCE_NAMES: Record<ResourceType, string> = {
  config: 'Configuración',
  users: 'Usuarios',
  cotizaciones: 'Cotizaciones',
  predicciones: 'Predicciones',
  dashboard: 'Dashboard',
  contenedores: 'Contenedores',
  inventario: 'Inventario',
  ventas: 'Ventas',
  audit: 'Auditoría',
  reportes: 'Reportes',
};

// =====================================================
// Mapeo de Acciones a Nombres en Español
// =====================================================

export const ACTION_NAMES: Record<string, string> = {
  view: 'Ver',
  create: 'Crear',
  edit: 'Editar',
  approve: 'Aprobar',
  delete: 'Eliminar',
  execute: 'Ejecutar',
  import: 'Importar',
  export: 'Exportar',
  cotizaciones: 'Cotizaciones',
  respondidas: 'Respondidas',
};

// =====================================================
// Helper Functions
// =====================================================

export function formatPermissionName(permissionId: PermissionId): string {
  const [resource, action] = permissionId.split('.') as [ResourceType, ActionType];
  return `${ACTION_NAMES[action] || action} ${RESOURCE_NAMES[resource] || resource}`;
}

export function formatAuditAction(action: AuditAction): string {
  const actionMap: Record<AuditAction, string> = {
    create: 'Crear',
    update: 'Actualizar',
    delete: 'Eliminar',
    approve: 'Aprobar',
    reject: 'Rechazar',
    view_sensitive: 'Ver información sensible',
    export: 'Exportar',
    import: 'Importar',
    login: 'Iniciar sesión',
    logout: 'Cerrar sesión',
    config_change: 'Cambio de configuración',
    role_assign: 'Asignar rol',
    permission_grant: 'Conceder permiso',
    migration: 'Migración',
  };
  return actionMap[action] || action;
}

export function formatAuditResource(resource: AuditResource): string {
  const resourceMap: Record<AuditResource, string> = {
    cotizacion: 'Cotización',
    prediccion: 'Predicción',
    config: 'Configuración',
    user: 'Usuario',
    role: 'Rol',
    permission: 'Permiso',
    contenedor: 'Contenedor',
    inventario: 'Inventario',
    venta: 'Venta',
    system: 'Sistema',
  };
  return resourceMap[resource] || resource;
}
