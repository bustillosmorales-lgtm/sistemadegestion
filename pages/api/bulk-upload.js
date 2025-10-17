// pages/api/bulk-upload.js
import { supabase } from '../../lib/supabaseClient';
import * as XLSX from 'xlsx';

export default async function handler(req, res) {
    // Manejar descarga de templates
    if (req.method === 'GET') {
        try {
            const { tableType } = req.query;

            if (tableType === 'packs') {
                return await descargarTemplatePacks(res);
            } else {
                // Por defecto, descargar template de productos
                return await descargarTemplateProductos(res);
            }
        } catch (error) {
            return res.status(500).json({ error: 'Error generando template: ' + error.message });
        }
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const { tableType, data: uploadData, user } = req.body;

    // Control de acceso - Solo admin y chile
    if (!user || (user.role !== 'admin' && user.role !== 'chile')) {
        return res.status(403).json({ error: 'Acceso denegado. Solo usuarios admin o chile pueden cargar datos.' });
    }

    // Verificar configuración de coexistencia con APIs
    try {
        const { data: syncConfig } = await supabase
            .from('api_configurations')
            .select('config')
            .eq('api_name', 'sync_settings')
            .single();

        if (syncConfig?.config?.global_settings?.bulk_upload_mode === 'api_only') {
            return res.status(403).json({ 
                error: 'Carga masiva deshabilitada. El sistema está configurado para usar solo APIs externas.',
                code: 'BULK_UPLOAD_DISABLED'
            });
        }
    } catch (configError) {
        console.log('No hay configuración de sync definida, permitiendo carga masiva');
    }

    if (!tableType || !uploadData || !Array.isArray(uploadData)) {
        return res.status(400).json({ error: 'Faltan parámetros: tableType y data (array) requeridos.' });
    }

    const allowedTables = ['ventas', 'compras', 'containers', 'productos', 'packs'];
    if (!allowedTables.includes(tableType)) {
        return res.status(400).json({ error: `Tipo de tabla no permitido. Usar: ${allowedTables.join(', ')}` });
    }

    try {
        let processedData = {
            nuevos: [],
            duplicados: [],
            errores: [],
            productosNuevos: []
        };

        // Procesar según tipo de tabla
        switch (tableType) {
            case 'ventas':
                processedData = await procesarVentas(uploadData);
                break;
            case 'compras':
                processedData = await procesarCompras(uploadData);
                break;
            case 'containers':
                processedData = await procesarContainers(uploadData);
                break;
            case 'productos':
                processedData = await procesarProductos(uploadData);
                break;
            case 'packs':
                processedData = await procesarPacks(uploadData);
                break;
        }

        return res.status(200).json({
            mensaje: `Carga masiva completada para ${tableType}`,
            resumen: {
                nuevos: processedData.nuevos.length,
                duplicados: processedData.duplicados.length,
                errores: processedData.errores.length,
                productosNuevos: processedData.productosNuevos?.length || 0,
                contenedoresNuevos: processedData.contenedoresNuevos?.length || 0
            },
            detalles: processedData
        });

    } catch (error) {
        console.error('Error en carga masiva:', error);
        return res.status(500).json({ error: 'Error interno: ' + error.message });
    }
}

async function procesarVentas(ventasData) {
    const resultado = {
        nuevos: [],
        duplicados: [],
        errores: [],
        productosNuevos: []
    };

    console.log(`🚀 Procesando ${ventasData.length} ventas en modo batch optimizado`);

    // PASO 1: Validar y normalizar todos los datos primero
    const ventasValidadas = [];
    const skusUnicos = new Set();

    for (const venta of ventasData) {
        try {
            // RECUPERAR SKU si está mal mapeado
            let skuFinal = venta.sku;
            let cantidadFinal = venta.cantidad;

            // Verificar si el SKU parece válido
            if (!skuFinal || skuFinal.toString().trim() === '' ||
                (skuFinal.toString().length <= 2 && !isNaN(skuFinal))) {

                if (venta._original) {
                    const skuField = Object.entries(venta._original).find(([key, value]) => {
                        const keyLower = key.toLowerCase();
                        return keyLower.includes('sku') && value && value.toString().trim() !== '';
                    });

                    if (skuField) {
                        skuFinal = skuField[1];
                    }
                }
            }

            // Verificar cantidad si no está mapeada
            if (!cantidadFinal && venta._original) {
                const cantidadField = Object.entries(venta._original).find(([key, value]) => {
                    const keyLower = key.toLowerCase();
                    return (keyLower.includes('cantidad') || keyLower.includes('qty') ||
                            keyLower.includes('quantity')) && value && value.toString().trim() !== '';
                });

                if (cantidadField) {
                    cantidadFinal = parseInt(cantidadField[1]);
                }
            }

            // Validar campos requeridos
            if (!skuFinal || !cantidadFinal) {
                resultado.errores.push({
                    registro: venta,
                    error: 'Campos requeridos: sku, cantidad'
                });
                continue;
            }

            const ventaValidada = {
                sku: skuFinal.toString().trim(),
                cantidad: parseInt(cantidadFinal),
                fecha_venta: venta.fecha_venta || new Date().toISOString().split('T')[0] + ' 00:00:00',
                descripcion: venta.descripcion_producto || venta.descripcion
            };

            ventasValidadas.push(ventaValidada);
            skusUnicos.add(ventaValidada.sku);

        } catch (error) {
            resultado.errores.push({
                registro: venta,
                error: error.message
            });
        }
    }

    if (ventasValidadas.length === 0) {
        return resultado;
    }

    console.log(`✅ Validadas ${ventasValidadas.length} ventas, ${skusUnicos.size} SKUs únicos`);

    // PASO 2: Verificar que todos los productos existen (NO crear automáticamente)
    const skusExistentes = await verificarProductosExistentes(Array.from(skusUnicos), resultado);

    // Filtrar solo las ventas cuyos productos existen
    const ventasConProductosValidos = ventasValidadas.filter(venta => skusExistentes.has(venta.sku));

    if (ventasConProductosValidos.length === 0) {
        console.log('⚠️ No hay ventas válidas para procesar (todos los productos son inválidos)');
        return resultado;
    }

    console.log(`📊 ${ventasConProductosValidos.length} ventas con productos válidos para procesar`);

    // PASO 3: Obtener ventas existentes para detectar duplicados (batch query)
    const { data: ventasExistentes } = await supabase
        .from('ventas')
        .select('sku, fecha_venta')
        .in('sku', Array.from(skusUnicos));

    const ventasExistentesSet = new Set(
        (ventasExistentes || []).map(v => `${v.sku}-${v.fecha_venta}`)
    );

    // PASO 4: Filtrar duplicados (solo de las ventas con productos válidos)
    const ventasParaInsertar = ventasConProductosValidos.filter(venta => {
        const key = `${venta.sku}-${venta.fecha_venta}`;
        if (ventasExistentesSet.has(key)) {
            resultado.duplicados.push(key);
            return false;
        }
        return true;
    });

    console.log(`📊 ${ventasParaInsertar.length} ventas nuevas para insertar, ${resultado.duplicados.length} duplicados`);

    // PASO 5: Insertar en batches de 100 (optimizado para Netlify timeout)
    const BATCH_SIZE = 100;

    for (let i = 0; i < ventasParaInsertar.length; i += BATCH_SIZE) {
        const batch = ventasParaInsertar.slice(i, i + BATCH_SIZE);
        const ventasBatch = batch.map(v => ({
            sku: v.sku,
            cantidad: v.cantidad,
            fecha_venta: v.fecha_venta
        }));

        try {
            console.log(`💾 Insertando batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(ventasParaInsertar.length/BATCH_SIZE)} (${batch.length} registros)`);

            const { data, error } = await supabase
                .from('ventas')
                .insert(ventasBatch)
                .select();

            if (error) {
                console.error(`❌ Error en batch: ${error.message}`);
                // Si falla el batch completo, procesar individualmente
                for (const venta of batch) {
                    try {
                        const { data: single, error: singleError } = await supabase
                            .from('ventas')
                            .insert({
                                sku: venta.sku,
                                cantidad: venta.cantidad,
                                fecha_venta: venta.fecha_venta
                            })
                            .select();

                        if (singleError) {
                            resultado.errores.push({ registro: venta, error: singleError.message });
                        } else {
                            resultado.nuevos.push(single[0]);
                        }
                    } catch (e) {
                        resultado.errores.push({ registro: venta, error: e.message });
                    }
                }
            } else {
                resultado.nuevos.push(...(data || []));
            }
        } catch (error) {
            console.error(`❌ Error procesando batch: ${error.message}`);
        }
    }

    console.log(`✅ Proceso completado: ${resultado.nuevos.length} nuevos, ${resultado.duplicados.length} duplicados, ${resultado.errores.length} errores`);
    return resultado;
}

async function procesarCompras(comprasData) {
    const resultado = {
        nuevos: [],
        duplicados: [],
        errores: [],
        productosNuevos: [],
        contenedoresNuevos: []
    };

    console.log(`🚀 Procesando ${comprasData.length} compras en modo batch optimizado`);

    // PASO 1: Validar y normalizar todos los datos
    const comprasValidadas = [];
    const skusUnicos = new Set();
    const containersUnicos = new Set();

    for (const compra of comprasData) {
        try {
            // RECUPERAR SKU, CANTIDAD y CONTAINER_NUMBER
            let skuFinal = compra.sku;
            let cantidadFinal = compra.cantidad;
            let containerFinal = compra.container_number;

            // Verificar SKU
            if (!skuFinal || skuFinal.toString().trim() === '' ||
                (skuFinal.toString().length <= 2 && !isNaN(skuFinal)) ||
                (skuFinal.toString().length > 3 && /^\d+$/.test(skuFinal) && parseInt(skuFinal) < 10000)) {

                if (compra._original) {
                    const skuField = Object.entries(compra._original).find(([key, value]) => {
                        const keyLower = key.toLowerCase();
                        return keyLower.includes('sku') && value && value.toString().trim() !== '';
                    });

                    if (skuField) {
                        skuFinal = skuField[1];
                    }
                }
            }

            // Verificar cantidad
            if (!cantidadFinal && compra._original) {
                const cantidadField = Object.entries(compra._original).find(([key, value]) => {
                    const keyLower = key.toLowerCase();
                    return (keyLower.includes('cantidad') || keyLower.includes('qty') ||
                            keyLower.includes('quantity')) && value && value.toString().trim() !== '';
                });

                if (cantidadField) {
                    cantidadFinal = parseInt(cantidadField[1]);
                }
            }

            // Verificar container_number
            if (!containerFinal && compra._original) {
                const containerField = Object.entries(compra._original).find(([key, value]) => {
                    const keyLower = key.toLowerCase();
                    return (keyLower.includes('container') || keyLower.includes('contenedor') ||
                            keyLower.includes('cont') || keyLower.includes('ctr')) &&
                            value && value.toString().trim() !== '';
                });

                if (containerField) {
                    containerFinal = containerField[1].toString().trim();
                }
            }

            // Verificar CBM
            let cbmFinal = compra.cbm;
            if (!cbmFinal && compra._original) {
                const cbmField = Object.entries(compra._original).find(([key, value]) => {
                    const keyLower = key.toLowerCase();
                    return (keyLower.includes('cbm') || keyLower.includes('m3') ||
                            keyLower.includes('metros') || keyLower.includes('cubic')) &&
                            value && value.toString().trim() !== '';
                });

                if (cbmField) {
                    cbmFinal = parseFloat(cbmField[1]);
                }
            }

            // Validar campos requeridos
            if (!skuFinal || !cantidadFinal) {
                resultado.errores.push({
                    registro: compra,
                    error: 'Campos requeridos: sku, cantidad'
                });
                continue;
            }

            const compraValidada = {
                sku: skuFinal.toString().trim(),
                cantidad: parseInt(cantidadFinal),
                fecha_compra: compra.fecha_compra || new Date().toISOString().split('T')[0] + ' 00:00:00',
                fecha_llegada_estimada: compra.fecha_llegada_estimada || null,
                fecha_llegada_real: compra.fecha_llegada_real || null,
                status_compra: compra.status_compra || 'en_transito',
                container_number: containerFinal || null,
                cbm: cbmFinal ? parseFloat(cbmFinal) : null,
                descripcion: compra.descripcion_producto,
                _original: compra
            };

            comprasValidadas.push(compraValidada);
            skusUnicos.add(compraValidada.sku);
            if (containerFinal) {
                containersUnicos.add(containerFinal);
            }

        } catch (error) {
            resultado.errores.push({
                registro: compra,
                error: error.message
            });
        }
    }

    if (comprasValidadas.length === 0) {
        return resultado;
    }

    console.log(`✅ Validadas ${comprasValidadas.length} compras, ${skusUnicos.size} SKUs únicos, ${containersUnicos.size} containers`);

    // PASO 2: Verificar que todos los productos existen (NO crear automáticamente)
    const skusExistentes = await verificarProductosExistentes(Array.from(skusUnicos), resultado);

    // Filtrar solo las compras cuyos productos existen
    const comprasConProductosValidos = comprasValidadas.filter(compra => skusExistentes.has(compra.sku));

    if (comprasConProductosValidos.length === 0) {
        console.log('⚠️ No hay compras válidas para procesar (todos los productos son inválidos)');
        return resultado;
    }

    console.log(`📊 ${comprasConProductosValidos.length} compras con productos válidos para procesar`);

    // PASO 3: Crear containers faltantes en batch
    if (containersUnicos.size > 0) {
        await crearContainersFaltantesBatch(Array.from(containersUnicos), comprasValidadas, resultado);
    }

    // PASO 4: Obtener compras existentes para detectar duplicados
    const { data: comprasExistentes } = await supabase
        .from('compras')
        .select('sku, fecha_compra')
        .in('sku', Array.from(skusUnicos));

    const comprasExistentesSet = new Set(
        (comprasExistentes || []).map(c => `${c.sku}-${c.fecha_compra}`)
    );

    // PASO 5: Filtrar duplicados (solo de las compras con productos válidos)
    const comprasParaInsertar = comprasConProductosValidos.filter(compra => {
        const key = `${compra.sku}-${compra.fecha_compra}`;
        if (comprasExistentesSet.has(key)) {
            resultado.duplicados.push(key);
            return false;
        }
        return true;
    });

    console.log(`📊 ${comprasParaInsertar.length} compras nuevas para insertar, ${resultado.duplicados.length} duplicados`);

    // PASO 6: Insertar en batches de 100 (optimizado para Netlify timeout)
    const BATCH_SIZE = 100;

    for (let i = 0; i < comprasParaInsertar.length; i += BATCH_SIZE) {
        const batch = comprasParaInsertar.slice(i, i + BATCH_SIZE);
        const comprasBatch = batch.map(c => ({
            sku: c.sku,
            cantidad: c.cantidad,
            fecha_compra: c.fecha_compra,
            fecha_llegada_estimada: c.fecha_llegada_estimada,
            fecha_llegada_real: c.fecha_llegada_real,
            status_compra: c.status_compra,
            container_number: c.container_number,
            cbm: c.cbm
        }));

        try {
            console.log(`💾 Insertando batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(comprasParaInsertar.length/BATCH_SIZE)} (${batch.length} registros)`);

            const { data, error } = await supabase
                .from('compras')
                .insert(comprasBatch)
                .select();

            if (error) {
                console.error(`❌ Error en batch: ${error.message}`);
                // Si falla el batch, procesar individualmente
                for (const compra of batch) {
                    try {
                        const { data: single, error: singleError } = await supabase
                            .from('compras')
                            .insert({
                                sku: compra.sku,
                                cantidad: compra.cantidad,
                                fecha_compra: compra.fecha_compra,
                                fecha_llegada_estimada: compra.fecha_llegada_estimada,
                                fecha_llegada_real: compra.fecha_llegada_real,
                                status_compra: compra.status_compra,
                                container_number: compra.container_number,
                                cbm: compra.cbm
                            })
                            .select();

                        if (singleError) {
                            resultado.errores.push({ registro: compra, error: singleError.message });
                        } else {
                            resultado.nuevos.push(single[0]);
                        }
                    } catch (e) {
                        resultado.errores.push({ registro: compra, error: e.message });
                    }
                }
            } else {
                resultado.nuevos.push(...(data || []));
            }
        } catch (error) {
            console.error(`❌ Error procesando batch: ${error.message}`);
        }
    }

    console.log(`✅ Proceso completado: ${resultado.nuevos.length} nuevos, ${resultado.duplicados.length} duplicados, ${resultado.errores.length} errores`);
    return resultado;
}

async function procesarContainers(containersData) {
    const resultado = {
        nuevos: [],
        duplicados: [],
        errores: [],
        productosNuevos: []
    };

    for (const container of containersData) {
        try {
            // Validar campos requeridos
            if (!container.container_number) {
                resultado.errores.push({
                    registro: container,
                    error: 'Campo requerido: container_number'
                });
                continue;
            }

            // Verificar duplicado
            const { data: existing } = await supabase
                .from('containers')
                .select('container_number')
                .eq('container_number', container.container_number)
                .maybeSingle();

            if (existing) {
                resultado.duplicados.push(container.container_number);
                continue;
            }

            // Insertar nuevo container (más flexible)
            // NUEVO: fecha_efectiva_llegada determina si está en bodega o en tránsito
            const fechaEfectivaLlegada = container.fecha_efectiva_llegada && container.fecha_efectiva_llegada !== ''
                ? container.fecha_efectiva_llegada
                : null;

            // Fallback: usar actual_arrival_date si fecha_efectiva no está presente
            const actualArrivalDate = container.actual_arrival_date && container.actual_arrival_date !== ''
                ? container.actual_arrival_date
                : fechaEfectivaLlegada;

            // NUEVO: Determinar status basado en fecha_efectiva_llegada
            let containerStatus = container.status || 'CREATED';
            if (fechaEfectivaLlegada) {
                containerStatus = 'DELIVERED'; // EN BODEGA
            } else if (actualArrivalDate) {
                containerStatus = 'DELIVERED'; // Compatibilidad con datos antiguos
            } else if (container.estimated_departure || container.shipping_company) {
                containerStatus = 'IN_TRANSIT'; // EN TRÁNSITO
            }

            const nuevoContainer = {
                container_number: container.container_number.toString(),
                container_type: container.container_type || 'STD',
                max_cbm: parseFloat(container.max_cbm) || 68,
                departure_port: container.departure_port || '',
                arrival_port: container.arrival_port || '',
                estimated_departure: container.estimated_departure || null,
                estimated_arrival: container.estimated_arrival || null,
                actual_departure: container.actual_departure || null,
                actual_arrival_date: actualArrivalDate,
                fecha_efectiva_llegada: fechaEfectivaLlegada, // NUEVO CAMPO
                shipping_company: container.shipping_company || '',
                notes: container.notes || '',
                status: containerStatus,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            console.log(`🚢 Insertando contenedor: ${container.container_number}`, nuevoContainer);

            const { data, error } = await supabase
                .from('containers')
                .insert(nuevoContainer)
                .select();

            if (error) {
                console.error(`❌ Error insertando contenedor ${container.container_number}:`, error);
                throw error;
            }
            
            console.log(`✅ Contenedor ${container.container_number} insertado exitosamente:`, data[0]);
            resultado.nuevos.push(data[0]);

        } catch (error) {
            resultado.errores.push({
                registro: container,
                error: error.message
            });
        }
    }

    return resultado;
}

// Función para verificar que los productos existen (NO crear automáticamente)
// Retorna un Set con los SKUs que SÍ existen
async function verificarProductosExistentes(skus, resultado) {
    try {
        console.log(`🔍 Verificando ${skus.length} SKUs únicos...`);

        // Obtener todos los productos existentes en una sola query
        const { data: productosExistentes, error: selectError } = await supabase
            .from('products')
            .select('sku')
            .in('sku', skus);

        if (selectError) {
            throw new Error(`Error verificando productos: ${selectError.message}`);
        }

        const skusExistentes = new Set((productosExistentes || []).map(p => p.sku));
        const skusFaltantes = skus.filter(sku => !skusExistentes.has(sku));

        console.log(`📦 ${skusExistentes.size} productos existen, ${skusFaltantes.length} productos NO encontrados`);

        if (skusFaltantes.length > 0) {
            console.warn(`⚠️ ADVERTENCIA: ${skusFaltantes.length} productos no existen en la tabla productos:`);
            skusFaltantes.forEach(sku => {
                console.warn(`   - SKU: ${sku}`);
                resultado.errores.push({
                    sku: sku,
                    error: 'Producto no existe en la tabla productos. Debe crearlo mediante carga masiva de productos.'
                });
            });
        } else {
            console.log(`✅ Todos los productos existen en la tabla productos`);
        }

        return skusExistentes; // Retornar el Set de SKUs válidos
    } catch (error) {
        console.error(`❌ Error en verificarProductosExistentes: ${error.message}`);
        throw error;
    }
}

// Función para crear containers faltantes en batch (OPTIMIZADA)
async function crearContainersFaltantesBatch(containers, comprasData, resultado) {
    try {
        console.log(`🔍 Verificando ${containers.length} containers únicos...`);

        // Obtener todos los containers existentes en una sola query
        const { data: containersExistentes, error: selectError } = await supabase
            .from('containers')
            .select('container_number')
            .in('container_number', containers);

        if (selectError) {
            throw new Error(`Error verificando containers: ${selectError.message}`);
        }

        const containersExistentesSet = new Set((containersExistentes || []).map(c => c.container_number));
        const containersFaltantes = containers.filter(c => !containersExistentesSet.has(c));

        console.log(`🚢 ${containersExistentesSet.size} containers existen, ${containersFaltantes.length} containers nuevos a crear`);

        if (containersFaltantes.length === 0) {
            return;
        }

        // Preparar containers para insertar en batch
        const containersParaInsertar = containersFaltantes.map(containerNumber => {
            // Buscar datos del container desde las compras
            const compraConContainer = comprasData.find(c => c.container_number === containerNumber);
            const datosCompra = compraConContainer?._original || {};

            return {
                container_number: containerNumber.toString(),
                container_type: datosCompra.container_type || 'STD',
                max_cbm: parseFloat(datosCompra.max_cbm) || 68,
                departure_port: datosCompra.departure_port || '',
                arrival_port: datosCompra.arrival_port || '',
                estimated_departure: datosCompra.estimated_departure || null,
                estimated_arrival: compraConContainer?.fecha_llegada_estimada || datosCompra.estimated_arrival || null,
                actual_arrival_date: (compraConContainer?.status_compra === 'llegado' && compraConContainer?.fecha_llegada_real) ? compraConContainer.fecha_llegada_real : null,
                shipping_company: datosCompra.shipping_company || '',
                notes: datosCompra.notes || `Auto-creado desde carga masiva`,
                status: (compraConContainer?.status_compra === 'llegado') ? 'DELIVERED' : 'CREATED',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
        });

        // Insertar en batches de 200 (containers tienen más campos)
        const BATCH_SIZE = 200;
        for (let i = 0; i < containersParaInsertar.length; i += BATCH_SIZE) {
            const batch = containersParaInsertar.slice(i, i + BATCH_SIZE);

            console.log(`🚢 Creando batch de containers ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(containersParaInsertar.length/BATCH_SIZE)} (${batch.length} containers)`);

            const { data, error } = await supabase
                .from('containers')
                .insert(batch)
                .select();

            if (error) {
                console.error(`⚠️ Error insertando batch de containers: ${error.message}`);
                // Intentar individualmente si falla el batch
                for (const container of batch) {
                    try {
                        const { data: single, error: singleError } = await supabase
                            .from('containers')
                            .insert(container)
                            .select();

                        if (!singleError && single) {
                            resultado.contenedoresNuevos.push(single[0]);
                        } else if (singleError && !singleError.message.includes('duplicate')) {
                            console.error(`❌ Error creando container ${container.container_number}: ${singleError.message}`);
                        }
                    } catch (e) {
                        // Ignorar duplicados silenciosamente
                    }
                }
            } else {
                resultado.contenedoresNuevos.push(...(data || []));
            }
        }

        console.log(`✅ ${resultado.contenedoresNuevos.length} containers nuevos creados`);
    } catch (error) {
        console.error(`❌ Error en crearContainersFaltantesBatch: ${error.message}`);
        throw error;
    }
}

// NOTA: Esta función ha sido eliminada. Los productos ya NO se crean automáticamente.
// Ahora solo se verifican y se reportan como errores si no existen.
// Use la carga masiva de productos para crear productos nuevos.

// Función para descargar template de productos existentes como Excel
async function descargarTemplateProductos(res) {
    try {
        // Obtener todos los productos existentes
        const { data: productos, error } = await supabase
            .from('products')
            .select('*')
            .order('sku');

        if (error) {
            throw new Error(`Error obteniendo productos: ${error.message}`);
        }

        // Crear workbook
        const workbook = XLSX.utils.book_new();

        // Preparar datos para Excel con todas las columnas posibles
        const excelData = (productos || []).map(producto => ({
            sku: producto.sku || '',
            descripcion: producto.descripcion || '',
            categoria: producto.categoria || '',
            stock_actual: producto.stock_actual || 0,
            costo_fob_rmb: producto.costo_fob_rmb || '',
            cbm: producto.cbm || '',
            link: producto.link || '',
            status: producto.status || '',
            desconsiderado: producto.desconsiderado || false,
            // Campos adicionales que se pueden agregar
            precio_venta_sugerido: producto.precio_venta_sugerido || '',
            proveedor: producto.proveedor || '',
            notas: producto.notas || '',
            codigo_interno: producto.codigo_interno || ''
        }));

        // Si no hay productos, crear template con filas de ejemplo
        if (excelData.length === 0) {
            excelData.push({
                sku: 'EJEMPLO-001',
                descripcion: 'Producto de Ejemplo 1',
                categoria: 'Electrónicos',
                stock_actual: 0,
                costo_fob_rmb: 25.50,
                cbm: 0.02,
                link: 'https://ejemplo.com/producto1',
                status: 'NEEDS_REPLENISHMENT',
                desconsiderado: false,
                precio_venta_sugerido: 45000,
                proveedor: 'Proveedor Ejemplo',
                notas: 'Producto para mostrar formato',
                codigo_interno: 'INT-001'
            });
        }

        // Crear worksheet
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        
        // Configurar ancho de columnas
        const columnWidths = [
            { wch: 15 }, // sku
            { wch: 40 }, // descripcion
            { wch: 15 }, // categoria
            { wch: 12 }, // stock_actual
            { wch: 15 }, // costo_fob_rmb
            { wch: 10 }, // cbm
            { wch: 30 }, // link
            { wch: 20 }, // status
            { wch: 15 }, // desconsiderado
            { wch: 15 }, // precio_venta_sugerido
            { wch: 20 }, // proveedor
            { wch: 30 }, // notas
            { wch: 15 }  // codigo_interno
        ];
        worksheet['!cols'] = columnWidths;

        // Agregar worksheet al workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');

        // Generar buffer del archivo Excel
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Configurar headers para descarga
        res.setHeader('Content-Disposition', `attachment; filename="productos_existentes_${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        
        // Enviar archivo
        return res.send(excelBuffer);

    } catch (error) {
        throw new Error(`Error generando template de productos: ${error.message}`);
    }
}

// Función para descargar template de packs
async function descargarTemplatePacks(res) {
    try {
        // Crear workbook
        const workbook = XLSX.utils.book_new();

        // Datos de ejemplo para el template
        const excelData = [
            {
                IDPack: 'PACK0001',
                IDProducto: '649762431365-NEG',
                Cantidad: 2
            },
            {
                IDPack: 'PACK0003',
                IDProducto: '649762431365-NEG',
                Cantidad: 1
            },
            {
                IDPack: 'PACK0003',
                IDProducto: '649762431365-AZU',
                Cantidad: 1
            },
            {
                IDPack: 'PACK0005',
                IDProducto: '649762435196',
                Cantidad: 1
            },
            {
                IDPack: 'PACK0005',
                IDProducto: '649762431365-NEG',
                Cantidad: 2
            }
        ];

        // Crear worksheet
        const worksheet = XLSX.utils.json_to_sheet(excelData);

        // Configurar ancho de columnas
        const columnWidths = [
            { wch: 15 }, // IDPack
            { wch: 25 }, // IDProducto
            { wch: 10 }  // Cantidad
        ];
        worksheet['!cols'] = columnWidths;

        // Agregar worksheet al workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Packs');

        // Generar buffer del archivo Excel
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Configurar headers para descarga
        res.setHeader('Content-Disposition', `attachment; filename="template_packs_${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        // Enviar archivo
        return res.send(excelBuffer);

    } catch (error) {
        throw new Error(`Error generando template de packs: ${error.message}`);
    }
}

// Función para procesar packs
async function procesarPacks(packsData) {
    const resultado = {
        nuevos: [],
        duplicados: [],
        errores: [],
        productosNuevos: []
    };

    console.log(`🚀 Procesando ${packsData.length} registros de packs en modo batch optimizado`);

    // PASO 1: Validar y normalizar datos
    const packsValidados = [];
    const packsUnicos = new Set();

    for (const pack of packsData) {
        try {
            // Recuperar campos si están mal mapeados
            let packSku = pack.IDPack || pack.pack_sku || pack.Pack || pack.id_pack;
            let productoSku = pack.IDProducto || pack.producto_sku || pack.Producto || pack.sku;
            let cantidad = pack.Cantidad || pack.cantidad || pack.Qty;

            // Buscar en datos originales si no están mapeados
            if ((!packSku || !productoSku || !cantidad) && pack._original) {
                const entries = Object.entries(pack._original);

                if (!packSku) {
                    const packField = entries.find(([key]) =>
                        key.toLowerCase().includes('pack') || key.toLowerCase().includes('idpack')
                    );
                    if (packField) packSku = packField[1];
                }

                if (!productoSku) {
                    const prodField = entries.find(([key]) =>
                        key.toLowerCase().includes('producto') ||
                        key.toLowerCase().includes('idproducto') ||
                        key.toLowerCase().includes('sku')
                    );
                    if (prodField) productoSku = prodField[1];
                }

                if (!cantidad) {
                    const cantField = entries.find(([key]) =>
                        key.toLowerCase().includes('cantidad') || key.toLowerCase().includes('qty')
                    );
                    if (cantField) cantidad = cantField[1];
                }
            }

            // Validar campos requeridos
            if (!packSku || !productoSku || !cantidad) {
                resultado.errores.push({
                    registro: pack,
                    error: 'Campos requeridos: pack_sku (IDPack), producto_sku (IDProducto), cantidad'
                });
                continue;
            }

            const packValidado = {
                pack_sku: packSku.toString().trim(),
                producto_sku: productoSku.toString().trim(),
                cantidad: parseInt(cantidad)
            };

            // Validar cantidad positiva
            if (packValidado.cantidad <= 0) {
                resultado.errores.push({
                    registro: pack,
                    error: 'La cantidad debe ser mayor a 0'
                });
                continue;
            }

            packsValidados.push(packValidado);
            packsUnicos.add(packValidado.pack_sku);

        } catch (error) {
            resultado.errores.push({
                registro: pack,
                error: error.message
            });
        }
    }

    if (packsValidados.length === 0) {
        return resultado;
    }

    console.log(`✅ Validados ${packsValidados.length} registros de packs, ${packsUnicos.size} packs únicos`);

    // PASO 2: Verificar duplicados en BD
    const { data: packsExistentes } = await supabase
        .from('packs')
        .select('pack_sku, producto_sku')
        .in('pack_sku', Array.from(packsUnicos));

    const packsExistentesSet = new Set(
        (packsExistentes || []).map(p => `${p.pack_sku}|${p.producto_sku}`)
    );

    // PASO 3: Filtrar duplicados
    const packsParaInsertar = packsValidados.filter(pack => {
        const key = `${pack.pack_sku}|${pack.producto_sku}`;
        if (packsExistentesSet.has(key)) {
            resultado.duplicados.push(key);
            return false;
        }
        return true;
    });

    console.log(`📊 ${packsParaInsertar.length} registros nuevos para insertar, ${resultado.duplicados.length} duplicados`);

    // PASO 4: Insertar en batches de 100 (optimizado para Netlify timeout)
    const BATCH_SIZE = 100;

    for (let i = 0; i < packsParaInsertar.length; i += BATCH_SIZE) {
        const batch = packsParaInsertar.slice(i, i + BATCH_SIZE);

        try {
            console.log(`💾 Insertando batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(packsParaInsertar.length/BATCH_SIZE)} (${batch.length} registros)`);

            const { data, error } = await supabase
                .from('packs')
                .insert(batch)
                .select();

            if (error) {
                console.error(`❌ Error en batch: ${error.message}`);
                // Si falla el batch, procesar individualmente
                for (const pack of batch) {
                    try {
                        const { data: single, error: singleError } = await supabase
                            .from('packs')
                            .insert(pack)
                            .select();

                        if (singleError) {
                            resultado.errores.push({ registro: pack, error: singleError.message });
                        } else {
                            resultado.nuevos.push(single[0]);
                        }
                    } catch (e) {
                        resultado.errores.push({ registro: pack, error: e.message });
                    }
                }
            } else {
                resultado.nuevos.push(...(data || []));
            }
        } catch (error) {
            console.error(`❌ Error procesando batch: ${error.message}`);
        }
    }

    console.log(`✅ Proceso completado: ${resultado.nuevos.length} nuevos, ${resultado.duplicados.length} duplicados, ${resultado.errores.length} errores`);
    return resultado;
}

// Función para procesar productos con lógica upsert (update o insert)
async function procesarProductos(productosData) {
    const resultado = {
        nuevos: [],
        duplicados: [], // En este contexto, será "actualizados"
        errores: [],
        productosNuevos: [] // Este será igual a "nuevos" para productos
    };

    for (const producto of productosData) {
        try {
            // PRIMERO: Intentar obtener SKU desde datos originales si no está mapeado correctamente
            let skuFinal = producto.sku;
            
            // Verificar si el SKU parece válido (no debe ser solo números pequeños)
            if (!skuFinal || skuFinal.toString().trim() === '' || 
                (skuFinal.toString().length <= 2 && !isNaN(skuFinal))) {
                
                console.log(`⚠️ SKU problemático detectado: "${skuFinal}", buscando en datos originales...`);
                
                // Buscar SKU en los datos originales con prioridad
                if (producto._original) {
                    // Primero buscar campos que explícitamente contienen "sku"
                    const skuField = Object.entries(producto._original).find(([key, value]) => {
                        const keyLower = key.toLowerCase();
                        return keyLower.includes('sku') && value && value.toString().trim() !== '';
                    });
                    
                    if (skuField) {
                        skuFinal = skuField[1];
                        console.log(`📋 SKU recuperado desde campo SKU: ${skuField[0]} = "${skuFinal}"`);
                    } else {
                        // Buscar en otros campos posibles pero solo valores que parezcan SKUs
                        const possibleSku = Object.entries(producto._original).find(([key, value]) => {
                            const keyLower = key.toLowerCase();
                            const valueStr = value.toString().trim();
                            return (keyLower.includes('codigo') || keyLower.includes('cod') || 
                                    keyLower === 'id') && 
                                   valueStr !== '' && 
                                   valueStr.length >= 3; // SKUs deben tener al menos 3 caracteres
                        });
                        
                        if (possibleSku) {
                            skuFinal = possibleSku[1];
                            console.log(`🔍 SKU recuperado desde campo alternativo: ${possibleSku[0]} = "${skuFinal}"`);
                        }
                    }
                }
            }
            
            // Validar campo requerido
            if (!skuFinal || skuFinal.toString().trim() === '') {
                resultado.errores.push({
                    registro: producto,
                    error: 'SKU es requerido'
                });
                continue;
            }

            // Normalizar y limpiar SKU - problema común de reconocimiento
            let skuLimpio = skuFinal.toString().trim();
            // Remover caracteres especiales comunes que causan problemas de reconocimiento
            skuLimpio = skuLimpio.replace(/["'`]/g, '').replace(/\s+/g, ' ');

            // Verificar si el producto existe usando SKU limpio
            const { data: existing, error: selectError } = await supabase
                .from('products')
                .select('*')
                .eq('sku', skuLimpio)
                .maybeSingle();

            if (selectError) {
                throw new Error(`Error verificando producto ${skuLimpio}: ${selectError.message}`);
            }
            
            // Preparar datos del producto
            const datosProducto = {};
            
            // Campos obligatorios
            datosProducto.sku = skuLimpio;
            
            // Para actualización: incluir TODOS los campos presentes (incluso si están vacíos)
            // Esto permite sobrescribir campos existentes
            
            // Descripción - siempre actualizar si está presente
            if (producto.descripcion !== undefined) {
                datosProducto.descripcion = producto.descripcion || '';
            }
            
            // Categoría - siempre actualizar si está presente
            if (producto.categoria !== undefined) {
                datosProducto.categoria = producto.categoria || '';
            }
            
            // Stock actual - siempre actualizar si está presente
            if (producto.stock_actual !== undefined) {
                datosProducto.stock_actual = parseInt(producto.stock_actual) || 0;
            }
            
            // Costo FOB - siempre actualizar si está presente
            if (producto.costo_fob_rmb !== undefined) {
                datosProducto.costo_fob_rmb = parseFloat(producto.costo_fob_rmb) || 0;
            }
            
            // CBM - siempre actualizar si está presente
            if (producto.cbm !== undefined) {
                datosProducto.cbm = parseFloat(producto.cbm) || 0;
            }
            
            // Link - siempre actualizar si está presente
            if (producto.link !== undefined) {
                datosProducto.link = producto.link || '';
            }
            
            // Status - siempre actualizar si está presente
            if (producto.status !== undefined) {
                datosProducto.status = producto.status || 'NEEDS_REPLENISHMENT';
            }
            
            // Desconsiderado - siempre actualizar si está presente
            if (producto.desconsiderado !== undefined) {
                datosProducto.desconsiderado = Boolean(producto.desconsiderado);
            }
            
            // Precio venta sugerido - siempre actualizar si está presente
            if (producto.precio_venta_sugerido !== undefined) {
                datosProducto.precio_venta_sugerido = parseFloat(producto.precio_venta_sugerido) || null;
            }
            
            // Proveedor - siempre actualizar si está presente
            if (producto.proveedor !== undefined) {
                datosProducto.proveedor = producto.proveedor || '';
            }
            
            // Notas - siempre actualizar si está presente
            if (producto.notas !== undefined) {
                datosProducto.notas = producto.notas || '';
            }
            
            // Código interno - siempre actualizar si está presente
            if (producto.codigo_interno !== undefined) {
                datosProducto.codigo_interno = producto.codigo_interno || '';
            }

            if (existing) {
                // ACTUALIZAR producto existente - SOBRESCRIBIR todos los campos presentes
                console.log(`🔄 Actualizando producto existente: ${skuLimpio}`);
                console.log(`📝 Campos a actualizar:`, Object.keys(datosProducto).filter(k => k !== 'sku'));

                const { data, error } = await supabase
                    .from('products')
                    .update(datosProducto)
                    .eq('sku', skuLimpio)
                    .select();

                if (error) throw error;

                console.log(`✅ Producto actualizado exitosamente: ${skuLimpio}`);
                resultado.duplicados.push(data[0]); // En este contexto significa "actualizado"

            } else {
                // CREAR nuevo producto - VERIFICAR QUE NO EXISTA PRIMERO
                console.log(`📦 Creando nuevo producto: ${skuLimpio}`);

                // Verificación adicional antes de insertar
                const { data: doubleCheck, error: doubleCheckError } = await supabase
                    .from('products')
                    .select('sku')
                    .eq('sku', skuLimpio)
                    .maybeSingle();

                if (doubleCheckError) {
                    throw new Error(`Error verificando duplicado ${skuLimpio}: ${doubleCheckError.message}`);
                }

                if (doubleCheck) {
                    // El producto ya existe, actualizar en lugar de insertar
                    console.log(`⚠️ Producto ${skuLimpio} ya existe (detectado en verificación doble), actualizando...`);

                    const { data, error } = await supabase
                        .from('products')
                        .update(datosProducto)
                        .eq('sku', skuLimpio)
                        .select();

                    if (error) throw error;
                    resultado.duplicados.push(data[0]);
                } else {
                    // Valores por defecto para productos nuevos
                    const nuevoProducto = {
                        ...datosProducto,
                        descripcion: datosProducto.descripcion || `Producto ${skuLimpio}`,
                        stock_actual: datosProducto.stock_actual ?? 0,
                        costo_fob_rmb: datosProducto.costo_fob_rmb ?? 1.0,
                        cbm: datosProducto.cbm ?? 0.01,
                        status: datosProducto.status || 'NEEDS_REPLENISHMENT',
                        link: datosProducto.link || '',
                        desconsiderado: datosProducto.desconsiderado ?? false
                    };

                    const { data, error } = await supabase
                        .from('products')
                        .insert(nuevoProducto)
                        .select();

                    if (error) {
                        // Si falla por constraint de duplicado, intentar actualizar
                        if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('unique')) {
                            console.log(`⚠️ Error de duplicado detectado al insertar ${skuLimpio}, intentando actualizar...`);

                            const { data: updateData, error: updateError } = await supabase
                                .from('products')
                                .update(datosProducto)
                                .eq('sku', skuLimpio)
                                .select();

                            if (updateError) throw updateError;
                            resultado.duplicados.push(updateData[0]);
                        } else {
                            throw error;
                        }
                    } else {
                        resultado.nuevos.push(data[0]);
                        resultado.productosNuevos.push(data[0]);
                    }
                }
            }

        } catch (error) {
            resultado.errores.push({
                registro: producto,
                error: error.message
            });
        }
    }

    return resultado;
}
// Función para verificar y crear contenedor automáticamente
async function verificarYCrearContenedor(container_number, datosCompra, resultado) {
    try {
        // Verificar si el contenedor existe
        const { data: existingContainer, error: selectError } = await supabase
            .from('containers')
            .select('container_number')
            .eq('container_number', container_number)
            .maybeSingle();

        if (selectError) {
            throw new Error(`Error verificando contenedor ${container_number}: ${selectError.message}`);
        }

        if (!existingContainer) {
            console.log(`🚢 Creando contenedor automáticamente: ${container_number}`);
            
            // Crear contenedor automáticamente con datos de la compra
            const nuevoContenedor = {
                container_number: container_number.toString(),
                container_type: datosCompra.container_type || 'STD',
                max_cbm: parseFloat(datosCompra.max_cbm) || 68,
                departure_port: datosCompra.departure_port || '',
                arrival_port: datosCompra.arrival_port || '',
                estimated_departure: datosCompra.estimated_departure || null,
                estimated_arrival: datosCompra.fecha_llegada_estimada || datosCompra.estimated_arrival || null,
                // Solo establecer actual_arrival_date si el status es 'llegado'
                actual_arrival_date: (datosCompra.status_compra === 'llegado' && datosCompra.fecha_llegada_real) ? datosCompra.fecha_llegada_real : null,
                shipping_company: datosCompra.shipping_company || '',
                notes: datosCompra.notes || `Auto-creado desde compra de ${datosCompra.sku}`,
                status: (datosCompra.status_compra === 'llegado') ? 'DELIVERED' : 'CREATED',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('containers')
                .insert(nuevoContenedor)
                .select();

            if (error) {
                throw new Error(`No se pudo crear contenedor ${container_number}: ${error.message}`);
            } else {
                // Agregar a una lista especial de contenedores creados
                if (!resultado.contenedoresNuevos) {
                    resultado.contenedoresNuevos = [];
                }
                resultado.contenedoresNuevos.push(data[0]);
                console.log(`✅ Contenedor ${container_number} creado automáticamente`);
                
                // Pequeña pausa para asegurar que se commitee la transacción
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } else {
            console.log(`✓ Contenedor ${container_number} ya existe`);
        }
    } catch (error) {
        console.error(`❌ Error en verificarYCrearContenedor para ${container_number}:`, error.message);
        throw error; // Re-throw para que el proceso padre lo maneje
    }
}

// Configuración para Netlify Functions
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb', // Netlify permite hasta 6 MB
    },
    responseLimit: '6mb',
    externalResolver: true,
  },
  // Netlify Free: 10s timeout, Pro: 26s
  // Procesamos chunks pequeños para completar en <10s
  maxDuration: 10, // 10 segundos para Netlify Free
}
