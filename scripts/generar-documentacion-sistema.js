#!/usr/bin/env node

/**
 * 📋 GENERADOR DE DOCUMENTACIÓN DEL SISTEMA
 *
 * Script automatizado que analiza el sistema completo y genera
 * documentación detallada para desarrolladores que necesiten
 * entender, mantener o cotizar cambios en el sistema.
 *
 * Genera análisis de:
 * - Arquitectura y tecnologías
 * - Base de datos y APIs
 * - Funcionalidades principales
 * - Complejidad y estimaciones
 *
 * Uso: node scripts/generar-documentacion-sistema.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuración del análisis
const CONFIG = {
  outputFile: 'DOCUMENTACION_SISTEMA_COMPLETA.md',
  includeCodeSamples: true,
  analyzeComplexity: true,
  includeEstimates: true,
  timestamp: new Date().toISOString()
};

// Utilidades
const utils = {
  // Leer archivo de forma segura
  readFileSafe: (filePath) => {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      return null;
    }
  },

  // Obtener archivos en directorio
  getFilesInDir: (dir, extension = null) => {
    try {
      const files = fs.readdirSync(dir);
      return extension
        ? files.filter(f => f.endsWith(extension))
        : files;
    } catch (error) {
      return [];
    }
  },

  // Contar líneas de código
  countLines: (content) => {
    if (!content) return 0;
    return content.split('\n').filter(line =>
      line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('/*')
    ).length;
  },

  // Extraer imports/dependencias
  extractImports: (content) => {
    if (!content) return [];
    const imports = [];
    const importRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g;
    const requireRegex = /require\(['"`]([^'"`]+)['"`]\)/g;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return [...new Set(imports)];
  },

  // Estimar complejidad
  estimateComplexity: (content) => {
    if (!content) return 'Bajo';

    const lines = content.split('\n').length;
    const functions = (content.match(/function|=>/g) || []).length;
    const asyncOps = (content.match(/async|await|Promise/g) || []).length;
    const dbOps = (content.match(/supabase|query|select|insert|update|delete/gi) || []).length;

    const complexity = lines + (functions * 2) + (asyncOps * 3) + (dbOps * 2);

    if (complexity > 500) return 'Muy Alto';
    if (complexity > 300) return 'Alto';
    if (complexity > 150) return 'Medio';
    return 'Bajo';
  }
};

// Analizadores específicos
const analyzers = {
  // Analizar package.json y dependencias
  analyzeProject: () => {
    const packageJson = utils.readFileSafe('package.json');
    if (!packageJson) return null;

    const pkg = JSON.parse(packageJson);

    return {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description || 'Sistema de Gestión de Inventario',
      dependencies: Object.keys(pkg.dependencies || {}),
      devDependencies: Object.keys(pkg.devDependencies || {}),
      scripts: Object.keys(pkg.scripts || {}),
      totalDeps: Object.keys({...pkg.dependencies, ...pkg.devDependencies}).length
    };
  },

  // Analizar APIs
  analyzeAPIs: () => {
    const apiDir = 'pages/api';
    const apiFiles = utils.getFilesInDir(apiDir, '.js');

    const apis = apiFiles.map(file => {
      const content = utils.readFileSafe(path.join(apiDir, file));
      const imports = utils.extractImports(content);
      const complexity = utils.estimateComplexity(content);
      const lines = utils.countLines(content);

      // Detectar métodos HTTP
      const methods = [];
      if (content?.includes("req.method === 'GET'")) methods.push('GET');
      if (content?.includes("req.method === 'POST'")) methods.push('POST');
      if (content?.includes("req.method === 'PUT'")) methods.push('PUT');
      if (content?.includes("req.method === 'PATCH'")) methods.push('PATCH');
      if (content?.includes("req.method === 'DELETE'")) methods.push('DELETE');

      // Detectar operaciones de base de datos
      const dbOperations = [];
      if (content?.includes('.select(')) dbOperations.push('SELECT');
      if (content?.includes('.insert(')) dbOperations.push('INSERT');
      if (content?.includes('.update(')) dbOperations.push('UPDATE');
      if (content?.includes('.delete(')) dbOperations.push('DELETE');

      return {
        name: file.replace('.js', ''),
        file: file,
        methods: methods,
        dbOperations: dbOperations,
        imports: imports,
        complexity: complexity,
        lines: lines,
        hasAuth: content?.includes('auth') || content?.includes('token'),
        hasCache: content?.includes('cache'),
        isAsync: content?.includes('async')
      };
    });

    return {
      total: apis.length,
      apis: apis,
      complexity: {
        bajo: apis.filter(a => a.complexity === 'Bajo').length,
        medio: apis.filter(a => a.complexity === 'Medio').length,
        alto: apis.filter(a => a.complexity === 'Alto').length,
        muyAlto: apis.filter(a => a.complexity === 'Muy Alto').length
      }
    };
  },

  // Analizar componentes React
  analyzeComponents: () => {
    const componentDir = 'components';
    const componentFiles = utils.getFilesInDir(componentDir, '.js');

    const components = componentFiles.map(file => {
      const content = utils.readFileSafe(path.join(componentDir, file));
      const imports = utils.extractImports(content);
      const complexity = utils.estimateComplexity(content);
      const lines = utils.countLines(content);

      return {
        name: file.replace('.js', ''),
        file: file,
        imports: imports,
        complexity: complexity,
        lines: lines,
        hasState: content?.includes('useState'),
        hasEffect: content?.includes('useEffect'),
        hasContext: content?.includes('useContext') || content?.includes('Context'),
        hasAPI: content?.includes('fetch') || content?.includes('axios')
      };
    });

    return {
      total: components.length,
      components: components
    };
  },

  // Analizar páginas
  analyzePages: () => {
    const pagesDir = 'pages';
    const pageFiles = utils.getFilesInDir(pagesDir, '.js').filter(f => !f.startsWith('_'));

    const pages = pageFiles.map(file => {
      const content = utils.readFileSafe(path.join(pagesDir, file));
      const imports = utils.extractImports(content);
      const complexity = utils.estimateComplexity(content);
      const lines = utils.countLines(content);

      return {
        name: file.replace('.js', ''),
        file: file,
        imports: imports,
        complexity: complexity,
        lines: lines,
        hasAuth: content?.includes('useUser') || content?.includes('auth'),
        hasRouter: content?.includes('useRouter'),
        hasSWR: content?.includes('useSWR')
      };
    });

    return {
      total: pages.length,
      pages: pages
    };
  },

  // Analizar base de datos
  analyzeDatabase: () => {
    const sqlDir = 'sql';
    const sqlFiles = utils.getFilesInDir(sqlDir, '.sql');

    const tables = [];
    const schemas = sqlFiles.map(file => {
      const content = utils.readFileSafe(path.join(sqlDir, file));
      const lines = utils.countLines(content);

      // Extraer nombres de tablas
      const tableMatches = content?.match(/CREATE TABLE.*?(\w+)/gi) || [];
      tableMatches.forEach(match => {
        const tableName = match.replace(/CREATE TABLE.*?IF NOT EXISTS\s*/i, '').replace(/CREATE TABLE\s*/i, '').trim();
        if (tableName && !tables.includes(tableName)) {
          tables.push(tableName);
        }
      });

      return {
        name: file,
        lines: lines,
        content: content?.substring(0, 200) + '...'
      };
    });

    return {
      totalSchemas: schemas.length,
      estimatedTables: tables.length,
      schemas: schemas,
      detectedTables: tables
    };
  },

  // Analizar scripts
  analyzeScripts: () => {
    const scriptsDir = 'scripts';
    const scriptFiles = utils.getFilesInDir(scriptsDir, '.js');

    const scripts = scriptFiles.map(file => {
      const content = utils.readFileSafe(path.join(scriptsDir, file));
      const imports = utils.extractImports(content);
      const complexity = utils.estimateComplexity(content);
      const lines = utils.countLines(content);

      return {
        name: file.replace('.js', ''),
        file: file,
        imports: imports,
        complexity: complexity,
        lines: lines,
        isUtility: content?.includes('utility') || content?.includes('helper'),
        isMigration: content?.includes('migration') || content?.includes('migrate'),
        isSetup: content?.includes('setup') || content?.includes('install')
      };
    });

    return {
      total: scripts.length,
      scripts: scripts
    };
  }
};

// Estimador de costos/tiempo
const estimator = {
  // Estimar horas de desarrollo basado en complejidad
  estimateHours: (complexity, lines) => {
    const baseHours = {
      'Bajo': 0.5,
      'Medio': 1.5,
      'Alto': 4,
      'Muy Alto': 8
    };

    const base = baseHours[complexity] || 1;
    const lineMultiplier = Math.max(1, Math.floor(lines / 100));

    return Math.round(base * lineMultiplier * 10) / 10;
  },

  // Estimar costo basado en horas
  estimateCost: (hours, hourlyRate = 25000) => {
    return Math.round(hours * hourlyRate);
  },

  // Generar estimaciones por módulo
  generateModuleEstimates: (analysis) => {
    const estimates = {};

    // APIs
    if (analysis.apis) {
      estimates.apis = {
        totalHours: 0,
        items: []
      };

      analysis.apis.apis.forEach(api => {
        const hours = estimator.estimateHours(api.complexity, api.lines);
        const cost = estimator.estimateCost(hours);

        estimates.apis.items.push({
          name: api.name,
          hours: hours,
          cost: cost,
          complexity: api.complexity
        });

        estimates.apis.totalHours += hours;
      });

      estimates.apis.totalCost = estimator.estimateCost(estimates.apis.totalHours);
    }

    // Componentes
    if (analysis.components) {
      estimates.components = {
        totalHours: 0,
        items: []
      };

      analysis.components.components.forEach(comp => {
        const hours = estimator.estimateHours(comp.complexity, comp.lines);
        const cost = estimator.estimateCost(hours);

        estimates.components.items.push({
          name: comp.name,
          hours: hours,
          cost: cost,
          complexity: comp.complexity
        });

        estimates.components.totalHours += hours;
      });

      estimates.components.totalCost = estimator.estimateCost(estimates.components.totalHours);
    }

    return estimates;
  }
};

// Generador del reporte
const reportGenerator = {
  // Generar markdown completo
  generate: (analysis) => {
    const project = analysis.project;
    const estimates = estimator.generateModuleEstimates(analysis);

    let report = `# 📋 DOCUMENTACIÓN COMPLETA DEL SISTEMA

## 📊 Resumen Ejecutivo

**Nombre del Proyecto:** ${project?.name || 'Sistema de Gestión de Inventario'}
**Versión:** ${project?.version || '1.0.0'}
**Fecha de Análisis:** ${new Date().toLocaleDateString('es-ES')}
**Generado Automáticamente:** ${CONFIG.timestamp}

### 🎯 Propósito del Sistema
Sistema web completo para gestión de inventario con funcionalidades avanzadas de análisis, predicción y automatización de procesos de compra y reposición.

### 📈 Métricas Generales
- **Total de APIs:** ${analysis.apis?.total || 0}
- **Total de Componentes:** ${analysis.components?.total || 0}
- **Total de Páginas:** ${analysis.pages?.total || 0}
- **Total de Scripts:** ${analysis.scripts?.total || 0}
- **Dependencias:** ${project?.totalDeps || 0}

---

## 🏗️ ARQUITECTURA TÉCNICA

### Stack Tecnológico Principal
\`\`\`
Framework: Next.js ${project?.dependencies?.includes('next') ? '✅' : '❌'}
Base de Datos: Supabase/PostgreSQL ${project?.dependencies?.includes('@supabase/supabase-js') ? '✅' : '❌'}
Frontend: React ${project?.dependencies?.includes('react') ? '✅' : '❌'}
Estilos: Tailwind CSS ${project?.dependencies?.includes('tailwindcss') ? '✅' : '❌'}
Estado: React Context + SWR ${project?.dependencies?.includes('swr') ? '✅' : '❌'}
Autenticación: Custom + JWT ${project?.dependencies?.includes('jsonwebtoken') ? '✅' : '❌'}
\`\`\`

### Dependencias Críticas
${project?.dependencies?.map(dep => `- **${dep}**`).join('\n') || 'No detectadas'}

### Dependencias de Desarrollo
${project?.devDependencies?.map(dep => `- **${dep}**`).join('\n') || 'No detectadas'}

---

## 🔌 APIs Y ENDPOINTS

### Resumen de APIs (${analysis.apis?.total || 0} endpoints)

| Complejidad | Cantidad | Porcentaje |
|-------------|----------|------------|
| Bajo | ${analysis.apis?.complexity?.bajo || 0} | ${Math.round((analysis.apis?.complexity?.bajo || 0) / (analysis.apis?.total || 1) * 100)}% |
| Medio | ${analysis.apis?.complexity?.medio || 0} | ${Math.round((analysis.apis?.complexity?.medio || 0) / (analysis.apis?.total || 1) * 100)}% |
| Alto | ${analysis.apis?.complexity?.alto || 0} | ${Math.round((analysis.apis?.complexity?.alto || 0) / (analysis.apis?.total || 1) * 100)}% |
| Muy Alto | ${analysis.apis?.complexity?.muyAlto || 0} | ${Math.round((analysis.apis?.complexity?.muyAlto || 0) / (analysis.apis?.total || 1) * 100)}% |

### Detalle de Endpoints Principales

${analysis.apis?.apis?.map(api => `
#### \`/api/${api.name}\`
- **Métodos:** ${api.methods.join(', ') || 'No detectados'}
- **Operaciones DB:** ${api.dbOperations.join(', ') || 'Ninguna'}
- **Complejidad:** ${api.complexity}
- **Líneas de código:** ${api.lines}
- **Características:**
  ${api.hasAuth ? '  - 🔐 Requiere autenticación' : ''}
  ${api.hasCache ? '  - 💾 Usa caché' : ''}
  ${api.isAsync ? '  - ⚡ Operaciones asíncronas' : ''}
`).join('\n') || 'No hay APIs detectadas'}

---

## 🖼️ COMPONENTES FRONTEND

### Componentes React (${analysis.components?.total || 0} componentes)

${analysis.components?.components?.map(comp => `
#### \`${comp.name}\`
- **Complejidad:** ${comp.complexity}
- **Líneas:** ${comp.lines}
- **Características:**
  ${comp.hasState ? '  - 🔄 Manejo de estado (useState)' : ''}
  ${comp.hasEffect ? '  - ⚡ Efectos secundarios (useEffect)' : ''}
  ${comp.hasContext ? '  - 🌐 Context API' : ''}
  ${comp.hasAPI ? '  - 📡 Llamadas a API' : ''}
`).join('\n') || 'No hay componentes detectados'}

---

## 📄 PÁGINAS Y RUTAS

### Páginas del Sistema (${analysis.pages?.total || 0} páginas)

${analysis.pages?.pages?.map(page => `
#### \`/${page.name}\`
- **Complejidad:** ${page.complexity}
- **Líneas:** ${page.lines}
- **Características:**
  ${page.hasAuth ? '  - 🔐 Requiere autenticación' : ''}
  ${page.hasRouter ? '  - 🗺️ Navegación (useRouter)' : ''}
  ${page.hasSWR ? '  - 📊 Data fetching (SWR)' : ''}
`).join('\n') || 'No hay páginas detectadas'}

---

## 🗄️ BASE DE DATOS

### Esquemas SQL (${analysis.database?.totalSchemas || 0} archivos)

**Tablas Estimadas:** ${analysis.database?.estimatedTables || 0}

#### Tablas Detectadas:
${analysis.database?.detectedTables?.map(table => `- **${table}**`).join('\n') || 'No detectadas automáticamente'}

#### Archivos de Schema:
${analysis.database?.schemas?.map(schema => `
- **${schema.name}** (${schema.lines} líneas)
`).join('\n') || 'No hay esquemas detectados'}

---

## 🔧 SCRIPTS Y UTILIDADES

### Scripts Disponibles (${analysis.scripts?.total || 0} scripts)

${analysis.scripts?.scripts?.map(script => `
#### \`${script.name}\`
- **Tipo:** ${script.isMigration ? 'Migración' : script.isSetup ? 'Configuración' : script.isUtility ? 'Utilidad' : 'General'}
- **Complejidad:** ${script.complexity}
- **Líneas:** ${script.lines}
`).join('\n') || 'No hay scripts detectados'}

---

## 💰 ESTIMACIONES DE DESARROLLO

⚠️ **Nota:** Estas estimaciones son aproximadas y pueden variar según la experiencia del desarrollador y requisitos específicos.

### Costos por Módulo

#### APIs (${estimates.apis?.totalHours || 0} horas estimadas)
${estimates.apis?.items?.map(item => `
- **${item.name}:** ${item.hours}h - $${item.cost.toLocaleString('es-CL')} CLP (${item.complexity})`).join('\n') || 'No calculado'}

**Total APIs:** ${estimates.apis?.totalHours || 0} horas - **$${(estimates.apis?.totalCost || 0).toLocaleString('es-CL')} CLP**

#### Componentes (${estimates.components?.totalHours || 0} horas estimadas)
${estimates.components?.items?.map(item => `
- **${item.name}:** ${item.hours}h - $${item.cost.toLocaleString('es-CL')} CLP (${item.complexity})`).join('\n') || 'No calculado'}

**Total Componentes:** ${estimates.components?.totalHours || 0} horas - **$${(estimates.components?.totalCost || 0).toLocaleString('es-CL')} CLP**

### 📊 Resumen de Costos

| Módulo | Horas | Costo (CLP) |
|--------|-------|-------------|
| APIs | ${estimates.apis?.totalHours || 0}h | $${(estimates.apis?.totalCost || 0).toLocaleString('es-CL')} |
| Componentes | ${estimates.components?.totalHours || 0}h | $${(estimates.components?.totalCost || 0).toLocaleString('es-CL')} |
| **TOTAL ESTIMADO** | **${(estimates.apis?.totalHours || 0) + (estimates.components?.totalHours || 0)}h** | **$${((estimates.apis?.totalCost || 0) + (estimates.components?.totalCost || 0)).toLocaleString('es-CL')}** |

---

## 🎯 FUNCIONALIDADES PRINCIPALES

### Core Features Detectadas:

1. **🔐 Sistema de Autenticación**
   - Login multi-modal (código, email/password)
   - Gestión de usuarios y roles
   - Sesiones persistentes

2. **📊 Dashboard de Análisis**
   - Análisis de inventario en tiempo real
   - Predicciones de reposición
   - Cálculos de impacto económico

3. **🛒 Gestión de Productos**
   - CRUD completo de productos
   - Sistema de SKUs automático
   - Tracking de estados

4. **📈 Sistema de Compras**
   - Workflow de cotizaciones
   - Seguimiento de órdenes
   - Estados de manufactura y envío

5. **🔄 Caché y Optimización**
   - Sistema de caché multinivel
   - Análisis en background
   - Optimización de consultas

6. **🌐 Integraciones Externas**
   - MercadoLibre API
   - Webhooks automatizados
   - Sincronización de órdenes

---

## 🚀 RECOMENDACIONES PARA DESARROLLADORES

### Para Mantenimiento:
1. **Familiarizarse con Next.js y React**
2. **Entender el modelo de datos de Supabase**
3. **Revisar el sistema de caché implementado**
4. **Documentar cambios en esquemas SQL**

### Para Nuevas Funcionalidades:
1. **Seguir patrones establecidos en APIs existentes**
2. **Usar el sistema de Context para estado global**
3. **Implementar caché para operaciones costosas**
4. **Mantener consistencia en estilos con Tailwind**

### Para Debugging:
1. **Revisar logs en Supabase**
2. **Usar herramientas de desarrollo de React**
3. **Monitorear performance con métricas de caché**
4. **Verificar webhooks en tabla de logs**

---

## 📞 INFORMACIÓN TÉCNICA PARA COTIZACIÓN

### Nivel de Complejidad del Sistema: **ALTO**

**Justificación:**
- Sistema full-stack con múltiples integraciones
- Lógica de negocio compleja (análisis predictivo)
- Base de datos con múltiples relaciones
- Sistema de caché sofisticado
- Integraciones con APIs externas
- Workflow complejo de estados

### Perfil Requerido del Desarrollador:
- **Experiencia en React/Next.js:** 2+ años
- **Conocimiento de PostgreSQL/Supabase:** 1+ año
- **Experiencia con APIs REST:** 2+ años
- **Conocimiento de sistemas de caché:** Intermedio
- **Familiaridad con Tailwind CSS:** Básico
- **Experiencia en e-commerce/inventario:** Preferible

### Tiempo Estimado para Familiarización: **2-3 semanas**

---

*Documentación generada automáticamente el ${new Date().toLocaleString('es-ES')}*
*Script: \`scripts/generar-documentacion-sistema.js\`*
`;

    return report;
  }
};

// Función principal
async function main() {
  console.log('🔍 Iniciando análisis completo del sistema...');

  const analysis = {
    project: analyzers.analyzeProject(),
    apis: analyzers.analyzeAPIs(),
    components: analyzers.analyzeComponents(),
    pages: analyzers.analyzePages(),
    database: analyzers.analyzeDatabase(),
    scripts: analyzers.analyzeScripts()
  };

  console.log('📊 Generando estimaciones de costos...');

  const report = reportGenerator.generate(analysis);

  console.log('📝 Escribiendo documentación...');

  fs.writeFileSync(CONFIG.outputFile, report, 'utf8');

  console.log(`✅ Documentación generada exitosamente: ${CONFIG.outputFile}`);
  console.log('📋 Análisis completado:');
  console.log(`   - ${analysis.apis?.total || 0} APIs analizadas`);
  console.log(`   - ${analysis.components?.total || 0} componentes analizados`);
  console.log(`   - ${analysis.pages?.total || 0} páginas analizadas`);
  console.log(`   - ${analysis.scripts?.total || 0} scripts analizados`);
  console.log(`   - ${analysis.database?.totalSchemas || 0} esquemas de base de datos`);

  const estimates = estimator.generateModuleEstimates(analysis);
  const totalHours = (estimates.apis?.totalHours || 0) + (estimates.components?.totalHours || 0);
  const totalCost = (estimates.apis?.totalCost || 0) + (estimates.components?.totalCost || 0);

  console.log(`💰 Estimación total: ${totalHours} horas - $${totalCost.toLocaleString('es-CL')} CLP`);
}

// Ejecutar script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { analyzers, estimator, reportGenerator, utils };