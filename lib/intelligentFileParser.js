// lib/intelligentFileParser.js
import * as XLSX from 'xlsx';

class IntelligentFileParser {
    constructor() {
        this.supportedFormats = {
            excel: ['.xlsx', '.xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
            csv: ['.csv', 'text/csv'],
            tsv: ['.tsv', '.tab', 'text/tab-separated-values'],
            json: ['.json', 'application/json'],
            txt: ['.txt', 'text/plain']
        };

        this.columnMappings = {
            // Identificadores de productos
            sku: ['sku', 'SKU', 'codigo', 'product_code', 'item_code', 'cod_producto', 'product_id'],
            descripcion: ['descripcion', 'description', 'nombre', 'name', 'product_name', 'titulo', 'title'],
            descripcion_producto: ['descripcion_producto', 'product_description', 'description', 'producto', 'item_name', 'nombre_producto'],
            
            // Cantidades y números
            cantidad: ['cantidad', 'qty', 'quantity', 'units', 'unidades', 'stock', 'amount'],
            // Nota: Las tablas reales no tienen numero_venta/numero_compra, pero mantenemos mapeo para compatibilidad
            numero_venta: ['numero_venta', 'sale_number', 'order_id', 'venta_id', 'id_venta'],
            numero_compra: ['numero_compra', 'purchase_number', 'order_number', 'compra_id'],
            
            // Fechas
            fecha_venta: ['fecha_venta', 'date', 'fecha', 'sale_date', 'created_at', 'timestamp'],
            fecha_compra: ['fecha_compra', 'purchase_date', 'order_date', 'fecha_pedido'],
            fecha_llegada_estimada: ['fecha_llegada_estimada', 'estimated_arrival', 'eta', 'fecha_eta'],
            fecha_llegada_real: ['fecha_llegada_real', 'actual_arrival', 'arrival_date', 'fecha_real'],
            
            // Precios y costos (mapear a campos que existen en productos)
            precio: ['precio', 'price', 'amount', 'valor', 'precio_venta', 'sale_price'],
            precio_venta_clp: ['precio_venta_clp', 'price_clp', 'precio_chile', 'sale_amount'],
            precio_compra: ['precio_compra', 'purchase_price', 'cost_price', 'costo'],
            costo_fob_rmb: ['costo_fob_rmb', 'fob_cost', 'cost_rmb', 'precio_china'],
            
            // Datos técnicos
            cbm: ['cbm', 'CBM', 'volumen', 'volume', 'm3'],
            link: ['link', 'url', 'enlace', 'website', 'product_url'],
            
            // Contenedores y logística
            container_number: ['container_number', 'contenedor', 'container', 'numero_contenedor', 'container_id', 'cont_num'],
            container_type: ['container_type', 'tipo_contenedor', 'type', 'tipo'],
            max_cbm: ['max_cbm', 'cbm_maximo', 'volumen_max', 'cbm', 'volume'],
            departure_port: ['departure_port', 'puerto_salida', 'origin_port', 'puerto_origen'],
            arrival_port: ['arrival_port', 'puerto_llegada', 'destination_port', 'puerto_destino'],
            estimated_departure: ['estimated_departure', 'fecha_salida_estimada', 'etd', 'departure_date'],
            estimated_arrival: ['estimated_arrival', 'fecha_llegada_estimada', 'eta', 'arrival_date'],
            shipping_company: ['shipping_company', 'naviera', 'company', 'empresa_transporte'],
            notes: ['notes', 'notas', 'observaciones', 'comentarios', 'remarks'],
            proveedor: ['proveedor', 'supplier', 'vendor', 'provider'],
            status_compra: ['status_compra', 'purchase_status', 'estado', 'status'],
            
            // Categorización
            categoria: ['categoria', 'category', 'tipo', 'type', 'classification', 'rubro'],
            
            // Campos específicos de productos
            stock_actual: ['stock_actual', 'stock', 'inventory', 'existencias', 'disponible'],
            status: ['status', 'estado', 'state', 'situacion'],
            desconsiderado: ['desconsiderado', 'excluded', 'inactive', 'disabled'],
            precio_venta_sugerido: ['precio_venta_sugerido', 'precio_sugerido', 'suggested_price', 'precio_venta'],
            codigo_interno: ['codigo_interno', 'internal_code', 'cod_interno', 'codigo_empresa'],
            notas: ['notas', 'notes', 'observaciones', 'comments', 'remarks'],
            
            // Canales de venta (importante para MercadoLibre)
            canal: ['canal', 'channel', 'marketplace', 'platform', 'origen'],
        };
    }

    detectFileFormat(file) {
        const fileName = file.name.toLowerCase();
        const mimeType = file.type.toLowerCase();
        
        // Detectar por extensión y MIME type
        for (const [format, identifiers] of Object.entries(this.supportedFormats)) {
            if (identifiers.some(id => fileName.includes(id) || mimeType.includes(id))) {
                return format;
            }
        }
        
        // Fallback: intentar detectar por contenido
        if (fileName.includes('.xls')) return 'excel';
        if (fileName.includes('.csv') || mimeType.includes('csv')) return 'csv';
        if (fileName.includes('.json')) return 'json';
        
        return 'unknown';
    }

    async parseFile(file) {
        const format = this.detectFileFormat(file);
        
        try {
            switch (format) {
                case 'excel':
                    return await this.parseExcel(file);
                case 'csv':
                    return await this.parseCSV(file);
                case 'tsv':
                    return await this.parseTSV(file);
                case 'json':
                    return await this.parseJSON(file);
                case 'txt':
                    return await this.parseGenericText(file);
                default:
                    throw new Error(`Formato de archivo no soportado: ${format}`);
            }
        } catch (error) {
            throw new Error(`Error parseando archivo ${format}: ${error.message}`);
        }
    }

    async parseExcel(file) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        
        // Encontrar la hoja con más datos útiles
        const bestSheet = this.findBestExcelSheet(workbook);
        const worksheet = workbook.Sheets[bestSheet];
        
        if (!worksheet) {
            throw new Error('No se encontró una hoja válida en el archivo Excel');
        }
        
        // Convertir a JSON manteniendo tipos de datos
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,  // Usar índices numéricos primero
            raw: false, // Convertir fechas automáticamente
            defval: ''  // Valor por defecto para celdas vacías
        });
        
        if (jsonData.length < 2) {
            throw new Error('El archivo debe tener al menos una fila de encabezados y una de datos');
        }
        
        return this.normalizeData(jsonData);
    }

    async parseCSV(file) {
        const text = await file.text();
        const separator = this.detectCSVSeparator(text);
        return this.parseDelimitedText(text, separator);
    }

    async parseTSV(file) {
        const text = await file.text();
        return this.parseDelimitedText(text, '\t');
    }

    async parseJSON(file) {
        const text = await file.text();
        const jsonData = JSON.parse(text);
        
        if (!Array.isArray(jsonData)) {
            throw new Error('El archivo JSON debe contener un array de objetos');
        }
        
        // Convertir objeto JSON a formato de filas
        if (jsonData.length === 0) return [];
        
        const headers = Object.keys(jsonData[0]);
        const rows = [headers];
        
        jsonData.forEach(obj => {
            const row = headers.map(header => obj[header] || '');
            rows.push(row);
        });
        
        return this.normalizeData(rows);
    }

    async parseGenericText(file) {
        const text = await file.text();
        
        // Intentar detectar separador automáticamente
        const possibleSeparators = [',', ';', '\t', '|', ':'];
        const firstLine = text.split('\n')[0];
        
        let bestSeparator = ',';
        let maxColumns = 0;
        
        possibleSeparators.forEach(sep => {
            const columns = firstLine.split(sep).length;
            if (columns > maxColumns) {
                maxColumns = columns;
                bestSeparator = sep;
            }
        });
        
        return this.parseDelimitedText(text, bestSeparator);
    }

    parseDelimitedText(text, separator) {
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
            throw new Error('El archivo debe tener al menos una fila de encabezados y una de datos');
        }
        
        const data = lines.map(line => {
            return this.parseCSVLine(line, separator);
        });
        
        return this.normalizeData(data);
    }

    parseCSVLine(line, separator = ',') {
        const result = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (!inQuotes && (char === '"' || char === "'")) {
                inQuotes = true;
                quoteChar = char;
            } else if (inQuotes && char === quoteChar) {
                if (nextChar === quoteChar) {
                    // Comilla escapada
                    current += char;
                    i++; // Saltar la siguiente comilla
                } else {
                    inQuotes = false;
                    quoteChar = '';
                }
            } else if (!inQuotes && char === separator) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }

    detectCSVSeparator(text) {
        const separators = [',', ';', '\t', '|'];
        const lines = text.split('\n').slice(0, 5); // Analizar primeras 5 líneas
        
        const counts = {};
        separators.forEach(sep => {
            counts[sep] = 0;
            lines.forEach(line => {
                const parts = line.split(sep);
                counts[sep] += parts.length;
            });
        });
        
        // Retornar el separador que genere más columnas consistentemente
        return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    }

    findBestExcelSheet(workbook) {
        const sheetNames = workbook.SheetNames;
        
        let bestSheet = sheetNames[0];
        let maxDataRows = 0;
        
        sheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (jsonData.length > maxDataRows) {
                maxDataRows = jsonData.length;
                bestSheet = sheetName;
            }
        });
        
        return bestSheet;
    }

    normalizeData(rawData) {
        if (!rawData || rawData.length === 0) return [];
        
        const headers = rawData[0].map(h => String(h).trim());
        const dataRows = rawData.slice(1);
        
        // Mapear columnas automáticamente
        const columnMapping = this.autoMapColumns(headers);
        
        // Convertir a objetos con mapeo inteligente
        const normalizedData = dataRows.map((row, index) => {
            const normalizedRow = {};
            const originalRow = {};
            
            headers.forEach((header, colIndex) => {
                const value = row[colIndex];
                const cleanValue = this.cleanValue(value);
                
                // Guardar valor original
                originalRow[header] = cleanValue;
                
                // Aplicar mapeo si existe
                const mappedField = columnMapping[header];
                if (mappedField) {
                    normalizedRow[mappedField] = this.convertValue(cleanValue, mappedField);
                }
            });
            
            return {
                ...normalizedRow,
                _original: originalRow,
                _rowIndex: index + 2 // +2 porque empezamos en fila 1 y saltamos header
            };
        });
        
        return {
            headers,
            columnMapping,
            data: normalizedData,
            totalRows: normalizedData.length,
            detectedFormat: this.analyzeDataFormat(normalizedData)
        };
    }

    autoMapColumns(headers) {
        const mapping = {};
        
        headers.forEach(header => {
            const normalizedHeader = header.toLowerCase().trim();
            
            for (const [standardField, variants] of Object.entries(this.columnMappings)) {
                if (variants.some(variant => {
                    const normalizedVariant = variant.toLowerCase();
                    return normalizedHeader === normalizedVariant || 
                           normalizedHeader.includes(normalizedVariant) ||
                           normalizedVariant.includes(normalizedHeader);
                })) {
                    mapping[header] = standardField;
                    break;
                }
            }
        });
        
        return mapping;
    }

    cleanValue(value) {
        if (value === null || value === undefined) return '';
        
        const stringValue = String(value).trim();
        
        // Remover caracteres especiales comunes de CSV/Excel
        return stringValue
            .replace(/^["']|["']$/g, '') // Comillas al inicio/fin
            .replace(/\s+/g, ' ')        // Espacios múltiples
            .trim();
    }

    convertValue(value, fieldType) {
        if (!value || value === '') return value;
        
        switch (fieldType) {
            case 'cantidad':
            case 'numero_venta':
            case 'numero_compra':
            case 'stock_actual':
                const intValue = parseInt(value);
                return isNaN(intValue) ? value : intValue;
                
            case 'precio':
            case 'precio_venta_clp':
            case 'precio_compra':
            case 'costo_fob_rmb':
            case 'cbm':
            case 'precio_venta_sugerido':
                const floatValue = parseFloat(value.toString().replace(/[,$]/g, ''));
                return isNaN(floatValue) ? value : floatValue;
                
            case 'desconsiderado':
                // Convertir valores booleanos
                if (typeof value === 'boolean') return value;
                const lowerValue = value.toString().toLowerCase();
                return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'sí' || lowerValue === 'yes';
                
            case 'fecha_venta':
            case 'fecha_compra':
            case 'fecha_llegada_estimada':
            case 'fecha_llegada_real':
                return this.parseDate(value);
                
            default:
                return value;
        }
    }

    parseDate(dateValue) {
        if (!dateValue) return null;
        
        // Intentar varios formatos de fecha
        const dateFormats = [
            /^\d{4}-\d{2}-\d{2}$/,         // 2024-01-15
            /^\d{2}\/\d{2}\/\d{4}$/,       // 15/01/2024
            /^\d{2}-\d{2}-\d{4}$/,         // 15-01-2024
            /^\d{4}\/\d{2}\/\d{2}$/,       // 2024/01/15
        ];
        
        const dateStr = String(dateValue).trim();
        
        // Si ya está en formato ISO, devolverlo
        if (dateFormats[0].test(dateStr)) {
            return dateStr;
        }
        
        // Convertir otros formatos a ISO
        if (dateFormats[1].test(dateStr)) {
            const [day, month, year] = dateStr.split('/');
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        if (dateFormats[2].test(dateStr)) {
            const [day, month, year] = dateStr.split('-');
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        // NUEVO: Detectar números de fecha de Excel (días desde 1900-01-01)
        const numericValue = parseFloat(dateValue);
        if (!isNaN(numericValue) && numericValue > 1 && numericValue < 100000) {
            // Excel fecha base: 1 de enero de 1900 (pero con bug del año bisiesto)
            // Excel cuenta erróneamente 1900 como bisiesto
            const excelEpoch = new Date(1899, 11, 30); // 30 dic 1899 para compensar
            const actualDate = new Date(excelEpoch.getTime() + numericValue * 24 * 60 * 60 * 1000);
            
            if (!isNaN(actualDate.getTime()) && actualDate.getFullYear() > 1900 && actualDate.getFullYear() < 2100) {
                return actualDate.toISOString().split('T')[0];
            }
        }
        
        // Intentar parsing nativo de JavaScript
        const parsedDate = new Date(dateValue);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString().split('T')[0];
        }
        
        // Si no se puede convertir, devolver valor original
        return dateValue;
    }

    analyzeDataFormat(data) {
        if (!data || data.length === 0) return {};
        
        const sample = data.slice(0, 10); // Analizar muestra
        const analysis = {};
        
        // Detectar tipo de datos más probable
        const hasVentas = sample.some(row => row.numero_venta || row.fecha_venta || row.precio_venta_clp);
        const hasCompras = sample.some(row => row.numero_compra || row.fecha_compra || row.proveedor);
        const hasContainers = sample.some(row => row.container_number);
        const hasProductos = sample.some(row => row.descripcion || row.categoria || row.stock_actual || row.costo_fob_rmb);
        
        if (hasVentas) analysis.probableType = 'ventas';
        else if (hasCompras) analysis.probableType = 'compras';
        else if (hasContainers) analysis.probableType = 'containers';
        else if (hasProductos) analysis.probableType = 'productos';
        else analysis.probableType = 'unknown';
        
        // Análisis de calidad de datos
        analysis.quality = {
            totalRows: data.length,
            withSKU: data.filter(row => row.sku).length,
            withQuantity: data.filter(row => row.cantidad).length,
            withDates: data.filter(row => row.fecha_venta || row.fecha_compra).length,
            completenessScore: 0
        };
        
        analysis.quality.completenessScore = Math.round(
            ((analysis.quality.withSKU + analysis.quality.withQuantity) / (data.length * 2)) * 100
        );
        
        return analysis;
    }

    validateData(parsedData, expectedType = null) {
        const { data } = parsedData;
        const errors = [];
        const warnings = [];
        
        data.forEach((row, index) => {
            const rowNum = row._rowIndex || index + 2;
            
            // Validaciones específicas por tipo (más flexibles)
            if (expectedType === 'ventas') {
                // Solo SKU y cantidad son realmente obligatorios para ventas
                if (!row.sku || row.sku.toString().trim() === '') {
                    errors.push(`Fila ${rowNum}: SKU es requerido para ventas`);
                }
                
                if (row.cantidad !== undefined && (isNaN(row.cantidad) || row.cantidad <= 0)) {
                    errors.push(`Fila ${rowNum}: Cantidad debe ser un número positivo`);
                }
                
                if (!row.numero_venta) {
                    warnings.push(`Fila ${rowNum}: Se generará número de venta automático`);
                }
            }
            
            if (expectedType === 'compras') {
                // Solo SKU y cantidad son realmente obligatorios para compras
                if (!row.sku || row.sku.toString().trim() === '') {
                    errors.push(`Fila ${rowNum}: SKU es requerido para compras`);
                }
                
                if (row.cantidad !== undefined && (isNaN(row.cantidad) || row.cantidad <= 0)) {
                    errors.push(`Fila ${rowNum}: Cantidad debe ser un número positivo`);
                }
                
                if (!row.numero_compra) {
                    warnings.push(`Fila ${rowNum}: Se generará número de compra automático`);
                }
            }
            
            if (expectedType === 'containers') {
                // Solo container_number es obligatorio
                if (!row.container_number || row.container_number.toString().trim() === '') {
                    errors.push(`Fila ${rowNum}: Número de contenedor es requerido`);
                }
                
                // Otros campos son opcionales, solo advertencias si faltan datos importantes
                if (!row.departure_port && !row.arrival_port) {
                    warnings.push(`Fila ${rowNum}: No se especificaron puertos de origen/destino`);
                }
            }
            
            if (expectedType === 'productos') {
                // Solo SKU es obligatorio para productos
                if (!row.sku || row.sku.toString().trim() === '') {
                    errors.push(`Fila ${rowNum}: SKU es requerido para productos`);
                }
                
                // Validaciones opcionales con advertencias
                if (!row.descripcion && !row.descripcion_producto) {
                    warnings.push(`Fila ${rowNum}: Se recomienda incluir descripción del producto`);
                }
                
                if (row.stock_actual !== undefined && (isNaN(row.stock_actual) || row.stock_actual < 0)) {
                    errors.push(`Fila ${rowNum}: Stock actual debe ser un número no negativo`);
                }
                
                if (row.costo_fob_rmb !== undefined && (isNaN(row.costo_fob_rmb) || row.costo_fob_rmb < 0)) {
                    errors.push(`Fila ${rowNum}: Costo FOB debe ser un número no negativo`);
                }
            }
            
            // Validación general más flexible de fechas - no generar advertencias por conversión exitosa
            const dateFields = ['fecha_venta', 'fecha_compra', 'fecha_llegada_estimada', 'estimated_departure', 'estimated_arrival'];
            dateFields.forEach(field => {
                if (row[field] && row[field] !== '' && typeof row[field] === 'string' && row[field] === row._original[field]) {
                    // Solo advertir si realmente parece problemático
                    if (!row[field].includes('-') && !row[field].includes('/') && isNaN(Date.parse(row[field]))) {
                        warnings.push(`Fila ${rowNum}: Formato de fecha no reconocido en ${field}: ${row[field]}`);
                    }
                }
            });
        });
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            summary: {
                totalRows: data.length,
                validRows: data.length - errors.length,
                errorCount: errors.length,
                warningCount: warnings.length
            }
        };
    }
}

export default IntelligentFileParser;