# 🔧 ARREGLAR ERROR 406 - RLS

## ❌ Error actual:
```
GET .../predicciones?select=fecha_calculo&order=fecha_calculo.desc&limit=1 406 (Not Acceptable)
```

## ✅ Solución (2 minutos):

### Paso 1: Ir a Supabase SQL Editor
👉 https://supabase.com/dashboard/project/ugabltnuwwtbpyqoptdg/sql/new

### Paso 2: Copiar y pegar este SQL:
```sql
ALTER TABLE predicciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE metricas_modelo DISABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_inventario DISABLE ROW LEVEL SECURITY;
```

### Paso 3: Click en "RUN" (botón verde) o presionar Ctrl+Enter

### Paso 4: Refrescar el dashboard
👉 https://sistemadegestion.net

## ¿Por qué necesito hacer esto?

RLS (Row Level Security) está bloqueando el acceso público a las tablas de predicciones.
El dashboard usa la `anon key` y necesita acceso de lectura a estas tablas.

**Son solo 3 líneas de SQL** ⬆️

---

Una vez que ejecutes el SQL, el error 406 desaparecerá inmediatamente.
