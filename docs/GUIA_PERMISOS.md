# 🔐 Guía Completa del Sistema de Permisos

## 📋 Índice

1. [Resumen del Sistema](#resumen-del-sistema)
2. [Roles Disponibles](#roles-disponibles)
3. [Permisos por Rol](#permisos-por-rol)
4. [Uso en Backend (Netlify Functions)](#uso-en-backend-netlify-functions)
5. [Uso en Frontend (React)](#uso-en-frontend-react)
6. [Gestión de Usuarios](#gestión-de-usuarios)
7. [Auditoría](#auditoría)
8. [Ejemplos Prácticos](#ejemplos-prácticos)

---

## 🎯 Resumen del Sistema

El sistema implementa **tres capas de seguridad**:

### 1. **Row Level Security (RLS) en Supabase**
- Políticas a nivel de base de datos
- Primera barrera de seguridad
- Verifica `auth.uid()` automáticamente

### 2. **Middleware de Autorización (Backend)**
- Funciones `withPermission()`, `withRole()`, `adminOnly()`
- Verifica permisos antes de ejecutar lógica de negocio
- Registra intentos de acceso no autorizado

### 3. **Protección de UI (Frontend)**
- Hooks: `usePermission()`, `useRole()`, `useIsAdmin()`
- Componentes: `<Protected>`, `<AdminOnly>`, `<RoleRequired>`
- Oculta/muestra elementos según permisos

---

## 👥 Roles Disponibles

| Rol ID | Nombre | Descripción |
|--------|--------|-------------|
| `ADMIN` | Administrador | Acceso total al sistema |
| `GERENTE` | Gerente | Aprueba cotizaciones, modifica predicciones (sin config) |
| `OPERADOR` | Operador/Vendedor | Crea/ve cotizaciones, consulta stock |
| `VIEWER` | Solo Lectura | Ve reportes y dashboards |
| `COTIZACIONES_MANAGER` | Gestor de Cotizaciones | Dashboard cotizaciones + contenedores |
| `RESPONDIDAS_MANAGER` | Gestor de Respondidas | Dashboard + respondidas + contenedores |

---

## 🔑 Permisos por Rol

### ADMIN (Administrador Total)
✅ **Todos los permisos** del sistema

### GERENTE
- ✅ Cotizaciones: ver, crear, editar, aprobar, eliminar
- ✅ Predicciones: ver, editar, ejecutar
- ✅ Dashboards: todos
- ✅ Contenedores: ver, crear, editar, eliminar
- ✅ Inventario: ver, editar
- ✅ Ventas: ver, importar
- ✅ Reportes: ver, exportar
- ❌ Configuración del sistema
- ❌ Gestión de usuarios

### OPERADOR
- ✅ Cotizaciones: ver, crear, editar
- ✅ Dashboard cotizaciones
- ✅ Inventario: ver
- ✅ Predicciones: ver
- ✅ Contenedores: ver
- ❌ Aprobar cotizaciones
- ❌ Modificar predicciones

### VIEWER
- ✅ Ver todos los reportes y dashboards
- ❌ Modificar cualquier dato

### COTIZACIONES_MANAGER
- ✅ Dashboard de cotizaciones completo
- ✅ Contenedores: ver, crear, editar
- ✅ Inventario: ver
- ❌ Dashboard general
- ❌ Respondidas

### RESPONDIDAS_MANAGER
- ✅ Dashboard general
- ✅ Dashboard de respondidas
- ✅ Contenedores: ver, crear, editar
- ❌ Configuración

---

## 🔧 Uso en Backend (Netlify Functions)

### Importar Middleware

```javascript
const { withAuth } = require('./lib/middleware');
const { Middleware, Audit, PERMISSIONS } = require('../../lib/auth/permissions');
```

### Ejemplo 1: Requiere Permiso Específico

```javascript
// Función que requiere permiso para aprobar cotizaciones
const { withPermission } = Middleware;

exports.handler = withAuth(
  withPermission(PERMISSIONS.COTIZACIONES_APPROVE, async (event, context, auth) => {
    const audit = Audit.logger(auth, event);
    const { cotizacionId } = JSON.parse(event.body);

    // Lógica de aprobación
    const { data, error } = await supabase
      .from('cotizaciones')
      .update({ estado: 'aprobada', aprobada_por: auth.userId })
      .eq('id', cotizacionId)
      .select()
      .single();

    if (error) throw error;

    // Registrar en auditoría
    await audit.logApprove('cotizacion', cotizacionId, {
      monto: data.monto_total,
      cliente: data.cliente
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, data })
    };
  })
);
```

### Ejemplo 2: Solo para Admins

```javascript
const { adminOnly } = Middleware;

exports.handler = withAuth(
  adminOnly(async (event, context, auth) => {
    const audit = Audit.logger(auth, event);

    // Lógica que solo admins pueden ejecutar
    const { key, value } = JSON.parse(event.body);

    const { error } = await supabase
      .from('configuracion_sistema')
      .upsert({ clave: key, valor: value });

    if (error) throw error;

    await audit.log('config_change', 'config', key, { old_value, new_value: value });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  })
);
```

### Ejemplo 3: Requiere Uno de Varios Permisos

```javascript
const { withAnyPermission } = Middleware;

exports.handler = withAuth(
  withAnyPermission(
    [PERMISSIONS.COTIZACIONES_EDIT, PERMISSIONS.COTIZACIONES_APPROVE],
    async (event, context, auth) => {
      // Usuario tiene permiso para editar O aprobar
      // ... lógica
    }
  )
);
```

### Ejemplo 4: Verificación Manual de Permisos

```javascript
const { Permissions, Audit } = require('../../lib/auth/permissions');

exports.handler = withAuth(async (event, context, auth) => {
  const audit = Audit.logger(auth, event);

  // Verificar permiso manualmente
  const canApprove = await Permissions.check(auth.userId, PERMISSIONS.COTIZACIONES_APPROVE);

  if (!canApprove) {
    await audit.log('view_sensitive', 'system', null, { access_denied: true });
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Sin permiso' })
    };
  }

  // ... lógica
});
```

---

## ⚛️ Uso en Frontend (React)

### 1. Hook: `usePermission()`

```tsx
import { usePermission } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/types/permissions';

function CotizacionActions() {
  const canApprove = usePermission(PERMISSIONS.COTIZACIONES_APPROVE);
  const canEdit = usePermission(PERMISSIONS.COTIZACIONES_EDIT);

  return (
    <div>
      {canEdit && <Button>Editar</Button>}
      {canApprove && <Button>Aprobar</Button>}
    </div>
  );
}
```

### 2. Componente: `<Protected>`

```tsx
import { Protected } from '@/components/auth/Protected';
import { PERMISSIONS } from '@/lib/types/permissions';

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>

      <Protected permission={PERMISSIONS.COTIZACIONES_CREATE}>
        <Button>Nueva Cotización</Button>
      </Protected>

      <Protected permission={PERMISSIONS.CONFIG_EDIT}>
        <Link href="/configuracion">Configuración</Link>
      </Protected>
    </div>
  );
}
```

### 3. Componente: `<AdminOnly>`

```tsx
import { AdminOnly } from '@/components/auth/Protected';

function SettingsPage() {
  return (
    <div>
      <h1>Configuración</h1>

      <AdminOnly showDenied>
        <ConfigurationForm />
      </AdminOnly>
    </div>
  );
}
```

### 4. Hook: `useIsAdmin()`

```tsx
import { useIsAdmin } from '@/hooks/usePermissions';

function Navigation() {
  const isAdmin = useIsAdmin();

  return (
    <nav>
      <Link href="/dashboard">Dashboard</Link>
      {isAdmin && <Link href="/admin/usuarios">Gestión de Usuarios</Link>}
    </nav>
  );
}
```

### 5. Hook: `useAudit()` - Registrar Acciones

```tsx
import { useAudit } from '@/hooks/usePermissions';

function CotizacionForm() {
  const audit = useAudit();

  const handleSubmit = async (data: any) => {
    const result = await createCotizacion(data);

    // Registrar en auditoría
    await audit.logCreate('cotizacion', result.id, data);

    toast({ title: 'Cotización creada' });
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### 6. Componente: `<ProtectedAny>` (uno de varios permisos)

```tsx
import { ProtectedAny } from '@/components/auth/Protected';

function CotizacionCard() {
  return (
    <Card>
      <CardContent>
        <ProtectedAny
          permissions={[
            PERMISSIONS.COTIZACIONES_EDIT,
            PERMISSIONS.COTIZACIONES_APPROVE,
          ]}
        >
          <Button>Gestionar</Button>
        </ProtectedAny>
      </CardContent>
    </Card>
  );
}
```

---

## 👤 Gestión de Usuarios

### Acceso a la UI de Gestión

Solo **Administradores** pueden acceder:

```
/admin/usuarios
```

### Funciones Disponibles

1. **Ver lista de usuarios**
   - Email, roles asignados, último acceso

2. **Invitar nuevo usuario**
   - Email + Rol inicial
   - Usuario recibe email de invitación

3. **Gestionar roles**
   - Asignar/remover roles múltiples
   - Un usuario puede tener varios roles

4. **Ver auditoría por usuario**
   - Historial completo de acciones
   - Últimas 50 acciones

---

## 📊 Auditoría

### Qué se registra automáticamente

- ✅ Intentos de acceso no autorizado
- ✅ Aprobaciones de cotizaciones
- ✅ Modificaciones de configuración
- ✅ Cambios de roles/permisos
- ✅ Creación/edición/eliminación de recursos

### Estructura del Log

```javascript
{
  user_id: 'uuid',
  user_email: 'usuario@ejemplo.com',
  action: 'approve',
  resource: 'cotizacion',
  resource_id: '123',
  old_value: {...},
  new_value: {...},
  metadata: {...},
  ip_address: '192.168.1.1',
  user_agent: 'Mozilla/5.0...',
  created_at: '2025-01-19T...'
}
```

### Ver Logs de Auditoría

#### Por Usuario (UI):
`/admin/usuarios` → Click en "Auditoría"

#### Consulta Directa (SQL):
```sql
SELECT * FROM audit_log
WHERE user_id = 'uuid'
ORDER BY created_at DESC
LIMIT 100;
```

---

## 💡 Ejemplos Prácticos

### Ejemplo 1: Proteger Botón de Aprobar

**Frontend:**
```tsx
import { usePermission } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/types/permissions';

function AprobarButton({ cotizacionId }: { cotizacionId: string }) {
  const canApprove = usePermission(PERMISSIONS.COTIZACIONES_APPROVE);
  const audit = useAudit();

  const handleApprove = async () => {
    const response = await fetch('/.netlify/functions/aprobar-cotizacion', {
      method: 'POST',
      body: JSON.stringify({ cotizacionId }),
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      await audit.logApprove('cotizacion', cotizacionId);
      toast({ title: 'Cotización aprobada' });
    }
  };

  if (!canApprove) return null;

  return <Button onClick={handleApprove}>Aprobar</Button>;
}
```

**Backend:**
```javascript
const { withAuth } = require('./lib/middleware');
const { Middleware, Audit, PERMISSIONS } = require('../../lib/auth/permissions');

exports.handler = withAuth(
  Middleware.withPermission(PERMISSIONS.COTIZACIONES_APPROVE, async (event, context, auth) => {
    const audit = Audit.logger(auth, event);
    const { cotizacionId } = JSON.parse(event.body);

    // Actualizar estado
    const { data, error } = await supabase
      .from('cotizaciones')
      .update({ estado: 'aprobada', aprobada_por: auth.userId, aprobada_en: new Date() })
      .eq('id', cotizacionId)
      .select()
      .single();

    if (error) throw error;

    // Auditoría
    await audit.logApprove('cotizacion', cotizacionId, {
      monto: data.monto_total,
      cliente: data.cliente
    });

    return { statusCode: 200, body: JSON.stringify({ success: true, data }) };
  })
);
```

### Ejemplo 2: Página Solo para Gerentes

```tsx
import { RoleRequired } from '@/components/auth/Protected';

export default function ReportesAvanzados() {
  return (
    <RoleRequired
      role="GERENTE"
      fallback={
        <div>
          <h1>Acceso Denegado</h1>
          <p>Solo gerentes pueden ver reportes avanzados</p>
        </div>
      }
    >
      <div>
        <h1>Reportes Avanzados</h1>
        {/* Contenido solo para gerentes */}
      </div>
    </RoleRequired>
  );
}
```

### Ejemplo 3: Verificación Combinada (Rol + Permiso)

```tsx
function ConfigurationPanel() {
  const isAdmin = useIsAdmin();
  const canEditConfig = usePermission(PERMISSIONS.CONFIG_EDIT);

  // Admin tiene permiso implícito, otros deben tenerlo explícito
  const canEdit = isAdmin || canEditConfig;

  return (
    <div>
      <h2>Configuración</h2>
      {canEdit ? (
        <ConfigForm />
      ) : (
        <ConfigReadOnly />
      )}
    </div>
  );
}
```

---

## 🚀 Primeros Pasos

### 1. Ejecutar Migración

```bash
# La migración ya debería estar aplicada en Supabase
# Si necesitas reaplicar:
psql $DATABASE_URL < supabase/migrations/20250119_roles_permissions.sql
```

### 2. Verificar tu Rol de Admin

Tu usuario (`bustillosmorales@gmail.com`) ya tiene el rol **ADMIN** asignado automáticamente.

### 3. Invitar Usuarios

1. Ve a `/admin/usuarios`
2. Click en "Invitar Usuario"
3. Ingresa email y selecciona rol
4. El usuario recibirá email para establecer contraseña

### 4. Aplicar Permisos en Funciones Existentes

Revisa las funciones de Netlify y agrega middleware según necesidad:

```javascript
// Antes:
exports.handler = withAuth(async (event, context, auth) => {
  // lógica
});

// Después:
exports.handler = withAuth(
  Middleware.withPermission(PERMISSIONS.XXX, async (event, context, auth) => {
    // lógica
  })
);
```

### 5. Proteger UI

Agrega componentes `<Protected>` en lugares críticos:

```tsx
<Protected permission={PERMISSIONS.COTIZACIONES_APPROVE}>
  <Button>Aprobar</Button>
</Protected>
```

---

## ⚠️ Importante

1. **Nunca confíes solo en la UI**
   - Siempre verificar permisos en el backend
   - La UI solo es para UX, no para seguridad

2. **RLS es la última barrera**
   - Incluso si middleware falla, RLS protege datos
   - Configura políticas RLS en todas las tablas sensibles

3. **Auditoría es crítica**
   - Registra todas las acciones importantes
   - Útil para debugging y compliance

4. **Roles múltiples**
   - Un usuario puede tener varios roles
   - Permisos se suman (tiene permiso si algún rol lo tiene)

5. **Admin siempre tiene todos los permisos**
   - Función `has_permission()` retorna `true` para ADMIN
   - No necesitas asignar permisos específicos a admins

---

## 📝 Resumen

✅ **Sistema implementado con 3 capas de seguridad**
✅ **6 roles predefinidos con permisos claros**
✅ **Middleware fácil de usar en backend**
✅ **Hooks y componentes para React**
✅ **UI de gestión de usuarios completa**
✅ **Auditoría completa de acciones**
✅ **Flexible: roles + permisos custom por usuario**

**¡El sistema está listo para uso en producción!** 🎉
