// pages/api/timeline.js
import { supabase } from '../../lib/supabaseClient';

// Función para calcular la venta diaria y precio promedio como en analysis.js
async function calculateVentaDiaria(sku, config = {}) {
    
    const diasAnalisis = config.diasAnalisisVentas || 60;
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - diasAnalisis);
    
    const { data: ventas, error } = await supabase
        .from('ventas')
        .select('cantidad, fecha_venta, precio_unitario')
        .eq('sku', sku)
        .gte('fecha_venta', fechaInicio.toISOString())
        .order('fecha_venta', { ascending: false });
    
    if (error || !ventas || ventas.length === 0) {
        return { ventaDiaria: 0, precioPromedio: 0, fechasAnalisis: null };
    }
    
    const totalVendido = ventas.reduce((sum, venta) => sum + (venta.cantidad || 0), 0);
    const ventaDiaria = totalVendido / diasAnalisis;
    
    // Calcular precio promedio ponderado por cantidad
    const ventasConPrecio = ventas.filter(v => v.precio_unitario && v.precio_unitario > 0);
    let precioPromedio = 0;
    
    if (ventasConPrecio.length > 0) {
        const totalIngresos = ventasConPrecio.reduce((sum, venta) => 
            sum + ((venta.precio_unitario || 0) * (venta.cantidad || 0)), 0
        );
        const totalCantidadConPrecio = ventasConPrecio.reduce((sum, venta) => 
            sum + (venta.cantidad || 0), 0
        );
        
        if (totalCantidadConPrecio > 0) {
            precioPromedio = totalIngresos / totalCantidadConPrecio;
        }
    }
    
    return {
        ventaDiaria,
        precioPromedio,
        fechasAnalisis: {
            fechaInicio: fechaInicio.toISOString(),
            fechaFin: new Date().toISOString(),
            diasPeriodo: diasAnalisis,
            unidadesVendidas: totalVendido
        }
    };
}

// Función para obtener llegadas futuras (contenedores + compras)
async function obtenerLlegadasFuturas(sku) {
    const llegadas = [];
    const hoy = new Date();
    
    // 1. Obtener llegadas desde productos en tránsito (como el analysis)
    const { data: transitProducts } = await supabase
        .from('products')
        .select('sku, status, purchase_details, manufacturing_details, shipping_details, estimated_arrival')
        .eq('sku', sku)
        .in('status', ['PURCHASE_CONFIRMED', 'MANUFACTURED', 'SHIPPED']);
    
    if (transitProducts) {
        transitProducts.forEach(product => {
            let cantidad = 0;
            let fechaLlegada = null;
            let source = '';
            
            switch (product.status) {
                case 'PURCHASE_CONFIRMED':
                    cantidad = product.purchase_details?.confirmedQuantity || 0;
                    if (product.purchase_details?.estimatedDeliveryDate) {
                        fechaLlegada = new Date(product.purchase_details.estimatedDeliveryDate);
                    }
                    source = 'Compra confirmada';
                    break;
                    
                case 'MANUFACTURED':
                    cantidad = product.manufacturing_details?.manufacturedQuantity || 0;
                    if (product.manufacturing_details?.shippingDate) {
                        fechaLlegada = new Date(product.manufacturing_details.shippingDate);
                        fechaLlegada.setDate(fechaLlegada.getDate() + 45); // Asumimos 45 días de tránsito
                    }
                    source = 'Producto manufacturado';
                    break;
                    
                case 'SHIPPED':
                    cantidad = product.shipping_details?.shippedQuantity || 0;
                    if (product.estimated_arrival) {
                        fechaLlegada = new Date(product.estimated_arrival);
                    }
                    source = `Contenedor ${product.shipping_details?.containerNumber || 'desconocido'}`;
                    break;
            }
            
            if (cantidad > 0 && fechaLlegada && fechaLlegada > hoy) {
                llegadas.push({
                    fecha: fechaLlegada.toISOString(),
                    cantidad,
                    source,
                    type: 'product_transit'
                });
            }
        });
    }
    
    // 2. Obtener llegadas desde contenedores
    const { data: containers } = await supabase
        .from('containers')
        .select('*')
        .in('status', ['CREATED', 'IN_USE', 'SHIPPED']);
    
    if (containers) {
        for (const container of containers) {
            // Obtener productos asignados a este contenedor
            const { data: containerProducts } = await supabase
                .from('products')
                .select('sku, shipping_details')
                .eq('status', 'SHIPPED');
            
            const productsInContainer = containerProducts?.filter(p => 
                p.shipping_details?.containerNumber === container.container_number &&
                p.sku === sku
            ) || [];
            
            if (productsInContainer.length > 0 && container.estimated_arrival) {
                const fechaLlegada = new Date(container.estimated_arrival);
                if (fechaLlegada > hoy) {
                    const cantidadTotal = productsInContainer.reduce((sum, p) => 
                        sum + (p.shipping_details?.shippedQuantity || 0), 0
                    );
                    
                    if (cantidadTotal > 0) {
                        llegadas.push({
                            fecha: fechaLlegada.toISOString(),
                            cantidad: cantidadTotal,
                            source: `Contenedor ${container.container_number}`,
                            type: 'container'
                        });
                    }
                }
            }
        }
    }
    
    // 3. Obtener compras futuras sin contenedor asignado
    const { data: compras } = await supabase
        .from('compras')
        .select('*')
        .eq('sku', sku)
        .in('status_compra', ['en_transito', 'confirmado'])
        .not('fecha_llegada_estimada', 'is', null);
    
    if (compras) {
        compras.forEach(compra => {
            const fechaLlegada = new Date(compra.fecha_llegada_estimada);
            if (fechaLlegada > hoy) {
                // Verificar que no esté ya incluida en los contenedores
                const yaIncluida = llegadas.some(l => 
                    l.type === 'container' && 
                    Math.abs(new Date(l.fecha) - fechaLlegada) < 7 * 24 * 60 * 60 * 1000 // Dentro de 7 días
                );
                
                if (!yaIncluida) {
                    llegadas.push({
                        fecha: fechaLlegada.toISOString(),
                        cantidad: compra.cantidad || 0,
                        source: 'Compra directa',
                        type: 'purchase'
                    });
                }
            }
        });
    }
    
    // Ordenar por fecha y consolidar llegadas del mismo día
    llegadas.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    
    const llegadasConsolidadas = [];
    llegadas.forEach(llegada => {
        const fechaStr = llegada.fecha.split('T')[0];
        const existente = llegadasConsolidadas.find(l => l.fecha.split('T')[0] === fechaStr);
        
        if (existente) {
            existente.cantidad += llegada.cantidad;
            existente.source += ` + ${llegada.source}`;
        } else {
            llegadasConsolidadas.push({ ...llegada });
        }
    });
    
    return llegadasConsolidadas;
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
    
    try {
        // 1. Obtener configuración directamente de la base de datos
        const { data: configData } = await supabase
            .from('configuration')
            .select('data')
            .eq('id', 3)
            .single();
        
        const config = configData?.data || {};
        
        // 2. Obtener todos los productos únicos
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('sku, descripcion, stock_actual, status, costo_fob_rmb, cbm')
            .not('desconsiderado', 'is', true);
        
        if (productsError) {
            throw new Error(`Error obteniendo productos: ${productsError.message}`);
        }
        
        // 3. Calcular timeline para cada producto
        const timeline = [];
        
        for (const product of products || []) {
            try {
                // Calcular venta diaria y precio promedio
                const { ventaDiaria, precioPromedio } = await calculateVentaDiaria(product.sku, config);
                
                // Obtener llegadas futuras
                const llegadas = await obtenerLlegadasFuturas(product.sku);
                
                // Calcular stock en tránsito
                const enTransito = llegadas.reduce((sum, l) => sum + l.cantidad, 0);
                
                // Proyectar quiebre de stock
                let diasHastaQuiebre = null;
                if (ventaDiaria > 0) {
                    diasHastaQuiebre = Math.floor((product.stock_actual || 0) / ventaDiaria);
                }
                
                // Calcular stock máximo saludable
                const stockMaximo = ventaDiaria * (config.tiempoEntrega || 60);
                
                timeline.push({
                    sku: product.sku,
                    descripcion: product.descripcion || '',
                    status: product.status,
                    stock_actual: product.stock_actual || 0,
                    venta_diaria: ventaDiaria,
                    precio_promedio: precioPromedio,
                    enTransito,
                    llegadas: llegadas.slice(0, 10), // Máximo 10 llegadas próximas
                    diasHastaQuiebre,
                    stockMaximo,
                    // Alertas
                    alertas: {
                        quiebreInminente: diasHastaQuiebre !== null && diasHastaQuiebre <= 7,
                        stockBajo: (product.stock_actual || 0) < (stockMaximo * 0.3),
                        sobrestock: (product.stock_actual || 0) > (stockMaximo * 1.5),
                        sinVentas: ventaDiaria === 0
                    }
                });
                
            } catch (productError) {
                console.error(`Error procesando producto ${product.sku}:`, productError);
                // Continuar con el siguiente producto
            }
        }
        
        // 4. Ordenar timeline por urgencia (quiebre más próximo primero)
        timeline.sort((a, b) => {
            // Productos con quiebre inminente primero
            if (a.alertas.quiebreInminente && !b.alertas.quiebreInminente) return -1;
            if (!a.alertas.quiebreInminente && b.alertas.quiebreInminente) return 1;
            
            // Luego por días hasta quiebre (menor primero)
            if (a.diasHastaQuiebre !== null && b.diasHastaQuiebre !== null) {
                return a.diasHastaQuiebre - b.diasHastaQuiebre;
            }
            if (a.diasHastaQuiebre !== null) return -1;
            if (b.diasHastaQuiebre !== null) return 1;
            
            // Finalmente por SKU alfabético
            return a.sku.localeCompare(b.sku);
        });
        
        // 5. Estadísticas generales
        const estadisticas = {
            totalProductos: timeline.length,
            quiebresInminentes: timeline.filter(t => t.alertas.quiebreInminente).length,
            stockBajo: timeline.filter(t => t.alertas.stockBajo).length,
            sobrestocks: timeline.filter(t => t.alertas.sobrestock).length,
            sinVentas: timeline.filter(t => t.alertas.sinVentas).length,
            enTransitoTotal: timeline.reduce((sum, t) => sum + t.enTransito, 0)
        };
        
        return res.status(200).json({
            timeline,
            estadisticas,
            config: {
                tiempoEntrega: config.tiempoEntrega || 60,
                diasAnalisisVentas: config.diasAnalisisVentas || 60,
                stockMaximoMultiplicador: config.stockMaximoMultiplicador || 1.0
            },
            generatedAt: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error en API timeline:', error);
        return res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
}