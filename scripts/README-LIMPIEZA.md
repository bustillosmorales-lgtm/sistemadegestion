# Scripts de Limpieza de Base de Datos

## 📋 Descripción

Scripts SQL para limpiar la base de datos en diferentes niveles, ideal para testing y desarrollo.

## 🔧 Scripts Disponibles

### 1. `limpiar-datos-transaccionales.sql` (RECOMENDADO)

**Cuándo usar:** Para limpiar datos de operación diaria manteniendo toda la configuración.

**Limpia:**
- ✅ Ventas históricas
- ✅ Compras históricas
- ✅ Tránsito de China
- ✅ Stock actual
- ✅ Predicciones
- ✅ Alertas de inventario
- ✅ Métricas del modelo
- ✅ Cotizaciones
- ✅ Logs de sincronización

**Mantiene:**
- ✅ Configuración del sistema
- ✅ Usuarios y roles
- ✅ SKUs excluidos (configuración)
- ✅ Packs configurados
- ✅ SKUs a desconsiderar
- ✅ Credenciales de Defontana

**Ideal para:** Hacer testing con datos limpios sin perder configuración.

---

### 2. `limpiar-datos-completo.sql` (AGRESIVO)

**Cuándo usar:** Para resetear casi todo el sistema (mantiene solo usuarios y configuración base).

**Limpia todo lo anterior MÁS:**
- ✅ SKUs excluidos
- ✅ Packs configurados
- ✅ SKUs a desconsiderar

**Mantiene:**
- ✅ Usuarios (auth.users)
- ✅ Roles y permisos
- ✅ Configuración del sistema
- ✅ Credenciales de Defontana (comentado, se puede descomentar)

**Ideal para:** Empezar desde cero con productos y configuración nueva.

---

## 📖 Cómo Usar

### Opción 1: Desde Supabase Dashboard (Recomendado)

1. Abre tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ve a **SQL Editor** en el menú lateral
3. Copia y pega el contenido del script que necesites
4. Click en **Run** o presiona `Ctrl + Enter`
5. Verifica la tabla de resultados al final

### Opción 2: Desde la Terminal con psql

```bash
# Conectarse a Supabase
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

# Ejecutar el script
\i scripts/limpiar-datos-transaccionales.sql
```

### Opción 3: Desde tu aplicación

```typescript
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(url, serviceRoleKey);

const sql = fs.readFileSync('./scripts/limpiar-datos-transaccionales.sql', 'utf8');
const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
```

---

## ⚠️ Precauciones

### Antes de ejecutar:

1. **Hacer backup** (si es producción):
   ```bash
   # Desde Supabase Dashboard: Settings > Database > Backups
   # O ejecutar manualmente:
   pg_dump -h [HOST] -U postgres -d postgres > backup_$(date +%Y%m%d).sql
   ```

2. **Verificar el ambiente**: Asegúrate de estar en PRE-PRODUCCIÓN, no en producción.

3. **Revisar el script**: Lee el contenido antes de ejecutar para confirmar qué se eliminará.

### Después de ejecutar:

1. **Verificar la tabla de resultados**: Debe mostrar 0 registros en las tablas limpiadas.

2. **Cargar datos de prueba**: Sube un Excel de prueba desde el Dashboard.

3. **Ejecutar forecasting**: Corre el workflow de GitHub Actions para generar predicciones.

---

## 🧪 Flujo de Testing Recomendado

```bash
# 1. Limpiar datos transaccionales
# Ejecutar: scripts/limpiar-datos-transaccionales.sql en Supabase

# 2. Cargar datos de prueba
# Desde Dashboard: Subir Excel con ventas

# 3. Ejecutar predicción
# GitHub Actions: Run workflow "Forecasting diario"

# 4. Probar en la aplicación
# https://tu-app.netlify.app

# 5. Verificar resultados
# Dashboard debe mostrar predicciones y alertas
```

---

## 📊 Verificación de Limpieza

Después de ejecutar el script, verifica que las tablas estén vacías:

```sql
-- Verificar tablas transaccionales (deben estar en 0)
SELECT 'ventas_historicas' as tabla, COUNT(*) as registros FROM ventas_historicas
UNION ALL SELECT 'cotizaciones', COUNT(*) FROM cotizaciones
UNION ALL SELECT 'predicciones', COUNT(*) FROM predicciones
UNION ALL SELECT 'stock_actual', COUNT(*) FROM stock_actual;

-- Verificar configuración (deben mantener datos)
SELECT 'configuracion_sistema' as tabla, COUNT(*) as registros FROM configuracion_sistema
UNION ALL SELECT 'roles', COUNT(*) FROM roles
UNION ALL SELECT 'user_roles', COUNT(*) FROM user_roles;
```

---

## 🆘 Troubleshooting

### Error: "permission denied for table X"

**Causa:** No tienes permisos para ejecutar el script.

**Solución:** Ejecuta desde el SQL Editor de Supabase Dashboard (tiene permisos elevados).

### Error: "table X does not exist"

**Causa:** Algunas tablas pueden tener nombres diferentes en tu esquema.

**Solución:** El script usa `DO $$ BEGIN ... IF EXISTS ... END $$;` para manejar esto automáticamente.

### Error: "cannot truncate a table referenced in a foreign key constraint"

**Causa:** Hay referencias entre tablas.

**Solución:** El script usa `TRUNCATE ... CASCADE` que maneja esto automáticamente.

---

## 📝 Notas

- Los scripts usan `BEGIN/COMMIT` para transacciones seguras
- Si algo falla, se hace rollback automático
- Los IDs se resetean con `RESTART IDENTITY`
- Las relaciones CASCADE se manejan automáticamente

---

## 🔗 Referencias

- [Documentación de TRUNCATE en PostgreSQL](https://www.postgresql.org/docs/current/sql-truncate.html)
- [Supabase SQL Editor](https://supabase.com/docs/guides/database/overview)
- [PostgreSQL Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
