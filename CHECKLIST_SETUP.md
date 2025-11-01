# ✅ Checklist para Correr el Sistema Completo

**Respuesta a: "hace falta algun otro dato para correr el sistema?"**

---

## 🎯 Resumen Ejecutivo

El sistema está **95% listo**. Solo faltan configuraciones finales en Supabase y el archivo Excel con tus datos históricos.

---

## ✅ Lo que YA está hecho

### **1. Frontend (Next.js + Netlify)**
- ✅ Componentes creados (Dashboard, Filtros, StatsCards, PrediccionesTable)
- ✅ Componente de carga de Excel integrado (`UploadExcel`)
- ✅ Dependencias instaladas (incluido `xlsx` para procesar Excel)
- ✅ Configuración de rutas API en `netlify.toml`
- ✅ Servidor de desarrollo corriendo en `localhost:3000`

### **2. Backend (Netlify Functions)**
- ✅ API `/api/predicciones` - Obtener sugerencias de reposición
- ✅ API `/api/alertas` - Obtener alertas activas
- ✅ API `/api/procesar-excel` - Procesar carga masiva desde Excel

### **3. Algoritmo ML (Python)**
- ✅ `algoritmo_prophet_estacionalidad.py` - Algoritmo avanzado con Prophet
- ✅ `scripts/run_daily_forecast.py` - Pipeline de ejecución diaria
- ✅ `scripts/cargar_datos_excel.py` - Script de carga inicial

### **4. Automatización (GitHub Actions)**
- ✅ `.github/workflows/daily_forecast.yml` - Ejecución automática diaria a las 2am

---

## 🔧 Lo que FALTA hacer (4 pasos)

### **Paso 1: Configurar Supabase Storage**

Ve a tu dashboard de Supabase: https://ugabltnuwwtbpyqoptdg.supabase.co

1. **Ir a Storage** (menú lateral izquierdo)
2. **Create new bucket** con estos parámetros:
   ```
   Name: excel-uploads
   Public bucket: ✅ Marcar como público
   File size limit: 50 MB (suficiente para Excel)
   Allowed MIME types: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
   ```
3. **Save**

**¿Por qué?** El componente `UploadExcel` sube el archivo aquí temporalmente antes de procesarlo.

---

### **Paso 2: Ejecutar Schema de Base de Datos**

En Supabase → SQL Editor → New query:

1. **Abrir el archivo** `supabase_schema.sql` (está en la carpeta del proyecto)
2. **Copiar todo el contenido** y pegarlo en el SQL Editor
3. **Run** (ejecutar)

Esto crea:
- 9 tablas: `ventas_historicas`, `stock_actual`, `transito_china`, `compras_historicas`, `packs`, `skus_desconsiderar`, `predicciones`, `alertas_inventario`, `metricas_modelo`
- Índices para performance
- Row Level Security (RLS) para seguridad
- Triggers para fechas automáticas

**¿Cómo verificar que funcionó?**
```sql
-- Ejecuta esto en SQL Editor:
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';

-- Deberías ver las 9 tablas listadas
```

---

### **Paso 3: Preparar tu Archivo Excel**

Necesitas crear un archivo Excel (.xlsx) con **6 hojas específicas**:

#### **Hoja 1: "ventas"**
Columnas requeridas:
```
A = Empresa (ej: "TLT")
B = Canal (ej: "MELI")
F = Fecha (formato: DD/MM/YYYY o Excel date)
K = Unidades vendidas
T = SKU (código del producto)
U = MLC (código MercadoLibre, opcional)
V = Descripción del producto
X = Precio unitario
```

**Ejemplo:**
| Empresa | Canal | ... | Fecha      | ... | Unidades | ... | SKU     | MLC      | Descripción | Precio |
|---------|-------|-----|------------|-----|----------|-----|---------|----------|-------------|--------|
| TLT     | MELI  | ... | 15/11/2023 | ... | 5        | ... | SKU001  | MLC12345 | Producto A  | 15990  |

**Datos necesarios:**
- ✅ **Mínimo 2 años de ventas diarias** (para detectar estacionalidad)
- ✅ Solo registros de **TLT + MELI** (otros se ignoran)
- ✅ Incluir períodos de **Navidad y Black Friday**

---

#### **Hoja 2: "Stock"**
Columnas requeridas:
```
A = SKU
B = Descripción
C = Bodega C (stock)
D = Bodega D (stock)
E = Bodega E (stock)
F = Bodega F (stock)
H = Bodega H (stock)
J = Bodega J (stock)
```

**Ejemplo:**
| SKU     | Descripción | Bodega C | Bodega D | Bodega E | Bodega F | Bodega H | Bodega J |
|---------|-------------|----------|----------|----------|----------|----------|----------|
| SKU001  | Producto A  | 150      | 0        | 50       | 0        | 0        | 0        |
| SKU002  | Producto B  | 0        | 200      | 0        | 0        | 0        | 0        |

**Dato necesario:**
- ✅ **Stock actual al día de hoy**

---

#### **Hoja 3: "transito china"**
Columnas requeridas:
```
D = SKU
H = Total Units (unidades en tránsito desde China)
```

**Ejemplo:**
| ... | SKU     | ... | Total Units |
|-----|---------|-----|-------------|
| ... | SKU001  | ... | 500         |
| ... | SKU003  | ... | 1000        |

**Dato necesario:**
- ✅ **Productos que ya tienen compra en camino** (opcional, puede estar vacío)

---

#### **Hoja 4: "compras"**
Columnas requeridas:
```
A = SKU
D = Fecha de compra
```

**Ejemplo:**
| SKU     | ... | Fecha      |
|---------|-----|------------|
| SKU001  | ... | 15/01/2024 |
| SKU002  | ... | 20/01/2024 |

**Dato necesario:**
- ✅ **Historial de compras de los últimos 2 años** (para calcular frecuencia)

---

#### **Hoja 5: "Packs"**
Columnas requeridas:
```
A = SKU Pack (producto combo)
B = SKU Componente (producto individual)
C = Cantidad (cuántas unidades del componente tiene el pack)
```

**Ejemplo:**
| SKU Pack | SKU Componente | Cantidad |
|----------|----------------|----------|
| PACK001  | SKU001         | 2        |
| PACK001  | SKU002         | 1        |

**Dato necesario:**
- ✅ **Definición de packs/combos** (opcional, puede estar vacío si no vendes packs)

---

#### **Hoja 6: "desconsiderar"** (OPCIONAL)
Columnas requeridas:
```
A = SKU
```

**Ejemplo:**
| SKU     |
|---------|
| SKU999  |
| SKU888  |

**Dato necesario:**
- ✅ **SKUs descontinuados o que no quieres en las predicciones** (opcional)

---

### **Paso 4: Cargar los Datos**

**Opción A: Desde el Frontend (Recomendado)**

1. **Abre** http://localhost:3000
2. **Sube tu archivo Excel** usando el botón "Carga Masiva de Datos"
3. **Espera 1-2 minutos** mientras procesa
4. **Verifica** en Supabase que las tablas tienen datos:
   ```sql
   SELECT COUNT(*) FROM ventas_historicas;
   SELECT COUNT(*) FROM stock_actual;
   ```

**Opción B: Desde Python (Avanzado)**

```bash
# Desde la carpeta del proyecto:
python scripts/cargar_datos_excel.py ruta/a/tu/archivo.xlsx
```

---

## 🚀 Ejecución del Sistema

### **1. Primera Ejecución Manual (Forecasting)**

Después de cargar los datos, ejecuta el forecasting por primera vez:

```bash
# Configurar variables de entorno (desde .env.example)
cp .env.example .env
# Editar .env con tus llaves reales

# Ejecutar forecasting
python scripts/run_daily_forecast.py
```

**Esto generará:**
- ✅ Predicciones de venta diaria (P50, P75, P90)
- ✅ Sugerencias de reposición
- ✅ Alertas automáticas (stock crítico, etc.)
- ✅ Métricas del modelo (MAPE, MAE, RMSE)

**Tiempo estimado:** 5-15 minutos (depende de cuántos SKUs tengas)

---

### **2. Verificar Resultados en el Frontend**

1. **Refresca** http://localhost:3000
2. **Deberías ver:**
   - Cards con métricas (Total a Comprar, Valor Total, Alertas, Productos Clase A)
   - Tabla con sugerencias de reposición ordenadas por valor
   - Filtros funcionando (ABC, búsqueda, solo alertas)

---

### **3. Automatización Diaria (GitHub Actions)**

**Configurar Secrets en GitHub:**

1. Ve a tu repositorio en GitHub
2. Settings → Secrets and variables → Actions → New repository secret
3. Agrega estos secrets:
   ```
   SUPABASE_URL = https://ugabltnuwwtbpyqoptdg.supabase.co
   SUPABASE_SERVICE_KEY = tu_service_key_aqui
   ```

**¿Cómo obtener el Service Key?**
- Supabase Dashboard → Settings → API → Project API keys → `service_role` (secret)

**Resultado:**
- ✅ Cada día a las 2am UTC, GitHub Actions ejecutará el forecasting automáticamente
- ✅ Datos siempre actualizados sin intervención manual

---

## 📊 Datos Mínimos Necesarios (Resumen)

| Dato | Período | Obligatorio | Propósito |
|------|---------|-------------|-----------|
| **Ventas diarias TLT+MELI** | 2 años | ✅ Sí | Detectar estacionalidad, tendencias |
| **Stock actual** | Hoy | ✅ Sí | Calcular días de stock restantes |
| **Compras históricas** | 2 años | ⚠️ Recomendado | Calcular frecuencia de compra |
| **Tránsito China** | Hoy | ❌ Opcional | Ajustar sugerencias si hay pedidos en camino |
| **Packs** | Actual | ❌ Opcional | Solo si vendes combos |
| **Desconsiderar** | Actual | ❌ Opcional | Excluir productos descontinuados |

**Dato crítico:** Los **2 años de ventas diarias** son el corazón del sistema. Sin esto, el algoritmo no puede detectar Navidad, Black Friday, patrones semanales, etc.

---

## 🎯 Checklist Final (Marca lo que ya hiciste)

```
Setup de Supabase:
[ ] Crear bucket "excel-uploads" en Storage
[ ] Ejecutar supabase_schema.sql en SQL Editor
[ ] Verificar que las 9 tablas existen

Preparación de Datos:
[ ] Crear archivo Excel con 6 hojas
[ ] Hoja "ventas" con 2 años de datos TLT+MELI
[ ] Hoja "Stock" con stock actual
[ ] Hoja "transito china" (o vacía)
[ ] Hoja "compras" con historial
[ ] Hoja "Packs" (o vacía)
[ ] Hoja "desconsiderar" (o vacía)

Carga de Datos:
[ ] Subir Excel desde http://localhost:3000
[ ] Verificar que se cargaron registros en Supabase

Primera Ejecución:
[ ] Configurar variables en .env
[ ] Ejecutar python scripts/run_daily_forecast.py
[ ] Verificar predicciones en tabla "predicciones"

Verificación Frontend:
[ ] Refrescar localhost:3000
[ ] Ver métricas en cards
[ ] Ver sugerencias en tabla
[ ] Probar filtros (ABC, búsqueda, alertas)

Automatización (Opcional ahora):
[ ] Configurar GitHub Secrets (SUPABASE_URL, SUPABASE_SERVICE_KEY)
[ ] Verificar que workflow existe en .github/workflows/
[ ] Hacer push a GitHub
[ ] Esperar a las 2am UTC o ejecutar manualmente desde Actions
```

---

## 🐛 Troubleshooting Común

### **Error: "Bucket excel-uploads not found"**
➡️ Ve a Supabase → Storage → Create bucket "excel-uploads"

### **Error: "Table ventas_historicas does not exist"**
➡️ Ejecuta `supabase_schema.sql` en SQL Editor

### **Frontend muestra "No se encontraron predicciones"**
➡️ Ejecuta `python scripts/run_daily_forecast.py` para generar predicciones

### **Error: "excelDateToJSDate is not a function"**
➡️ La función está definida en `procesar-excel.js` líneas 283-299, verifica que el archivo esté completo

### **Ventas no se cargan (0 registros)**
➡️ Verifica que en tu Excel:
- Columna A = "TLT" (mayúsculas)
- Columna B = "MELI" (mayúsculas)
- Columna T (SKU) no esté vacía

---

## 📞 Siguiente Paso Inmediato

**1. Crear el bucket "excel-uploads" en Supabase**
   - 2 minutos

**2. Ejecutar supabase_schema.sql**
   - 1 minuto

**3. Preparar tu Excel con las 6 hojas**
   - 30-60 minutos (dependiendo de cuántos datos tengas)

**4. Subir el Excel desde localhost:3000**
   - 2 minutos

**5. Ejecutar forecasting: `python scripts/run_daily_forecast.py`**
   - 10 minutos

**Total:** ~1 hora para tener el sistema funcionando completamente.

---

## 🎉 Cuando Todo Esté Listo

Verás en http://localhost:3000:

1. **Card "Total a Comprar"**: Suma de todas las sugerencias (ej: 15,000 unidades)
2. **Card "Valor Total"**: Cuánto dinero necesitas para comprar (ej: $12,500,000 CLP)
3. **Card "Alertas Activas"**: Productos con stock crítico (ej: 8 alertas)
4. **Card "Productos Clase A"**: Top productos que generan 80% de ingresos (ej: 45 SKUs)
5. **Tabla con sugerencias**: Click en cualquier SKU → detalle completo

---

**¿Alguna duda sobre los datos del Excel o la configuración de Supabase?**
