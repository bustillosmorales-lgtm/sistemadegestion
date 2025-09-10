# MercadoLibre Integration - sistemadegestion.net

Sistema completo de integración con la API de MercadoLibre para Chile, desarrollado con Next.js y Supabase.

## 🚀 Configuración Inicial

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Variables de Entorno

Copia `.env.example` a `.env.local` y configura:

```env
# Supabase
SUPABASE_URL=tu_supabase_project_url
SUPABASE_ANON_KEY=tu_supabase_anon_key
SUPABASE_SERVICE_KEY=tu_supabase_service_role_key

# MercadoLibre Chile
ML_CLIENT_ID=5166684581522596
ML_CLIENT_SECRET=tu_client_secret_regenerado
ML_REDIRECT_URI=https://sistemadegestion.net/mercadolibre/callback
ML_API_BASE=https://api.mercadolibre.com
ML_AUTH_BASE=https://auth.mercadolibre.cl
ML_COUNTRY=CL

# Next.js
NEXTAUTH_URL=https://sistemadegestion.net
NODE_ENV=production
```

### 3. Configurar Base de Datos

Ejecuta el script SQL en tu panel de Supabase:

```bash
# En el SQL Editor de Supabase, ejecuta:
./scripts/supabase-setup.sql
```

### 4. Configurar URLs en MercadoLibre Developers

En tu panel de desarrollador de MercadoLibre, configura:

- **Redirect URI**: `https://sistemadegestion.net/mercadolibre/callback`
- **Webhook URL**: `https://sistemadegestion.net/webhooks/mercadolibre`

## 📋 Endpoints de API

### Autenticación

| Endpoint | Método | Descripción |
|----------|---------|-------------|
| `/api/mercadolibre/auth` | GET | Iniciar autorización OAuth |
| `/api/mercadolibre/callback` | GET | Callback de autorización |
| `/api/mercadolibre/status` | GET | Verificar estado de conexión |

### Órdenes

| Endpoint | Método | Descripción |
|----------|---------|-------------|
| `/api/mercadolibre/sync-orders` | GET | Sincronizar órdenes |
| `/api/mercadolibre/orders/[id]` | GET | Obtener orden específica |

### Mensajes

| Endpoint | Método | Descripción |
|----------|---------|-------------|
| `/api/mercadolibre/messages` | GET | Sincronizar mensajes |

### Items/Productos

| Endpoint | Método | Descripción |
|----------|---------|-------------|
| `/api/mercadolibre/items/[id]` | GET | Obtener producto específico |

### Webhooks

| Endpoint | Método | Descripción |
|----------|---------|-------------|
| `/api/webhooks/mercadolibre` | POST | Recibir notificaciones |

### Utilidades

| Endpoint | Método | Descripción |
|----------|---------|-------------|
| `/api/mercadolibre/sync-all` | POST | Sincronización completa |
| `/api/notifications` | GET/PATCH | Gestión de notificaciones |

## 🔄 Flujo de Integración

### 1. Autorización Inicial

```javascript
// 1. Obtener URL de autorización
const response = await fetch('/api/mercadolibre/auth');
const { auth_url } = await response.json();

// 2. Redirigir usuario a MercadoLibre
window.location.href = auth_url;

// 3. MercadoLibre redirige de vuelta a /mercadolibre/callback
// 4. Tokens se guardan automáticamente
```

### 2. Verificar Estado de Conexión

```javascript
const response = await fetch('/api/mercadolibre/status');
const status = await response.json();

if (status.connected) {
  console.log(`Conectado como: ${status.user.nickname}`);
} else {
  console.log('Necesita autorización');
}
```

### 3. Sincronizar Órdenes

```javascript
// Sincronización manual
const response = await fetch('/api/mercadolibre/sync-orders');
const result = await response.json();

console.log(`${result.synced_count} órdenes sincronizadas`);
```

### 4. Webhooks Automáticos

Los webhooks se procesan automáticamente para estos tópicos:

- **orders**: Nuevas órdenes y cambios de estado
- **messages**: Mensajes pre y post venta
- **items**: Cambios en productos
- **shipments**: Actualizaciones de envío
- **promotions**: Cambios en promociones

## 📊 Base de Datos

### Tablas Principales

1. **ml_auth**: Tokens de autenticación
2. **orders**: Órdenes sincronizadas
3. **ml_messages**: Mensajes de ML
4. **ml_items**: Productos de ML
5. **ml_shipments**: Información de envíos
6. **webhook_logs**: Log de webhooks
7. **system_notifications**: Notificaciones internas

### Consultas Útiles

```sql
-- Órdenes recientes
SELECT external_id, status, total_amount, date_created 
FROM orders 
WHERE platform = 'mercadolibre' 
ORDER BY date_created DESC 
LIMIT 10;

-- Notificaciones no leídas
SELECT * FROM system_notifications 
WHERE read = FALSE 
ORDER BY created_at DESC;

-- Log de webhooks recientes
SELECT topic, resource, status, created_at 
FROM webhook_logs 
ORDER BY created_at DESC 
LIMIT 20;
```

## 🔔 Sistema de Notificaciones

El sistema crea notificaciones automáticas para:

### Estados de Órdenes
- Nueva orden confirmada (prioridad alta)
- Pago requerido
- Pago en proceso
- Orden pagada (prioridad alta)
- Orden enviada
- Orden entregada (prioridad alta)
- Orden cancelada (prioridad media)

### Mensajes
- Nuevos mensajes de clientes (prioridad media)

### Productos
- Producto pausado (prioridad media)
- Producto sin stock (prioridad alta)

### Envíos
- Envío listo para despachar (prioridad alta)
- Envío entregado (prioridad media)

## 🛠️ Uso Programático

### Servicio MercadoLibre

```javascript
const mlService = require('./lib/mercadolibre-service');

// Obtener órdenes
const orders = await mlService.getOrders({ 
  limit: 50, 
  sort: 'date_desc' 
});

// Obtener orden específica
const order = await mlService.getOrderById('ORDER_ID');

// Verificar conexión
const isConnected = await mlService.getValidMlToken() !== null;

// Obtener información del usuario
const userInfo = await mlService.getUserInfo();
```

### Configuración de Webhooks

El sistema maneja automáticamente todos los webhooks configurados. Para debuggear:

```javascript
// Ver logs de webhooks recientes
const { data } = await supabase
  .from('webhook_logs')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(20);
```

## 🔧 Desarrollo y Testing

### Ejecutar en Desarrollo

```bash
npm run dev
```

### Testing de Webhooks

Para probar webhooks localmente usando ngrok:

```bash
# Instalar ngrok
npm install -g ngrok

# Exponer puerto local
ngrok http 3000

# Configurar URL de webhook en ML:
# https://tu-ngrok-url.ngrok.io/api/webhooks/mercadolibre
```

### Logs y Debugging

Los logs se muestran en la consola con emojis para fácil identificación:

- 🚀 Inicio de procesos
- ✅ Operaciones exitosas
- ❌ Errores
- 🔄 Procesamiento
- 📦 Órdenes
- 📬 Mensajes
- 🏷️ Productos
- 🚚 Envíos
- 🔔 Notificaciones

## ⚠️ Consideraciones Importantes

### Seguridad
1. **Nunca expongas tu CLIENT_SECRET**
2. **Usa HTTPS en producción**
3. **Rota tokens periódicamente**
4. **Valida webhooks**

### Rate Limiting
- MercadoLibre tiene límites de rate
- El sistema maneja refresh de tokens automáticamente
- Los webhooks responden inmediatamente para evitar timeouts

### Manejo de Errores
- Todos los endpoints tienen manejo de errores robusto
- Los webhooks siempre responden 200 OK
- Los errores se loggean para debugging

### Escalabilidad
- La base de datos está optimizada con índices
- Los webhooks se procesan de forma asíncrona
- Preparado para múltiples usuarios/cuentas

## 📞 Soporte

Para issues específicos de la integración:

1. Revisa los logs de webhook en `webhook_logs`
2. Verifica el estado de conexión con `/api/mercadolibre/status`
3. Comprueba las variables de entorno
4. Revisa la configuración en MercadoLibre Developers

## 🔄 Próximas Características

- [ ] Gestión de inventario automática
- [ ] Respuestas automáticas a mensajes
- [ ] Dashboard de métricas
- [ ] Integración con sistema de facturación
- [ ] Alertas por email/SMS
- [ ] Backup automático de datos

---

**Desarrollado para sistemadegestion.net**  
Integración completa con MercadoLibre Chile 🇨🇱