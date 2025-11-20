-- =====================================================
-- Fix: Resolver dependencia circular en RLS de user_roles
-- Fecha: 2025-01-20
-- =====================================================

-- Eliminar la política circular que causa el error 500
DROP POLICY IF EXISTS "Admin can manage user_roles" ON user_roles;

-- Crear políticas más específicas sin dependencia circular

-- 1. Permitir a todos los usuarios autenticados VER todos los roles
--    (necesario para que el sistema funcione, los roles no son datos sensibles)
CREATE POLICY "Authenticated users can view user_roles" ON user_roles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 2. Solo permitir INSERT/UPDATE/DELETE a través de funciones serverless
--    (las funciones usan service_role key que bypasea RLS)
CREATE POLICY "Service role can manage user_roles" ON user_roles
  FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- Función auxiliar: Obtener roles de un usuario
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_roles(user_id_param UUID DEFAULT NULL)
RETURNS TABLE(role_id TEXT, role_name TEXT, role_description TEXT) AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Si no se proporciona user_id, usar el del usuario actual
  target_user_id := COALESCE(user_id_param, auth.uid());

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No user authenticated';
  END IF;

  RETURN QUERY
  SELECT
    ur.role_id,
    r.name,
    r.description
  FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE ur.user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION get_user_roles(UUID) TO authenticated;

-- =====================================================
-- Función auxiliar: Verificar si usuario es admin
-- =====================================================

CREATE OR REPLACE FUNCTION is_admin(user_id_param UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  target_user_id UUID;
BEGIN
  target_user_id := COALESCE(user_id_param, auth.uid());

  IF target_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = target_user_id AND role_id = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_admin(UUID) TO authenticated;

-- =====================================================
-- Actualizar políticas en otras tablas para usar is_admin()
-- =====================================================

-- Roles
DROP POLICY IF EXISTS "Admin can manage roles" ON roles;
CREATE POLICY "Admin can manage roles" ON roles
  FOR ALL USING (is_admin());

-- Permissions
DROP POLICY IF EXISTS "Admin can manage permissions" ON permissions;
CREATE POLICY "Admin can manage permissions" ON permissions
  FOR ALL USING (is_admin());

-- Role Permissions
DROP POLICY IF EXISTS "Admin can manage role_permissions" ON role_permissions;
CREATE POLICY "Admin can manage role_permissions" ON role_permissions
  FOR ALL USING (is_admin());

-- User Custom Permissions
DROP POLICY IF EXISTS "Admin can manage user_custom_permissions" ON user_custom_permissions;
CREATE POLICY "Admin can manage user_custom_permissions" ON user_custom_permissions
  FOR ALL USING (is_admin());

-- Audit Log
DROP POLICY IF EXISTS "Admin can view all audit logs" ON audit_log;
CREATE POLICY "Admin can view all audit logs" ON audit_log
  FOR SELECT USING (is_admin());
