# 🚀 Cómo Implementar el Sistema de Permisos en Producción

## ✅ Lo que se ha implementado

El sistema completo de roles, permisos y auditoría incluye:

1. ✅ **Base de datos**
   - 6 tablas nuevas: `roles`, `permissions`, `role_permissions`, `user_roles`, `user_custom_permissions`, `audit_log`
   - Row Level Security (RLS) configurado
   - Funciones SQL: `has_permission()`, `get_user_permissions()`
   - Tu usuario ya tiene rol ADMIN asignado

2. ✅ **Backend (Netlify Functions)**
   - Middleware: `withPermission()`, `withRole()`, `adminOnly()`
   - Sistema de auditoría con `Audit.logger()`
   - Tipos TypeScript completos

3. ✅ **Frontend (React)**
   - Hooks: `usePermission()`, `useRole()`, `useIsAdmin()`, `useAudit()`
   - Componentes: `<Protected>`, `<AdminOnly>`, `<RoleRequired>`
   - Página de gestión: `/admin/usuarios`

4. ✅ **Documentación**
   - `GUIA_PERMISOS.md` - Guía completa de uso
   - Ejemplos prácticos para backend y frontend

---

## 📋 Pasos para Implementar en Producción

### Paso 1: Aplicar Migración en Supabase

#### Opción A: Usando Supabase Dashboard (Recomendado)

1. **Ve a tu proyecto en Supabase Dashboard**
   - URL: https://supabase.com/dashboard/project/[tu-proyecto]

2. **Ve a SQL Editor**
   - Menú lateral → SQL Editor

3. **Crear nueva query**
   - Click en "New query"

4. **Copiar contenido de la migración**
   - Abre: `supabase/migrations/20250119_roles_permissions.sql`
   - Copia TODO el contenido (3000+ líneas)

5. **Pegar y ejecutar**
   - Pega en el editor SQL
   - Click en "Run" o presiona `Ctrl+Enter`

6. **Verificar resultado**
   - Deberías ver: "Success. No rows returned"
   - Si hay error, lee el mensaje y corrige

#### Opción B: Usando CLI de Supabase

```bash
# 1. Instalar Supabase CLI (si no lo tienes)
npm install -g supabase

# 2. Login
supabase login

# 3. Aplicar migración
supabase db push --project-ref [tu-project-ref]
```

#### Opción C: Usando psql directamente

```bash
# 1. Obtener connection string de Supabase
# Dashboard → Settings → Database → Connection string

# 2. Aplicar migración
psql "tu-connection-string" < supabase/migrations/20250119_roles_permissions.sql
```

---

### Paso 2: Verificar que la Migración se Aplicó Correctamente

Ejecuta estas queries en Supabase SQL Editor para verificar:

```sql
-- 1. Verificar tablas creadas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('roles', 'permissions', 'role_permissions', 'user_roles', 'audit_log');

-- 2. Verificar roles insertados
SELECT id, name FROM roles ORDER BY id;

-- 3. Verificar permisos insertados
SELECT COUNT(*) as total_permisos FROM permissions;

-- 4. Verificar que tienes rol ADMIN
SELECT ur.role_id, u.email
FROM user_roles ur
JOIN auth.users u ON ur.user_id = u.id
WHERE u.email = 'bustillosmorales@gmail.com';

-- 5. Verificar función has_permission()
SELECT has_permission(
  (SELECT id FROM auth.users WHERE email = 'bustillosmorales@gmail.com'),
  'config.edit'
) as tiene_permiso;
```

**Resultados esperados:**
1. Debe mostrar 6 tablas
2. Debe mostrar 6 roles
3. Debe mostrar 25+ permisos
4. Debe mostrar 'ADMIN' para tu email
5. Debe retornar `true`

---

### Paso 3: Deployment del Código

#### 3.1. Commit y Push

```bash
# 1. Ver archivos modificados/creados
git status

# 2. Agregar todos los archivos nuevos
git add .

# 3. Commit
git commit -m "Feature: Sistema completo de roles, permisos y auditoría

- Migración SQL con 6 tablas nuevas + RLS + funciones
- Middleware de autorización para Netlify Functions
- Hooks y componentes React para protección de UI
- Página de gestión de usuarios (/admin/usuarios)
- Sistema de auditoría completa
- Documentación completa en docs/GUIA_PERMISOS.md"

# 4. Push
git push origin main
```

#### 3.2. Verificar Deploy en Netlify

1. Ve a https://app.netlify.com/
2. Selecciona tu sitio
3. Ve a "Deploys"
4. Espera a que el deploy termine (status: Published)

---

### Paso 4: Verificar en Producción

#### 4.1. Verificar tu rol de Admin

1. **Ingresa a tu app en producción**
   - URL: https://sistemadegestion.net

2. **Ve a Gestión de Usuarios**
   - URL: https://sistemadegestion.net/admin/usuarios
   - Deberías ver la página de gestión

3. **Verificar que apareces en la lista**
   - Deberías ver tu email con badge "Administrador"

#### 4.2. Invitar un usuario de prueba

1. Click en "Invitar Usuario"
2. Email: `test@tuempresa.com` (o email real)
3. Rol: `OPERADOR`
4. Click "Enviar Invitación"

**Resultado esperado:**
- ✅ Toast de éxito
- ✅ Usuario aparece en la tabla
- ✅ Usuario recibe email (si es email real)

#### 4.3. Verificar permisos en funciones

Prueba una función protegida. Por ejemplo, si tienes una función que requiere permiso:

```javascript
// Ejemplo: /netlify/functions/test-permissions.js
const { withAuth } = require('./lib/middleware');
const { Middleware, PERMISSIONS } = require('../../lib/auth/permissions');

exports.handler = withAuth(
  Middleware.withPermission(PERMISSIONS.CONFIG_EDIT, async (event, context, auth) => {
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Tienes permiso para editar configuración',
        user: auth.userEmail
      })
    };
  })
);
```

Prueba con curl:
```bash
# 1. Obtener token (desde Developer Tools → Network → Headers → Authorization)
TOKEN="tu-token-aqui"

# 2. Llamar función protegida
curl -X POST https://sistemadegestion.net/.netlify/functions/test-permissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Si eres admin: statusCode 200, success: true
# Si no tienes permiso: statusCode 403, error: Forbidden
```

---

### Paso 5: Configurar Permisos en Funciones Existentes

Ahora debes proteger tus funciones existentes. Por ejemplo:

#### Ejemplo: Aprobar Cotizaciones

**Antes:**
```javascript
// netlify/functions/aprobar-cotizacion.js
const { withAuth } = require('./lib/middleware');

exports.handler = withAuth(async (event, context, auth) => {
  // Cualquier usuario autenticado puede aprobar ❌
  // ... lógica
});
```

**Después:**
```javascript
// netlify/functions/aprobar-cotizacion.js
const { withAuth } = require('./lib/middleware');
const { Middleware, Audit, PERMISSIONS } = require('../../lib/auth/permissions');

exports.handler = withAuth(
  Middleware.withPermission(PERMISSIONS.COTIZACIONES_APPROVE, async (event, context, auth) => {
    const audit = Audit.logger(auth, event);
    // Solo usuarios con permiso pueden aprobar ✅

    const { cotizacionId } = JSON.parse(event.body);

    // ... lógica de aprobación

    await audit.logApprove('cotizacion', cotizacionId, { ... });

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  })
);
```

#### Funciones Críticas a Proteger:

| Función | Permiso Requerido |
|---------|-------------------|
| Aprobar cotizaciones | `PERMISSIONS.COTIZACIONES_APPROVE` |
| Modificar configuración | `PERMISSIONS.CONFIG_EDIT` |
| Gestionar usuarios | `adminOnly()` |
| Modificar predicciones | `PERMISSIONS.PREDICCIONES_EDIT` |
| Eliminar cotizaciones | `PERMISSIONS.COTIZACIONES_DELETE` |
| Importar ventas | `PERMISSIONS.VENTAS_IMPORT` |

---

### Paso 6: Proteger UI

Actualiza componentes para ocultar/mostrar según permisos:

#### Ejemplo: Botón de Aprobar

**Antes:**
```tsx
<Button onClick={handleAprobar}>Aprobar</Button>
```

**Después:**
```tsx
import { Protected } from '@/components/auth/Protected';
import { PERMISSIONS } from '@/lib/types/permissions';

<Protected permission={PERMISSIONS.COTIZACIONES_APPROVE}>
  <Button onClick={handleAprobar}>Aprobar</Button>
</Protected>
```

#### Ejemplo: Link de Configuración

```tsx
import { AdminOnly } from '@/components/auth/Protected';

<AdminOnly>
  <Link href="/configuracion">Configuración del Sistema</Link>
</AdminOnly>
```

---

## ⚠️ Problemas Comunes y Soluciones

### Error: "relation 'roles' does not exist"

**Causa:** La migración no se aplicó correctamente

**Solución:**
```sql
-- Verificar si las tablas existen
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'roles';

-- Si no existe, volver a ejecutar la migración completa
```

### Error: "No tienes permiso" al entrar a /admin/usuarios

**Causa:** Tu usuario no tiene rol ADMIN

**Solución:**
```sql
-- Asignar rol ADMIN manualmente
INSERT INTO user_roles (user_id, role_id)
SELECT id, 'ADMIN'
FROM auth.users
WHERE email = 'bustillosmorales@gmail.com'
ON CONFLICT DO NOTHING;
```

### Error: "function has_permission does not exist"

**Causa:** La función SQL no se creó

**Solución:**
```sql
-- Ejecutar solo la parte de funciones de la migración
-- Busca en 20250119_roles_permissions.sql las secciones:
-- "Función auxiliar: Verificar si usuario tiene permiso"
-- "Función auxiliar: Obtener todos los permisos de un usuario"
-- Y ejecuta esas partes
```

### Error: "Invalid API key" al usar admin.listUsers()

**Causa:** La función de gestión de usuarios usa `auth.admin.listUsers()` que requiere service role

**Solución:**
- Asegúrate de que las funciones Netlify usan `SUPABASE_SERVICE_KEY`
- Verifica que el secret esté configurado en Netlify

---

## 📊 Checklist Final

- [ ] Migración SQL ejecutada en Supabase
- [ ] Tablas verificadas (6 tablas nuevas)
- [ ] Tu usuario tiene rol ADMIN
- [ ] Código pusheado a producción
- [ ] Deploy completado en Netlify
- [ ] Página `/admin/usuarios` accesible
- [ ] Usuario de prueba invitado correctamente
- [ ] Funciones críticas protegidas con middleware
- [ ] UI protegida con componentes `<Protected>`
- [ ] Auditoría funcionando (ver logs en `audit_log`)

---

## 🎉 ¡Listo!

Una vez completados estos pasos, tu sistema tendrá:

✅ Control de acceso basado en roles (RBAC)
✅ Permisos granulares por recurso y acción
✅ Auditoría completa de acciones
✅ UI para gestión de usuarios
✅ Seguridad en 3 capas (RLS + Backend + Frontend)
✅ Flexible y escalable

**Documentación completa:** `docs/GUIA_PERMISOS.md`

**Próximos pasos:**
1. Invitar a los usuarios reales
2. Asignar roles apropiados
3. Proteger todas las funciones críticas
4. Monitorear logs de auditoría regularmente
