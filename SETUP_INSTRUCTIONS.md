# 🚀 Instrucciones de Configuración - Integración MercadoLibre

## ✅ Pasos Completados

- [x] ✅ Dependencias NPM instaladas (axios, cors)
- [x] ✅ Estructura de archivos creada
- [x] ✅ API endpoints desarrollados
- [x] ✅ Webhooks implementados
- [x] ✅ Sistema de notificaciones configurado
- [x] ✅ Scripts SQL para Supabase preparados

## 🔧 Pasos Pendientes (REQUIRED)

### 1. 🔐 Configurar Variables de Entorno

Crea el archivo `.env.local` en la raíz del proyecto:

```bash
# Supabase (REQUERIDO)
SUPABASE_URL=tu_supabase_project_url
SUPABASE_ANON_KEY=tu_supabase_anon_key
SUPABASE_SERVICE_KEY=tu_supabase_service_role_key

# MercadoLibre Chile (REQUERIDO)
ML_CLIENT_ID=5166684581522596
ML_CLIENT_SECRET=REGENERA_TU_CLIENT_SECRET_AQUÍ
ML_REDIRECT_URI=https://sistemadegestion.net/mercadolibre/callback
ML_API_BASE=https://api.mercadolibre.com
ML_AUTH_BASE=https://auth.mercadolibre.cl
ML_COUNTRY=CL

# Next.js
NEXTAUTH_URL=https://sistemadegestion.net
NODE_ENV=production
```

### 2. 🗄️ Configurar Base de Datos Supabase

1. Ve a tu panel de Supabase
2. Abre el **SQL Editor**
3. Ejecuta el contenido del archivo: `scripts/supabase-setup.sql`
4. Verifica que se crearon todas las tablas

### 3. 🔗 Configurar URLs en MercadoLibre Developers

En tu panel de [MercadoLibre Developers](https://developers.mercadolibre.com.ar):

1. **Redirect URI**: 
   ```
   https://sistemadegestion.net/mercadolibre/callback
   ```

2. **Webhook URL**:
   ```
   https://sistemadegestion.net/webhooks/mercadolibre
   ```

### 4. 🔐 Regenerar Client Secret

**⚠️ IMPORTANTE**: Por seguridad, regenera tu Client Secret:

1. Ve a tu app en MercadoLibre Developers
2. Regenera el Client Secret
3. Actualiza la variable `ML_CLIENT_SECRET` en `.env.local`

### 5. ✅ Verificar Configuración

Ejecuta el endpoint de prueba:

```bash
curl https://sistemadegestion.net/api/mercadolibre/test
```

Debería devolver `"success": true` si todo está configurado correctamente.

## 🚀 Uso de la Integración

### 1. Autorizar Aplicación

```javascript
// Obtener URL de autorización
const response = await fetch('/api/mercadolibre/auth');
const { auth_url } = await response.json();

// Redirigir usuario
window.location.href = auth_url;
```

### 2. Verificar Estado

```javascript
const response = await fetch('/api/mercadolibre/status');
const status = await response.json();
console.log(status.connected); // true/false
```

### 3. Sincronizar Órdenes

```javascript
const response = await fetch('/api/mercadolibre/sync-orders');
const result = await response.json();
console.log(`${result.synced_count} órdenes sincronizadas`);
```

## 📊 Endpoints Disponibles

| URL | Método | Descripción |
|-----|---------|-------------|
| `/api/mercadolibre/test` | GET | Verificar configuración |
| `/api/mercadolibre/auth` | GET | Iniciar autorización |
| `/api/mercadolibre/callback` | GET | Callback OAuth |
| `/api/mercadolibre/status` | GET | Estado de conexión |
| `/api/mercadolibre/sync-orders` | GET | Sincronizar órdenes |
| `/api/mercadolibre/sync-all` | POST | Sincronización completa |
| `/api/mercadolibre/messages` | GET | Sincronizar mensajes |
| `/api/mercadolibre/orders/[id]` | GET | Orden específica |
| `/api/mercadolibre/items/[id]` | GET | Producto específico |
| `/api/webhooks/mercadolibre` | POST | Recibir notificaciones |
| `/api/notifications` | GET/PATCH | Gestionar notificaciones |

## 🔔 Webhooks Configurados

El sistema maneja automáticamente:

- **orders**: Nuevas órdenes y cambios de estado
- **messages**: Mensajes pre y post venta  
- **items**: Cambios en productos
- **shipments**: Actualizaciones de envío
- **promotions**: Cambios en promociones

## 🗄️ Estructura de Base de Datos

### Tablas Creadas:

1. **ml_auth** - Tokens de autenticación
2. **orders** - Órdenes sincronizadas
3. **ml_messages** - Mensajes de MercadoLibre
4. **ml_items** - Productos de MercadoLibre
5. **ml_shipments** - Información de envíos
6. **ml_promotions** - Promociones
7. **webhook_logs** - Log de webhooks
8. **system_notifications** - Notificaciones internas

## 🚨 Troubleshooting

### Error: "Variables de entorno faltantes"
- Verifica que `.env.local` esté configurado correctamente
- Asegúrate de que todas las variables requeridas estén presentes

### Error: "No hay autorización válida"
- Ejecuta el proceso de autorización: `/api/mercadolibre/auth`
- Verifica que el Client Secret sea correcto

### Error: "Error conectando a Supabase"
- Verifica las credenciales de Supabase
- Asegúrate de que las tablas estén creadas

### Webhooks no funcionan
- Verifica que la URL esté configurada en MercadoLibre
- Comprueba los logs en `webhook_logs`
- Asegúrate de que el servidor esté usando HTTPS

## 📞 Soporte

1. **Verificar configuración**: `/api/mercadolibre/test`
2. **Revisar logs**: Tabla `webhook_logs` en Supabase
3. **Estado de conexión**: `/api/mercadolibre/status`
4. **Documentación**: Ver `MERCADOLIBRE_README.md`

---

## 🎯 Quick Start

```bash
# 1. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# 2. Ejecutar SQL en Supabase
# Abrir Supabase SQL Editor y ejecutar scripts/supabase-setup.sql

# 3. Verificar configuración
curl https://sistemadegestion.net/api/mercadolibre/test

# 4. Iniciar autorización
# Ir a: https://sistemadegestion.net/api/mercadolibre/auth?redirect=true
```

**¡La integración está lista para usar! 🎉**