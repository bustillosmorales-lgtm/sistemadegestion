// pages/api/bulk-upload.js
import { supabase } from '../../lib/supabaseClient';
import * as XLSX from 'xlsx';

export default async function handler(req, res) {
    // Manejar descarga de template de productos existentes
    if (req.method === 'GET') {
        try {
            return await descargarTemplateProductos(res);
        } catch (error) {
            return res.status(500).json({ error: 'Error generando template de productos: ' + error.message });
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

    if (!tableType || !uploadData || !Array.isArray(uploadData)) {
        return res.status(400).json({ error: 'Faltan parámetros: tableType y data (array) requeridos.' });
    }

    const allowedTables = ['ventas', 'compras', 'containers', 'productos'];
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

    for (const venta of ventasData) {
        try {
            // Validar campos requeridos (más flexible)
            if (!venta.sku || !venta.cantidad) {
                resultado.errores.push({
                    registro: venta,
                    error: 'Campos requeridos: sku, cantidad'
                });
                continue;
            }
            
            // Generar numero_venta automático si no existe
            if (!venta.numero_venta) {
                const timestamp = Date.now().toString().slice(-8);
                const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
                venta.numero_venta = `V${timestamp}${random}`;
            }

            // La tabla ventas no tiene numero_venta, usar combinación sku+fecha para detectar duplicados
            const { data: existing } = await supabase
                .from('ventas')
                .select('*')
                .eq('sku', venta.sku)
                .eq('fecha_venta', venta.fecha_venta)
                .single();

            if (existing) {
                resultado.duplicados.push(`${venta.sku}-${venta.fecha_venta}`);
                continue;
            }

            // Verificar y crear producto si no existe ANTES de insertar venta
            await verificarYCrearProducto(venta.sku, venta.descripcion_producto || venta.descripcion, resultado);

            // Insertar nueva venta (solo campos que existen en la tabla)
            const nuevaVenta = {
                sku: venta.sku.toString(),
                cantidad: parseInt(venta.cantidad),
                fecha_venta: venta.fecha_venta || new Date().toISOString().split('T')[0] + ' 00:00:00'
            };

            console.log(`💾 Insertando venta para SKU: ${venta.sku}`);

            const { data, error } = await supabase
                .from('ventas')
                .insert(nuevaVenta)
                .select();

            if (error) throw error;
            
            resultado.nuevos.push(data[0]);

        } catch (error) {
            resultado.errores.push({
                registro: venta,
                error: error.message
            });
        }
    }

    return resultado;
}

async function procesarCompras(comprasData) {
    const resultado = {
        nuevos: [],
        duplicados: [],
        errores: [],
        productosNuevos: []
    };

    for (const compra of comprasData) {
        try {
            // Validar campos requeridos (más flexible)
            if (!compra.sku || !compra.cantidad) {
                resultado.errores.push({
                    registro: compra,
                    error: 'Campos requeridos: sku, cantidad'
                });
                continue;
            }
            
            // Generar numero_compra automático si no existe
            if (!compra.numero_compra) {
                const timestamp = Date.now().toString().slice(-8);
                const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
                compra.numero_compra = `C${timestamp}${random}`;
            }

            // La tabla compras no tiene numero_compra, usar combinación sku+fecha para detectar duplicados
            const { data: existing } = await supabase
                .from('compras')
                .select('*')
                .eq('sku', compra.sku)
                .eq('fecha_compra', compra.fecha_compra)
                .maybeSingle();

            if (existing) {
                resultado.duplicados.push(`${compra.sku}-${compra.fecha_compra}`);
                continue;
            }

            // Verificar y crear producto si no existe
            await verificarYCrearProducto(compra.sku, compra.descripcion_producto, resultado);

            // Si se especifica container_number, verificar que existe o crearlo
            if (compra.container_number) {
                await verificarYCrearContenedor(compra.container_number, compra, resultado);
            }

            // Insertar nueva compra (solo campos que existen en la tabla)
            const nuevaCompra = {
                sku: compra.sku,
                cantidad: parseInt(compra.cantidad),
                fecha_compra: compra.fecha_compra || new Date().toISOString().split('T')[0] + ' 00:00:00',
                fecha_llegada_estimada: compra.fecha_llegada_estimada || null,
                fecha_llegada_real: compra.fecha_llegada_real || null,
                status_compra: compra.status_compra || 'en_transito'
            };

            const { data, error } = await supabase
                .from('compras')
                .insert(nuevaCompra)
                .select();

            if (error) throw error;
            
            resultado.nuevos.push(data[0]);

        } catch (error) {
            resultado.errores.push({
                registro: compra,
                error: error.message
            });
        }
    }

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
            // Solo establecer actual_arrival_date si realmente tiene la fecha Y el status indica que llegó
            const actualArrivalDate = container.actual_arrival_date && container.actual_arrival_date !== '' 
                ? container.actual_arrival_date 
                : null;
            
            // Determinar status basado en si tiene fecha real de llegada
            let containerStatus = container.status || 'CREATED';
            if (actualArrivalDate) {
                containerStatus = 'DELIVERED';
            } else if (container.estimated_departure || container.shipping_company) {
                containerStatus = 'IN_TRANSIT';
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

// Función para verificar y crear producto automáticamente
async function verificarYCrearProducto(sku, descripcion, resultado) {
    try {
        // Verificar si el producto existe (manejar caso donde no hay coincidencias)
        const { data: existingProduct, error: selectError } = await supabase
            .from('products')
            .select('sku')
            .eq('sku', sku)
            .maybeSingle(); // Usar maybeSingle en lugar de single para evitar errores cuando no existe

        if (selectError) {
            throw new Error(`Error verificando producto ${sku}: ${selectError.message}`);
        }

        if (!existingProduct) {
            console.log(`📦 Creando producto automáticamente: ${sku}`);
            
            // Crear producto automáticamente (solo campos que existen en la tabla)
            const nuevoProducto = {
                sku: sku.toString(),
                descripcion: descripcion || `Producto ${sku} (Auto-creado)`,
                costo_fob_rmb: 1.0,
                cbm: 0.01,
                stock_actual: 0,
                status: 'NEEDS_REPLENISHMENT',
                link: '',
                desconsiderado: false
            };

            const { data, error } = await supabase
                .from('products')
                .insert(nuevoProducto)
                .select();

            if (error) {
                throw new Error(`No se pudo crear producto ${sku}: ${error.message}`);
            } else {
                resultado.productosNuevos.push(data[0]);
                console.log(`✅ Producto ${sku} creado automáticamente`);
                
                // Pequeña pausa para asegurar que se commitee la transacción
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } else {
            console.log(`✓ Producto ${sku} ya existe`);
        }
    } catch (error) {
        console.error(`❌ Error en verificarYCrearProducto para ${sku}:`, error.message);
        throw error; // Re-throw para que el proceso padre lo maneje
    }
}

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
            // PRIMERO: Intentar obtener SKU desde datos originales si no está mapeado
            let skuFinal = producto.sku;
            
            if (!skuFinal || skuFinal.toString().trim() === '') {
                // Buscar SKU en los datos originales
                if (producto._original) {
                    const possibleSku = Object.entries(producto._original).find(([key, value]) => {
                        const keyLower = key.toLowerCase();
                        return (keyLower.includes('sku') || keyLower.includes('codigo') || 
                                keyLower.includes('cod') || keyLower === 'id') && 
                               value && value.toString().trim() !== '';
                    });
                    
                    if (possibleSku) {
                        skuFinal = possibleSku[1];
                        console.log(`📋 SKU recuperado desde datos originales: ${skuFinal}`);
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
                // CREAR nuevo producto
                console.log(`📦 Creando nuevo producto: ${skuLimpio}`);
                
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

                if (error) throw error;
                
                resultado.nuevos.push(data[0]);
                resultado.productosNuevos.push(data[0]);
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
