// pages/api/bulk-upload.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
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

    const allowedTables = ['ventas', 'compras', 'containers'];
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
        }

        return res.status(200).json({
            mensaje: `Carga masiva completada para ${tableType}`,
            resumen: {
                nuevos: processedData.nuevos.length,
                duplicados: processedData.duplicados.length,
                errores: processedData.errores.length,
                productosNuevos: processedData.productosNuevos.length
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
            // Validar campos requeridos
            if (!venta.numero_venta || !venta.sku || !venta.cantidad) {
                resultado.errores.push({
                    registro: venta,
                    error: 'Campos requeridos: numero_venta, sku, cantidad'
                });
                continue;
            }

            // Verificar duplicado
            const { data: existing } = await supabase
                .from('ventas')
                .select('numero_venta')
                .eq('numero_venta', venta.numero_venta)
                .single();

            if (existing) {
                resultado.duplicados.push(venta.numero_venta);
                continue;
            }

            // Verificar y crear producto si no existe
            await verificarYCrearProducto(venta.sku, venta.descripcion_producto, resultado);

            // Insertar nueva venta
            const nuevaVenta = {
                numero_venta: venta.numero_venta,
                sku: venta.sku,
                cantidad: parseInt(venta.cantidad),
                fecha_venta: venta.fecha_venta || new Date().toISOString(),
                precio_venta_clp: venta.precio_venta_clp ? parseFloat(venta.precio_venta_clp) : null
            };

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
            // Validar campos requeridos
            if (!compra.numero_compra || !compra.sku || !compra.cantidad) {
                resultado.errores.push({
                    registro: compra,
                    error: 'Campos requeridos: numero_compra, sku, cantidad'
                });
                continue;
            }

            // Verificar duplicado
            const { data: existing } = await supabase
                .from('compras')
                .select('numero_compra')
                .eq('numero_compra', compra.numero_compra)
                .single();

            if (existing) {
                resultado.duplicados.push(compra.numero_compra);
                continue;
            }

            // Verificar y crear producto si no existe
            await verificarYCrearProducto(compra.sku, compra.descripcion_producto, resultado);

            // Insertar nueva compra
            const nuevaCompra = {
                numero_compra: compra.numero_compra,
                sku: compra.sku,
                cantidad: parseInt(compra.cantidad),
                fecha_compra: compra.fecha_compra || new Date().toISOString(),
                fecha_llegada_estimada: compra.fecha_llegada_estimada,
                fecha_llegada_real: compra.fecha_llegada_real,
                status_compra: compra.status_compra || 'en_transito',
                container_number: compra.container_number,
                proveedor: compra.proveedor,
                precio_compra: compra.precio_compra ? parseFloat(compra.precio_compra) : null
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
                .single();

            if (existing) {
                resultado.duplicados.push(container.container_number);
                continue;
            }

            // Insertar nuevo container
            const nuevoContainer = {
                container_number: container.container_number,
                container_type: container.container_type || 'STD',
                max_cbm: parseFloat(container.max_cbm) || 68,
                departure_port: container.departure_port || '',
                arrival_port: container.arrival_port || '',
                estimated_departure: container.estimated_departure,
                estimated_arrival: container.estimated_arrival,
                actual_departure: container.actual_departure,
                actual_arrival_date: container.actual_arrival_date,
                shipping_company: container.shipping_company || '',
                notes: container.notes || '',
                status: container.status || 'CREATED',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('containers')
                .insert(nuevoContainer)
                .select();

            if (error) throw error;
            
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
    // Verificar si el producto existe
    const { data: existingProduct } = await supabase
        .from('products')
        .select('sku')
        .eq('sku', sku)
        .single();

    if (!existingProduct) {
        // Crear producto automáticamente
        const nuevoProducto = {
            sku: sku,
            descripcion: descripcion || `Producto ${sku} (Auto-creado)`,
            costo_fob_rmb: 1,
            cbm: 0.01,
            stock_actual: 0,
            status: 'NEEDS_REPLENISHMENT',
            desconsiderado: false,
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('products')
            .insert(nuevoProducto)
            .select();

        if (error) {
            console.warn(`No se pudo crear producto ${sku}:`, error.message);
        } else {
            resultado.productosNuevos.push(data[0]);
            console.log(`✅ Producto ${sku} creado automáticamente`);
        }
    }
}