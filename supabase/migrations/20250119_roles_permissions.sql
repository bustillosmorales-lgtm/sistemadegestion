-- =====================================================
-- Sistema de Roles y Permisos con Auditoría Completa
-- =====================================================

-- 1. Tabla de Roles
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Tabla de Permisos
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  resource TEXT NOT NULL,  -- 'cotizaciones', 'predicciones', 'config', etc.
  action TEXT NOT NULL,    -- 'view', 'create', 'edit', 'approve', 'delete'
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(resource, action)
);

-- 3. Relación Roles-Permisos (permisos base de cada rol)
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 4. Usuarios con Roles
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  PRIMARY KEY (user_id, role_id)
);

-- 5. Permisos Personalizados por Usuario (overrides)
CREATE TABLE IF NOT EXISTS user_custom_permissions (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_id TEXT REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL,  -- true = conceder, false = revocar
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  PRIMARY KEY (user_id, permission_id)
);

-- 6. Tabla de Auditoría Completa
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,  -- Guardar email por si el usuario es eliminado
  action TEXT NOT NULL,  -- 'create', 'update', 'delete', 'approve', 'view_sensitive', etc.
  resource TEXT NOT NULL,  -- 'cotizacion', 'prediccion', 'config', 'user', etc.
  resource_id TEXT,  -- ID del recurso afectado
  old_value JSONB,  -- Valor anterior (para updates/deletes)
  new_value JSONB,  -- Valor nuevo (para creates/updates)
  metadata JSONB,  -- Información adicional
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- =====================================================
-- Insertar Roles Predefinidos
-- =====================================================

INSERT INTO roles (id, name, description) VALUES
('ADMIN', 'Administrador', 'Acceso total al sistema: configuración, usuarios, aprobaciones, modificaciones'),
('GERENTE', 'Gerente', 'Aprueba cotizaciones, modifica predicciones, ve reportes (sin acceso a configuración)'),
('OPERADOR', 'Operador/Vendedor', 'Crea y ve cotizaciones, consulta stock (sin aprobar ni modificar predicciones)'),
('VIEWER', 'Solo Lectura', 'Ve reportes y dashboards sin modificar nada'),
('COTIZACIONES_MANAGER', 'Gestor de Cotizaciones', 'Ve y modifica dashboard de cotizaciones + contenedores'),
('RESPONDIDAS_MANAGER', 'Gestor de Respondidas', 'Ve y modifica dashboard general + respondidas + contenedores')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- Insertar Permisos (resource.action)
-- =====================================================

INSERT INTO permissions (id, resource, action, description) VALUES
-- Configuración del sistema
('config.view', 'config', 'view', 'Ver configuración del sistema'),
('config.edit', 'config', 'edit', 'Modificar configuración del sistema (Defontana, algoritmo, etc.)'),

-- Gestión de usuarios
('users.view', 'users', 'view', 'Ver lista de usuarios'),
('users.create', 'users', 'create', 'Crear e invitar nuevos usuarios'),
('users.edit', 'users', 'edit', 'Editar usuarios y asignar roles'),
('users.delete', 'users', 'delete', 'Eliminar usuarios'),

-- Cotizaciones
('cotizaciones.view', 'cotizaciones', 'view', 'Ver cotizaciones'),
('cotizaciones.create', 'cotizaciones', 'create', 'Crear nuevas cotizaciones'),
('cotizaciones.edit', 'cotizaciones', 'edit', 'Editar cotizaciones'),
('cotizaciones.approve', 'cotizaciones', 'approve', 'Aprobar cotizaciones'),
('cotizaciones.delete', 'cotizaciones', 'delete', 'Eliminar cotizaciones'),

-- Predicciones
('predicciones.view', 'predicciones', 'view', 'Ver predicciones y sugerencias de reposición'),
('predicciones.edit', 'predicciones', 'edit', 'Modificar manualmente predicciones'),
('predicciones.execute', 'predicciones', 'execute', 'Ejecutar algoritmo de predicción'),

-- Dashboards
('dashboard.view', 'dashboard', 'view', 'Ver dashboard general'),
('dashboard.cotizaciones', 'dashboard', 'cotizaciones', 'Acceder a dashboard de cotizaciones'),
('dashboard.respondidas', 'dashboard', 'respondidas', 'Acceder a dashboard de respondidas'),

-- Contenedores
('contenedores.view', 'contenedores', 'view', 'Ver contenedores en tránsito'),
('contenedores.create', 'contenedores', 'create', 'Crear registros de contenedores'),
('contenedores.edit', 'contenedores', 'edit', 'Editar contenedores'),
('contenedores.delete', 'contenedores', 'delete', 'Eliminar contenedores'),

-- Inventario
('inventario.view', 'inventario', 'view', 'Ver stock e inventario'),
('inventario.edit', 'inventario', 'edit', 'Modificar stock manualmente'),

-- Ventas
('ventas.view', 'ventas', 'view', 'Ver histórico de ventas'),
('ventas.import', 'ventas', 'import', 'Importar ventas desde Excel o Defontana'),

-- Auditoría
('audit.view', 'audit', 'view', 'Ver logs de auditoría'),

-- Reportes
('reportes.view', 'reportes', 'view', 'Ver reportes y análisis'),
('reportes.export', 'reportes', 'export', 'Exportar reportes a Excel/PDF')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- Asignar Permisos a Roles
-- =====================================================

-- ADMIN: Acceso total
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'ADMIN', id FROM permissions
ON CONFLICT DO NOTHING;

-- GERENTE: Todo excepto configuración y gestión de usuarios
INSERT INTO role_permissions (role_id, permission_id) VALUES
('GERENTE', 'cotizaciones.view'),
('GERENTE', 'cotizaciones.create'),
('GERENTE', 'cotizaciones.edit'),
('GERENTE', 'cotizaciones.approve'),
('GERENTE', 'cotizaciones.delete'),
('GERENTE', 'predicciones.view'),
('GERENTE', 'predicciones.edit'),
('GERENTE', 'predicciones.execute'),
('GERENTE', 'dashboard.view'),
('GERENTE', 'dashboard.cotizaciones'),
('GERENTE', 'dashboard.respondidas'),
('GERENTE', 'contenedores.view'),
('GERENTE', 'contenedores.create'),
('GERENTE', 'contenedores.edit'),
('GERENTE', 'contenedores.delete'),
('GERENTE', 'inventario.view'),
('GERENTE', 'inventario.edit'),
('GERENTE', 'ventas.view'),
('GERENTE', 'ventas.import'),
('GERENTE', 'reportes.view'),
('GERENTE', 'reportes.export')
ON CONFLICT DO NOTHING;

-- OPERADOR: Crear/ver cotizaciones, consultar stock
INSERT INTO role_permissions (role_id, permission_id) VALUES
('OPERADOR', 'cotizaciones.view'),
('OPERADOR', 'cotizaciones.create'),
('OPERADOR', 'cotizaciones.edit'),
('OPERADOR', 'dashboard.view'),
('OPERADOR', 'dashboard.cotizaciones'),
('OPERADOR', 'inventario.view'),
('OPERADOR', 'predicciones.view'),
('OPERADOR', 'contenedores.view'),
('OPERADOR', 'reportes.view')
ON CONFLICT DO NOTHING;

-- VIEWER: Solo lectura
INSERT INTO role_permissions (role_id, permission_id) VALUES
('VIEWER', 'cotizaciones.view'),
('VIEWER', 'predicciones.view'),
('VIEWER', 'dashboard.view'),
('VIEWER', 'dashboard.cotizaciones'),
('VIEWER', 'dashboard.respondidas'),
('VIEWER', 'contenedores.view'),
('VIEWER', 'inventario.view'),
('VIEWER', 'ventas.view'),
('VIEWER', 'reportes.view')
ON CONFLICT DO NOTHING;

-- COTIZACIONES_MANAGER: Dashboard cotizaciones + contenedores
INSERT INTO role_permissions (role_id, permission_id) VALUES
('COTIZACIONES_MANAGER', 'cotizaciones.view'),
('COTIZACIONES_MANAGER', 'cotizaciones.create'),
('COTIZACIONES_MANAGER', 'cotizaciones.edit'),
('COTIZACIONES_MANAGER', 'cotizaciones.delete'),
('COTIZACIONES_MANAGER', 'dashboard.cotizaciones'),
('COTIZACIONES_MANAGER', 'contenedores.view'),
('COTIZACIONES_MANAGER', 'contenedores.create'),
('COTIZACIONES_MANAGER', 'contenedores.edit'),
('COTIZACIONES_MANAGER', 'inventario.view')
ON CONFLICT DO NOTHING;

-- RESPONDIDAS_MANAGER: Dashboard general + respondidas + contenedores
INSERT INTO role_permissions (role_id, permission_id) VALUES
('RESPONDIDAS_MANAGER', 'cotizaciones.view'),
('RESPONDIDAS_MANAGER', 'cotizaciones.create'),
('RESPONDIDAS_MANAGER', 'cotizaciones.edit'),
('RESPONDIDAS_MANAGER', 'dashboard.view'),
('RESPONDIDAS_MANAGER', 'dashboard.cotizaciones'),
('RESPONDIDAS_MANAGER', 'dashboard.respondidas'),
('RESPONDIDAS_MANAGER', 'contenedores.view'),
('RESPONDIDAS_MANAGER', 'contenedores.create'),
('RESPONDIDAS_MANAGER', 'contenedores.edit'),
('RESPONDIDAS_MANAGER', 'inventario.view'),
('RESPONDIDAS_MANAGER', 'reportes.view')
ON CONFLICT DO NOTHING;

-- =====================================================
-- Asignar rol ADMIN al usuario actual (bustillosmorales@gmail.com)
-- =====================================================

-- Buscar el usuario por email y asignarle rol ADMIN
INSERT INTO user_roles (user_id, role_id)
SELECT id, 'ADMIN'
FROM auth.users
WHERE email = 'bustillosmorales@gmail.com'
ON CONFLICT DO NOTHING;

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Habilitar RLS en todas las tablas nuevas
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_custom_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Solo admins pueden ver/editar roles y permisos
CREATE POLICY "Admin can manage roles" ON roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role_id = 'ADMIN'
    )
  );

CREATE POLICY "Admin can manage permissions" ON permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role_id = 'ADMIN'
    )
  );

CREATE POLICY "Admin can manage role_permissions" ON role_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role_id = 'ADMIN'
    )
  );

CREATE POLICY "Admin can manage user_roles" ON user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role_id = 'ADMIN'
    )
  );

CREATE POLICY "Admin can manage user_custom_permissions" ON user_custom_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role_id = 'ADMIN'
    )
  );

-- Policy: Usuarios pueden ver sus propios roles
CREATE POLICY "Users can view their own roles" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Policy: Usuarios pueden ver sus propios permisos custom
CREATE POLICY "Users can view their own custom permissions" ON user_custom_permissions
  FOR SELECT USING (user_id = auth.uid());

-- Policy: Solo admins pueden ver audit_log completo, otros usuarios solo ven sus propias acciones
CREATE POLICY "Admin can view all audit logs" ON audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role_id = 'ADMIN'
    )
  );

CREATE POLICY "Users can view their own audit logs" ON audit_log
  FOR SELECT USING (user_id = auth.uid());

-- Policy: Sistema puede insertar en audit_log (para funciones serverless)
CREATE POLICY "Service role can insert audit logs" ON audit_log
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- Función auxiliar: Verificar si usuario tiene permiso
-- =====================================================

CREATE OR REPLACE FUNCTION has_permission(
  user_id_param UUID,
  permission_id_param TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  has_perm BOOLEAN;
BEGIN
  -- 1. Verificar si es ADMIN (tiene todos los permisos)
  IF EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_id_param AND role_id = 'ADMIN'
  ) THEN
    RETURN TRUE;
  END IF;

  -- 2. Verificar permiso custom (override)
  SELECT granted INTO has_perm
  FROM user_custom_permissions
  WHERE user_id = user_id_param
    AND permission_id = permission_id_param;

  IF has_perm IS NOT NULL THEN
    RETURN has_perm;
  END IF;

  -- 3. Verificar permiso por rol
  IF EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    WHERE ur.user_id = user_id_param
      AND rp.permission_id = permission_id_param
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Función auxiliar: Obtener todos los permisos de un usuario
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_permissions(user_id_param UUID)
RETURNS TABLE(permission_id TEXT, resource TEXT, action TEXT) AS $$
BEGIN
  -- Si es ADMIN, retornar todos los permisos
  IF EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_id_param AND role_id = 'ADMIN'
  ) THEN
    RETURN QUERY SELECT p.id, p.resource, p.action FROM permissions p;
  ELSE
    -- Retornar permisos del rol + custom permissions
    RETURN QUERY
    SELECT DISTINCT p.id, p.resource, p.action
    FROM permissions p
    WHERE
      -- Permisos del rol
      EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        WHERE ur.user_id = user_id_param AND rp.permission_id = p.id
      )
      -- Permisos custom concedidos
      OR EXISTS (
        SELECT 1 FROM user_custom_permissions ucp
        WHERE ucp.user_id = user_id_param
          AND ucp.permission_id = p.id
          AND ucp.granted = TRUE
      )
      -- Excluir permisos custom revocados
      AND NOT EXISTS (
        SELECT 1 FROM user_custom_permissions ucp
        WHERE ucp.user_id = user_id_param
          AND ucp.permission_id = p.id
          AND ucp.granted = FALSE
      );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Registrar esta migración en audit_log
-- =====================================================

INSERT INTO audit_log (
  user_id,
  user_email,
  action,
  resource,
  metadata
) VALUES (
  (SELECT id FROM auth.users WHERE email = 'bustillosmorales@gmail.com' LIMIT 1),
  'bustillosmorales@gmail.com',
  'migration',
  'system',
  '{"migration": "20250119_roles_permissions", "description": "Sistema completo de roles, permisos y auditoría"}'
);
