# 🎨 Frontend - Sistema de Predicción de Inventario

Frontend rápido y sencillo construido con **Next.js 14 + Tailwind CSS** optimizado para Netlify.

---

## 🚀 Quick Start

### **1. Instalar dependencias**
```bash
npm install
```

### **2. Configurar variables de entorno**

Crea un archivo `.env.local` (ya existe, pero verifica):

```env
NEXT_PUBLIC_SUPABASE_URL=https://ugabltnuwwtbpyqoptdg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

### **3. Ejecutar en desarrollo**
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

### **4. Build para producción**
```bash
npm run build
```

Esto genera un export estático en `/out` listo para Netlify.

---

## 📁 Estructura del Proyecto

```
sistema/
├── app/
│   ├── layout.tsx          # Layout principal con header/footer
│   ├── page.tsx            # Dashboard principal
│   ├── globals.css         # Estilos globales + Tailwind
│   └── sku/
│       └── [id]/
│           └── page.tsx    # Página de detalle por SKU
├── components/
│   ├── StatsCards.tsx      # Cards de métricas principales
│   ├── Filtros.tsx         # Barra de filtros
│   └── PrediccionesTable.tsx  # Tabla de sugerencias
├── netlify/
│   └── functions/          # API Functions (ya creadas)
├── public/                 # Assets estáticos
├── next.config.js          # Configuración Next.js
├── tailwind.config.ts      # Configuración Tailwind
└── package.json
```

---

## 🎯 Funcionalidades

### **Dashboard Principal** (`/`)
- ✅ **4 Cards de métricas clave**:
  - Total a comprar (unidades)
  - Valor total (CLP)
  - Alertas activas
  - Productos clase A

- ✅ **Filtros rápidos**:
  - Búsqueda por SKU
  - Clasificación ABC (A/B/C)
  - Solo con alertas

- ✅ **Tabla de sugerencias**:
  - Ordenada por valor total
  - Muestra: SKU, clase, venta diaria, stock, días stock, sugerencia
  - Colores según urgencia (rojo < 60 días, amarillo < 120 días)
  - Click en SKU → detalle

### **Detalle por SKU** (`/sku/[id]`)
- ✅ **Sugerencia principal**: 3 escenarios (P50, P75, P90)
- ✅ **Métricas de venta**: Promedio, P50, P90, desviación, variabilidad
- ✅ **Stock actual**: Días, tránsito, óptimo, seguridad
- ✅ **Tendencia**: Creciente/decreciente, tasa mensual
- ✅ **Modelo**: Tipo usado, MAPE (accuracy)
- ✅ **Componentes Prophet**: Tendencia, anual, semanal, eventos (si aplica)
- ✅ **Alertas**: Destacadas en rojo

---

## 🎨 Diseño

### **Stack**
- **Next.js 14**: App Router, React Server Components
- **Tailwind CSS**: Styling utility-first
- **Supabase Client**: Conexión directa a DB

### **Características**
- ⚡ **Rápido**: Static export, carga instantánea
- 📱 **Responsive**: Mobile-first design
- 🎨 **Clean UI**: Sin distracciones, enfocado en datos
- 🚀 **Optimizado**: Bundle pequeño, Tailwind purging

### **Colores**
- Clase A: Rojo (alta prioridad)
- Clase B: Amarillo (media)
- Clase C: Gris (baja)
- Stock crítico (<60 días): Rojo
- Stock bajo (<120 días): Amarillo
- Stock OK: Verde

---

## 🔗 Integración con Backend

### **Conexión a Supabase**
El frontend se conecta **directamente** a Supabase usando el client de JavaScript:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Query de ejemplo
const { data } = await supabase
  .from('predicciones')
  .select('*')
  .order('valor_total_sugerencia', { ascending: false })
  .limit(100)
```

### **Datos en tiempo real**
Siempre muestra la **última ejecución** del forecasting:

1. Busca fecha_calculo más reciente
2. Filtra predicciones de esa fecha
3. Las muestra ordenadas

**No hay cache**, siempre datos frescos.

---

## 📊 Performance

### **Lighthouse Score (Target)**
- ⚡ Performance: 95+
- ♿ Accessibility: 90+
- 🎯 Best Practices: 95+
- 🔍 SEO: 90+

### **Optimizaciones aplicadas**
- ✅ Static export (sin SSR overhead)
- ✅ Tailwind purging (CSS mínimo)
- ✅ No hay imágenes externas
- ✅ Client-side fetching directo a Supabase
- ✅ Componentes memoizados

---

## 🚀 Deploy en Netlify

### **Opción 1: Conectar GitHub (Automático)**

1. **Conecta tu repo a Netlify**
   - Ve a https://app.netlify.com
   - "Add new site" → "Import from Git"
   - Conecta tu repo de GitHub

2. **Configuración de build**
   ```
   Build command: npm run build
   Publish directory: out
   ```

3. **Variables de entorno**
   En Netlify → Site settings → Environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://ugabltnuwwtbpyqoptdg.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = tu_anon_key
   ```

4. **Deploy!**
   Cada push a `main` → deploy automático

### **Opción 2: Deploy Manual**

```bash
# Instalar Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
npm run build
netlify deploy --prod --dir=out
```

---

## 🔧 Desarrollo

### **Comandos disponibles**
```bash
npm run dev        # Desarrollo (localhost:3000)
npm run build      # Build producción
npm run start      # Servir build local
npm run lint       # Linter
```

### **Agregar nueva página**
```typescript
// app/nueva-pagina/page.tsx
export default function NuevaPagina() {
  return <div>Contenido</div>
}
```

Automáticamente disponible en `/nueva-pagina`

### **Agregar nuevo componente**
```typescript
// components/MiComponente.tsx
export default function MiComponente() {
  return <div>Componente</div>
}
```

Importar:
```typescript
import MiComponente from '@/components/MiComponente'
```

---

## 🎯 Próximas Mejoras (Opcionales)

### **Corto plazo**
- [ ] Gráficos (Chart.js o Recharts)
- [ ] Export a Excel/CSV
- [ ] Notificaciones push
- [ ] Dark mode

### **Medio plazo**
- [ ] Dashboard de métricas de modelo (MAPE por categoría)
- [ ] Comparación histórica (sugerencia vs realidad)
- [ ] Filtros avanzados (por bodega, por rango de días)
- [ ] Búsqueda fuzzy

### **Largo plazo**
- [ ] Autenticación (login/logout)
- [ ] Multi-tenant (múltiples clientes)
- [ ] Chat con IA para insights
- [ ] Mobile app (React Native)

---

## 🐛 Troubleshooting

### **Error: "Cannot find module '@/components/...'"**
Asegúrate de tener en `tsconfig.json`:
```json
"paths": {
  "@/*": ["./*"]
}
```

### **Error: "NEXT_PUBLIC_SUPABASE_URL is not defined"**
Verifica `.env.local` existe y tiene las variables correctas.

### **Página en blanco después de build**
Verifica `next.config.js` tiene:
```javascript
output: 'export'
```

### **Estilos no se aplican**
Asegúrate de importar `globals.css` en `layout.tsx`:
```typescript
import './globals.css'
```

---

## 📝 Notas Técnicas

### **¿Por qué Next.js en modo export?**
- ✅ Netlify lo soporta nativamente (static hosting)
- ✅ No necesita servidor Node.js corriendo
- ✅ Más rápido (solo HTML/CSS/JS estáticos)
- ✅ Más barato (free tier)

### **¿Por qué Supabase client directo?**
- ✅ Menos overhead que Netlify Functions
- ✅ Latencia más baja
- ✅ Row Level Security en Supabase
- ✅ Realtime si lo necesitas después

### **¿Dónde está el routing?**
Next.js 14 usa **file-based routing** en la carpeta `app/`:
- `app/page.tsx` → `/`
- `app/sku/[id]/page.tsx` → `/sku/SKU001`

---

## 🎉 Sistema Completo

**Este frontend se conecta a:**
1. ✅ Supabase (base de datos)
2. ✅ Netlify Functions (API opcional)
3. ✅ GitHub Actions (forecasting diario)

**Todo funcionando en armonía:**
```
GitHub Actions (2am)
  ↓ Ejecuta forecasting
  ↓ Guarda en Supabase
  ↓
Frontend Next.js (Netlify)
  ↓ Lee de Supabase
  ↓ Muestra al usuario
```

---

**¡Frontend listo! 🚀**

**URL de ejemplo:** https://tu-sitio.netlify.app
