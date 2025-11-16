# Integración con Defontana

Esta documentación explica cómo configurar y usar la integración con Defontana para importar ventas automáticamente.

## 📋 Requisitos Previos

1. **Cuenta activa de Defontana** en Chile
2. **API Key** de Defontana (solicítala en tu panel de administración)
3. **Company ID** (ID de tu empresa en Defontana)
4. Acceso de administrador a Supabase

## 🗄️ Paso 1: Configurar Base de Datos

Antes de usar la integración, debes crear las tablas necesarias en Supabase.

### Ejecutar Migración SQL

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Navega a **SQL Editor**
3. Crea un nuevo query
4. Copia y pega el contenido de: `scripts/migration-defontana-tables.sql`
5. Haz clic en **Run**
6. Verifica que se crearon las tablas:
   - `integraciones_config`
   - `sync_logs`

## 🔑 Paso 2: Obtener Credenciales de Defontana

### API Key

1. Inicia sesión en tu cuenta de Defontana
2. Ve a **Configuración** → **Integraciones** → **API**
3. Genera una nueva **API Key**
4. **¡IMPORTANTE!** Guarda esta clave en un lugar seguro, solo se muestra una vez

### Company ID

1. En Defontana, ve a **Configuración** → **Empresa**
2. Busca el campo **ID de Empresa** o **Company ID**
3. Copia este ID (generalmente es un número)

## ⚙️ Paso 3: Configurar en el Dashboard

1. Ve al **Dashboard Principal** (`/`)
2. Encontrarás el módulo **"Integración Defontana"** (icono 🔗)
3. Haz clic en **"🔐 Configurar Conexión"**
4. Completa los campos:
   - **API Key**: Pega tu API Key de Defontana
   - **ID de Empresa**: Ingresa tu Company ID
   - **Ambiente**: Selecciona "Producción" (usa "Sandbox" solo para pruebas)
5. Haz clic en **"💾 Guardar y Conectar"**
6. El sistema validará las credenciales automáticamente

## 🔄 Paso 4: Sincronizar Ventas

Una vez conectado, puedes sincronizar ventas de dos formas:

### Sincronización Manual

1. En el módulo de Defontana, haz clic en **"🔄 Sincronizar Ventas Ahora"**
2. Se importarán las ventas del último año
3. Espera el mensaje de confirmación con:
   - Ventas importadas
   - SKUs actualizados
   - Tiempo de procesamiento

### Sincronización Automática

- Las ventas se sincronizan **automáticamente cada 6 horas**
- No necesitas hacer nada, el sistema lo hace por ti
- Puedes ver la última sincronización en el dashboard

## 📊 Cómo se Usan las Ventas

Las ventas importadas desde Defontana se usan para:

1. **Mejorar predicciones de demanda**: El algoritmo de ML analiza el histórico de ventas
2. **Calcular tendencias**: Se identifican patrones estacionales
3. **Clasificación ABC**: Se categorizan productos según su rotación
4. **Alertas inteligentes**: Se detectan anomalías en ventas

## 🔍 Verificar Sincronización

### En el Dashboard

- Verás la **última sincronización** con fecha y hora
- Se muestra el **total de ventas** importadas
- Estado: "✓ Activo" si está funcionando correctamente

### En Supabase

Puedes verificar directamente en la base de datos:

```sql
-- Ver últimas sincronizaciones
SELECT *
FROM sync_logs
WHERE integration = 'defontana'
ORDER BY created_at DESC
LIMIT 10;

-- Ver ventas importadas desde Defontana
SELECT COUNT(*) as total_ventas
FROM ventas
WHERE origen = 'defontana';

-- Ver ventas por SKU
SELECT sku, COUNT(*) as num_ventas, SUM(unidades) as total_unidades
FROM ventas
WHERE origen = 'defontana'
GROUP BY sku
ORDER BY total_unidades DESC
LIMIT 20;
```

## ⚠️ Solución de Problemas

### Error: "Credenciales inválidas"

- Verifica que tu API Key sea correcta
- Asegúrate de que el Company ID coincida con tu cuenta
- Revisa que tu cuenta de Defontana tenga permisos de API

### Error: "No se encontraron ventas"

- Verifica que tengas ventas en el período seleccionado
- Revisa que tu cuenta de Defontana tenga datos de ventas
- Intenta con un rango de fechas más amplio

### La sincronización es muy lenta

- Normal para grandes volúmenes de datos (>10,000 ventas)
- El proceso puede tardar varios minutos
- No cierres la ventana mientras sincroniza

### Error 500 al sincronizar

- Verifica que las tablas existan en Supabase
- Revisa los logs en Supabase (tabla `sync_logs`)
- Contacta soporte si persiste

## 🔌 Desconectar Defontana

Si necesitas desconectar la integración:

1. En el módulo de Defontana, haz clic en **"🔌 Desconectar"**
2. Confirma la acción
3. Las credenciales se eliminarán de la base de datos
4. Las ventas ya importadas NO se eliminarán

## 🔐 Seguridad

- Las credenciales se almacenan en Supabase (base de datos segura)
- **NOTA**: En producción, las credenciales deberían estar encriptadas
- Solo usuarios autenticados pueden acceder a la configuración
- La API Key nunca se muestra después de guardarla

## 📈 Mejores Prácticas

1. **Sincroniza regularmente**: La sincronización automática cada 6 horas es ideal
2. **Monitorea los logs**: Revisa periódicamente `sync_logs` para detectar errores
3. **Limita el rango de fechas**: Solo importa ventas relevantes (último año)
4. **Verifica SKUs**: Asegúrate de que los SKUs en Defontana coincidan con tu sistema

## 🆘 Soporte

Si encuentras problemas:

1. Revisa esta documentación
2. Verifica los logs en Supabase (`sync_logs`)
3. Contacta al equipo de desarrollo
4. Revisa la documentación oficial de Defontana API

## 📚 Referencias

- [Documentación API Defontana](https://api.defontana.com/docs)
- [Supabase Dashboard](https://supabase.com/dashboard)
- [Guía de Predicciones](./PREDICCIONES.md)
