# 🔧 Corrección: Fórmula de Cantidad Sugerida

## ❌ Fórmula INCORRECTA (Documentación Anterior)

```
Cantidad Sugerida = MAX(0, Stock Objetivo - Stock Actual - Stock en Tránsito)
```

### Problema:
Esta fórmula **NO considera el consumo durante el lead time**, lo que genera cálculos incorrectos.

### Ejemplo del error:
```
Datos:
- Stock Objetivo: 750 unidades
- Stock Actual: 200 unidades
- Stock en Tránsito: 150 unidades

Cálculo incorrecto:
Cantidad Sugerida = 750 - 200 - 150 = 400 unidades

❌ INCORRECTO: No considera que mientras esperas el próximo pedido,
seguirás vendiendo y consumiendo stock.
```

---

## ✅ Fórmula CORRECTA (Implementación Real del Sistema)

```
Paso 1: Calcular consumo durante el lead time
Consumo Durante Lead Time = Venta Diaria × Lead Time (días)

Paso 2: Calcular stock proyectado a la llegada
Stock Proyectado = Stock Actual + Stock en Tránsito - Consumo Durante Lead Time

Paso 3: Calcular cantidad sugerida
Si Stock Proyectado < 0:
    Cantidad Sugerida = Stock Objetivo
Sino:
    Cantidad Sugerida = MAX(0, Stock Objetivo - Stock Proyectado)
```

### Ejemplo correcto:

```
Datos:
- Venta Diaria: 5 unidades/día
- Lead Time: 90 días
- Stock Saludable: 60 días
- Stock Actual: 200 unidades
- Stock en Tránsito: 150 unidades

Paso 1: Stock Objetivo
Stock Objetivo = 5 × 60 = 300 unidades

Paso 2: Consumo Durante Lead Time
Consumo = 5 × 90 = 450 unidades

Paso 3: Stock Proyectado
Stock Proyectado = 200 + 150 - 450 = -100 unidades (NEGATIVO)

Paso 4: Cantidad Sugerida
Como Stock Proyectado < 0:
Cantidad Sugerida = 300 unidades (Stock Objetivo completo)

✅ CORRECTO: El sistema detecta que tu stock se agotará ANTES
de que llegue la próxima orden, por lo que necesitas el stock
objetivo completo.
```

---

## 📊 Comparación de Resultados

### Escenario 1: Stock Proyectado Negativo

| Concepto | Valor |
|----------|-------|
| Venta Diaria | 5 unidades/día |
| Lead Time | 90 días |
| Stock Saludable | 60 días |
| Stock Actual | 200 unidades |
| Stock en Tránsito | 150 unidades |
| **Stock Objetivo** | **300 unidades** |
| **Consumo Lead Time** | **450 unidades** |
| **Stock Proyectado** | **-100 unidades** |
| | |
| **Fórmula Incorrecta** | 750 - 200 - 150 = **400 unidades** ❌ |
| **Fórmula Correcta** | **300 unidades** (Stock Objetivo) ✅ |

---

### Escenario 2: Stock Proyectado Positivo

| Concepto | Valor |
|----------|-------|
| Venta Diaria | 1 unidad/día |
| Lead Time | 90 días |
| Stock Saludable | 60 días |
| Stock Actual | 100 unidades |
| Stock en Tránsito | 50 unidades |
| **Stock Objetivo** | **60 unidades** |
| **Consumo Lead Time** | **90 unidades** |
| **Stock Proyectado** | **60 unidades** |
| | |
| **Fórmula Incorrecta** | 60 - 100 - 50 = **0 unidades** ❌ (parece correcto por casualidad) |
| **Fórmula Correcta** | MAX(0, 60 - 60) = **0 unidades** ✅ |

---

## 🔍 ¿Por Qué es Importante?

### Impacto de usar la fórmula incorrecta:

1. **Sobre-ordenar productos**
   - Inmovilizas capital innecesariamente
   - Ocupas espacio de almacenamiento
   - Riesgo de obsolescencia

2. **Sub-ordenar productos**
   - Quiebre de stock inminente
   - Pérdida de ventas
   - Clientes insatisfechos

3. **Mala proyección de flujo de caja**
   - Planificación financiera incorrecta
   - Problemas de liquidez

---

## 💡 Explicación Intuitiva

### ¿Qué significa "Stock Proyectado a la Llegada"?

Es el stock que tendrás cuando llegue tu próxima orden.

**Fórmula:**
```
Stock Proyectado = Lo que tienes ahora
                 + Lo que viene en camino
                 - Lo que venderás mientras esperas
```

### Casos:

#### Caso A: Stock Proyectado NEGATIVO
```
Stock Actual: 200
Stock en Tránsito: 150
Consumo Lead Time: 450

Stock Proyectado = 200 + 150 - 450 = -100

Interpretación:
"¡Vas a quedarte sin stock! Necesitas ordenar urgente."

Por eso la Cantidad Sugerida = Stock Objetivo completo
```

#### Caso B: Stock Proyectado POSITIVO
```
Stock Actual: 100
Stock en Tránsito: 50
Consumo Lead Time: 90

Stock Proyectado = 100 + 50 - 90 = 60

Interpretación:
"Cuando llegue tu pedido, tendrás 60 unidades. Si tu objetivo
es 60 días de stock (60 unidades), ya estás cubierto."

Por eso la Cantidad Sugerida = 0
```

---

## 📝 Archivos Actualizados

Los siguientes archivos fueron corregidos con la fórmula correcta:

1. ✅ `MANUAL_SISTEMA_INTERACTIVO.html`
   - Sección "Cálculos del Sistema"
   - Calculadora interactiva
   - Ejemplos con ambos escenarios

2. ✅ `README_DOCUMENTACION.md`
   - Sección "Conceptos Clave"
   - Fórmula de Cantidad Sugerida

3. ✅ `CASOS_DE_USO_PRACTICOS.md`
   - (No contenía la fórmula incorrecta)

---

## 🧮 Prueba la Calculadora Corregida

**Ubicación:** `MANUAL_SISTEMA_INTERACTIVO.html`

1. Abre el archivo en tu navegador
2. Ve a la pestaña "Calculadora"
3. Prueba estos valores:

**Escenario 1: Stock Proyectado Negativo**
- Venta Diaria: 5
- Lead Time: 90
- Stock Saludable: 60
- Stock Actual: 200
- Stock en Tránsito: 150

**Resultado esperado:**
- Stock Objetivo: 300
- Consumo: 450
- Stock Proyectado: -100 ⚠️
- Cantidad Sugerida: **300 unidades**

**Escenario 2: Stock Proyectado Positivo**
- Venta Diaria: 1
- Lead Time: 90
- Stock Saludable: 60
- Stock Actual: 100
- Stock en Tránsito: 50

**Resultado esperado:**
- Stock Objetivo: 60
- Consumo: 90
- Stock Proyectado: 60
- Cantidad Sugerida: **0 unidades**

---

## ✅ Verificación en el Código

La implementación correcta ya existe en el código del sistema:

**Archivo:** `pages/api/analysis-cached.js` (líneas 380-401)

```javascript
// Calculate stock objetivo
const stockObjetivo = Math.round(ventaDiaria * stockSaludableMinDias);

// Calculate consumo durante lead time
const consumoDuranteLeadTime = Math.round(ventaDiaria * leadTimeDias);

// Calculate stock proyectado a la llegada
const stockProyectadoLlegada = stockActual + stockEnTransito - consumoDuranteLeadTime;

// Calculate cantidad sugerida
if (stockProyectadoLlegada < 0) {
    // Si el stock proyectado es negativo, necesitamos el stock objetivo completo
    cantidadSugerida = stockObjetivo;
} else {
    // Si el stock proyectado es positivo, solo necesitamos la diferencia
    cantidadSugerida = Math.max(0, stockObjetivo - stockProyectadoLlegada);
}
```

**✅ El código siempre ha sido correcto. Solo la documentación estaba incorrecta.**

---

## 📚 Recursos Adicionales

- [Manual Interactivo](./MANUAL_SISTEMA_INTERACTIVO.html) - Sección "Cálculos"
- [README](./README_DOCUMENTACION.md) - Conceptos Clave
- Código fuente: `pages/api/analysis-cached.js`

---

**Fecha de Corrección:** 16 de enero de 2025
**Versión:** 1.1
**Estado:** ✅ Documentación corregida y alineada con el código real
