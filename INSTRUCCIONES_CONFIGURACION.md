# 🔧 Instrucciones para Habilitar el Panel de Configuración

Para usar el panel de configuración del sistema, necesitas crear la tabla `configuracion_sistema` en Supabase.

## Paso 1: Acceder al Editor SQL de Supabase

1. Ve a tu proyecto en Supabase: https://supabase.com/dashboard
2. En el menú lateral, haz clic en **"SQL Editor"**

## Paso 2: Ejecutar el SQL

1. Copia todo el contenido del archivo `create_configuracion_table.sql`
2. Pégalo en el editor SQL
3. Haz clic en el botón **"Run"** (o presiona Ctrl+Enter)

## Paso 3: Verificar la Creación

Deberías ver el mensaje: **"Success. No rows returned"**

Para verificar que se creó correctamente:

```sql
SELECT * FROM public.configuracion_sistema;
```

Deberías ver 11 registros con la configuración por defecto.

## Paso 4: Usar el Panel de Configuración

Ahora puedes usar el botón **"⚙️ Configuración"** en el dashboard para modificar los parámetros del sistema.

## Parámetros Configurables

### 📦 Parámetros de Inventario
- **Días Stock Deseado**: Días de inventario a mantener (default: 90)
- **Días Tránsito**: Tiempo de tránsito desde China (default: 120)
- **Nivel de Servicio**: % de probabilidad de no quedarse sin stock (default: 95%)
- **Días Histórico**: Días de historial a considerar (default: 180)

### 🤖 Parámetros de Algoritmo
- **Umbral Intermitencia**: % de días sin venta para detectar demanda intermitente (default: 0.5)
- **Alpha EWMA**: Factor de ponderación temporal, mayor = más peso a datos recientes (default: 0.3)
- **IQR Multiplicador**: Sensibilidad para detectar outliers (default: 1.5)

### 📊 Clasificación ABC
- **Umbral ABC A**: % acumulado de valor para clase A (default: 0.8 = 80%)
- **Umbral ABC B**: % acumulado de valor para clase B (default: 0.95 = 95%)

### 📈 Clasificación XYZ
- **Umbral XYZ X**: CV máximo para clase X - baja variabilidad (default: 0.5)
- **Umbral XYZ Y**: CV máximo para clase Y - media variabilidad (default: 1.0)

## Notas Importantes

- Los cambios en la configuración se aplican automáticamente en el próximo forecasting
- El sistema usa fallbacks seguros si no puede leer la configuración
- Los valores tienen validación de rango en el frontend para evitar valores inválidos
- La configuración se guarda en la BD y persiste entre ejecuciones

## Solución de Problemas

**Si el botón de configuración no muestra datos:**
1. Verifica que ejecutaste el SQL correctamente
2. Revisa que la tabla tenga permisos de lectura (RLS)
3. Ejecuta: `SELECT * FROM public.configuracion_sistema;` para verificar los datos

**Si el workflow falla después de modificar la configuración:**
1. Revisa los logs del workflow para ver errores específicos
2. Verifica que los valores estén dentro de los rangos permitidos
3. Resetea a valores por defecto si es necesario: ejecuta nuevamente el SQL
