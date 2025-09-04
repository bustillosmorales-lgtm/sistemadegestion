// pages/api/ai-diagnostics.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
    const { method } = req;

    switch (method) {
        case 'GET':
            return await handleGetDiagnostics(req, res);
        case 'POST':
            return await handleCreateDiagnostic(req, res);
        default:
            res.setHeader('Allow', ['GET', 'POST']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}

async function handleGetDiagnostics(req, res) {
    try {
        const { sku, tipo, limit = 50 } = req.query;

        let query = supabase
            .from('stock_events_analysis')
            .select(`
                *,
                products!stock_events_analysis_sku_fkey(sku, descripcion, categoria)
            `)
            .order('fecha_evento', { ascending: false });

        if (sku) {
            query = query.eq('sku', sku);
        }

        if (tipo) {
            query = query.eq('evento_tipo', tipo);
        }

        const { data: diagnosticos, error } = await query.limit(parseInt(limit));

        if (error) {
            console.error('Error obteniendo diagnósticos:', error);
            return res.status(500).json({ error: 'Error obteniendo diagnósticos IA' });
        }

        // Estadísticas de diagnósticos
        const stats = {
            total_eventos: diagnosticos?.length || 0,
            por_tipo: {},
            causas_principales: {},
            productos_mas_problematicos: {}
        };

        if (diagnosticos && diagnosticos.length > 0) {
            // Agrupar por tipo
            diagnosticos.forEach(d => {
                stats.por_tipo[d.evento_tipo] = (stats.por_tipo[d.evento_tipo] || 0) + 1;
                stats.causas_principales[d.causa_principal] = (stats.causas_principales[d.causa_principal] || 0) + 1;
                stats.productos_mas_problematicos[d.sku] = (stats.productos_mas_problematicos[d.sku] || 0) + 1;
            });
        }

        return res.status(200).json({
            diagnosticos: diagnosticos || [],
            estadisticas: stats,
            total: diagnosticos?.length || 0
        });

    } catch (error) {
        console.error('Error en API ai-diagnostics GET:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}

async function handleCreateDiagnostic(req, res) {
    try {
        const { sku, evento_tipo, analyze_all = false } = req.body;

        if (!analyze_all && !sku) {
            return res.status(400).json({ 
                error: 'Se requiere SKU o analyze_all=true' 
            });
        }

        let productos_analizar = [];

        if (analyze_all) {
            // Obtener productos con posibles problemas
            const { data: productos, error: productosError } = await supabase
                .from('products')
                .select(`
                    sku, descripcion, categoria, stock_actual,
                    sugerencia_reposicion_ia, confianza_prediccion_ia,
                    breakdown
                `)
                .not('desconsiderado', 'is', true);

            if (productosError) {
                return res.status(500).json({ error: 'Error obteniendo productos' });
            }

            // Filtrar productos problemáticos
            productos_analizar = productos.filter(p => {
                const stockActual = p.stock_actual || 0;
                const ventaDiaria = p.breakdown?.ventaDiaria || 0;
                const diasCobertura = ventaDiaria > 0 ? stockActual / ventaDiaria : 0;
                
                // Problemas potenciales
                return stockActual === 0 || // Stock agotado
                       diasCobertura > 120 || // Más de 4 meses stock
                       (p.sugerencia_reposicion_ia && p.sugerencia_reposicion_ia > stockActual * 3); // IA sugiere mucho más
            });

        } else {
            // Analizar SKU específico
            const { data: producto, error: productoError } = await supabase
                .from('products')
                .select('*')
                .eq('sku', sku)
                .single();

            if (productoError || !producto) {
                return res.status(404).json({ error: 'Producto no encontrado' });
            }

            productos_analizar = [producto];
        }

        if (productos_analizar.length === 0) {
            return res.status(200).json({
                message: 'No se encontraron productos con problemas para analizar',
                diagnosticos_creados: 0
            });
        }

        // Realizar diagnósticos
        const diagnosticos_creados = [];
        const errores = [];

        for (const producto of productos_analizar.slice(0, 100)) { // Límite de 100
            try {
                const diagnostico = await analyzeStockEvent(producto, evento_tipo);
                
                if (diagnostico) {
                    // Verificar si ya existe diagnóstico reciente
                    const { data: existente } = await supabase
                        .from('stock_events_analysis')
                        .select('id')
                        .eq('sku', producto.sku)
                        .eq('evento_tipo', diagnostico.evento_tipo)
                        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                        .single();

                    if (!existente) {
                        const { data: nuevoDiagnostico, error: insertError } = await supabase
                            .from('stock_events_analysis')
                            .insert(diagnostico)
                            .select()
                            .single();

                        if (insertError) {
                            errores.push({
                                sku: producto.sku,
                                error: insertError.message
                            });
                        } else {
                            diagnosticos_creados.push(nuevoDiagnostico);
                        }
                    }
                }

            } catch (error) {
                errores.push({
                    sku: producto.sku,
                    error: error.message
                });
            }
        }

        return res.status(200).json({
            message: `Diagnósticos completados`,
            resultados: {
                productos_analizados: productos_analizar.length,
                diagnosticos_creados: diagnosticos_creados.length,
                errores: errores.length
            },
            diagnosticos: diagnosticos_creados,
            errores: errores
        });

    } catch (error) {
        console.error('Error en API ai-diagnostics POST:', error);
        return res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message
        });
    }
}

async function analyzeStockEvent(producto, eventoTipo = null) {
    try {
        const stockActual = producto.stock_actual || 0;
        const ventaDiaria = parseFloat(producto.breakdown?.ventaDiaria || 0);
        const diasCobertura = ventaDiaria > 0 ? stockActual / ventaDiaria : 0;

        let tipoEvento = eventoTipo;
        
        // Detectar automáticamente tipo de evento si no se especifica
        if (!tipoEvento) {
            if (stockActual === 0) {
                tipoEvento = 'quiebre_stock';
            } else if (diasCobertura > 120) {
                tipoEvento = 'exceso_stock';
            } else {
                return null; // No hay problema detectado
            }
        }

        const hoy = new Date();
        
        let diagnostico = {
            sku: producto.sku,
            evento_tipo: tipoEvento,
            fecha_evento: hoy.toISOString().split('T')[0],
            stock_durante_evento: stockActual,
            dias_cobertura_durante: Math.round(diasCobertura),
            venta_diaria_promedio: ventaDiaria,
            categoria_producto: producto.categoria || 'Unknown',
            causa_principal: 'unknown',
            factores_contribuyentes: {},
            confianza_diagnostico: 0.5,
            evidencia_detectada: {},
            patron_detectado: false,
            recomendaciones_ia: [],
            created_at: hoy.toISOString()
        };

        if (tipoEvento === 'quiebre_stock') {
            diagnostico = await analyzeStockout(diagnostico, producto);
        } else if (tipoEvento === 'exceso_stock') {
            diagnostico = await analyzeExcessStock(diagnostico, producto);
        }

        return diagnostico;

    } catch (error) {
        console.error(`Error analizando evento para ${producto.sku}:`, error);
        return null;
    }
}

async function analyzeStockout(diagnostico, producto) {
    const sku = producto.sku;
    const categoria = producto.categoria || 'Unknown';
    
    // Obtener ventas recientes para análisis
    const { data: ventasRecientes } = await supabase
        .from('ventas')
        .select('cantidad, fecha_venta')
        .eq('sku', sku)
        .order('fecha_venta', { ascending: false })
        .limit(30);

    let causaPrincipal = 'agotamiento_natural';
    let evidencia = {};
    let factoresContribuyentes = {};
    let recomendaciones = [];
    let confianza = 0.6;

    if (ventasRecientes && ventasRecientes.length > 0) {
        // Análisis de patrones de venta
        const ventasUltimos7dias = ventasRecientes
            .filter(v => {
                const fechaVenta = new Date(v.fecha_venta);
                const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                return fechaVenta >= hace7dias;
            });

        const ventasUltimos30dias = ventasRecientes.slice(0, 30);
        const promedioVentas30d = ventasUltimos30dias.reduce((sum, v) => sum + v.cantidad, 0) / Math.max(ventasUltimos30dias.length, 1);
        const ventaMaxima = Math.max(...ventasUltimos30dias.map(v => v.cantidad));

        // Detectar pico de demanda
        const picoRatio = promedioVentas30d > 0 ? ventaMaxima / promedioVentas30d : 1;

        evidencia = {
            venta_promedio_30d: Math.round(promedioVentas30d * 10) / 10,
            venta_maxima_30d: ventaMaxima,
            pico_ratio: Math.round(picoRatio * 100) / 100,
            ventas_ultimos_7d: ventasUltimos7dias.length
        };

        if (picoRatio > 2.5) {
            causaPrincipal = 'pico_demanda_inesperado';
            confianza = 0.85;
            
            // Verificar si coincide con eventos estacionales
            const fechaReciente = ventasRecientes[0].fecha_venta;
            const mesEvento = new Date(fechaReciente).getMonth() + 1;
            
            const eventosChile = getEventosParaMes(mesEvento);
            const eventoAplicable = eventosChile.find(e => 
                e.categories && e.categories.includes(categoria)
            );
            
            if (eventoAplicable) {
                causaPrincipal = `evento_estacional_${eventoAplicable.name.toLowerCase().replace(/\s+/g, '_')}`;
                factoresContribuyentes['evento_estacional'] = eventoAplicable.name;
                confianza = 0.92;
                
                recomendaciones.push(
                    `Preparar stock 3x normal para próximo ${eventoAplicable.name}`,
                    `Crear alerta 90 días antes de ${eventoAplicable.name}`,
                    'Coordinar con equipo marketing eventos estacionales'
                );
            } else {
                recomendaciones.push(
                    'Investigar causa del pico de demanda',
                    'Implementar alertas de demanda anómala',
                    'Aumentar stock de seguridad en 50%'
                );
            }
            
            evidencia['evento_detectado'] = eventoAplicable?.name || 'Pico anómalo sin evento conocido';
        } else {
            // Quiebre por demanda normal - problema de reabastecimiento
            causaPrincipal = 'falta_reabastecimiento_oportuno';
            factoresContribuyentes['demanda_sostenida'] = `${promedioVentas30d.toFixed(1)} unidades/día`;
            
            recomendaciones = [
                'Revisar tiempo de reabastecimiento actual',
                'Implementar alertas de stock mínimo',
                'Evaluar aumento de stock de seguridad'
            ];
        }
    } else {
        // Sin datos de ventas recientes
        evidencia['sin_ventas_recientes'] = 'No hay registro de ventas en últimos 30 días';
        causaPrincipal = 'producto_discontinuado_posible';
        recomendaciones = [
            'Verificar si producto sigue activo',
            'Revisar demanda histórica más amplia',
            'Evaluar descontinuación del producto'
        ];
    }

    return {
        ...diagnostico,
        causa_principal: causaPrincipal,
        factores_contribuyentes: factoresContribuyentes,
        confianza_diagnostico: confianza,
        evidencia_detectada: evidencia,
        patron_detectado: picoRatio > 2.0,
        recomendaciones_ia: recomendaciones
    };
}

async function analyzeExcessStock(diagnostico, producto) {
    const sku = producto.sku;
    const stockActual = producto.stock_actual || 0;
    const ventaDiaria = parseFloat(producto.breakdown?.ventaDiaria || 0);
    const diasCobertura = ventaDiaria > 0 ? stockActual / ventaDiaria : 0;
    
    let causaPrincipal = 'sobrecompra';
    let evidencia = {};
    let factoresContribuyentes = {};
    let recomendaciones = [];
    let confianza = 0.7;

    // Obtener historial de compras para análisis
    const { data: comprasRecientes } = await supabase
        .from('compras')
        .select('cantidad, fecha_compra, precio_compra')
        .eq('sku', sku)
        .order('fecha_compra', { ascending: false })
        .limit(5);

    // Obtener ventas para análisis de tendencia
    const { data: ventasHistoricas } = await supabase
        .from('ventas')
        .select('cantidad, fecha_venta')
        .eq('sku', sku)
        .order('fecha_venta', { ascending: false })
        .limit(60);

    evidencia = {
        dias_cobertura_actual: Math.round(diasCobertura),
        meses_cobertura: Math.round(diasCobertura / 30 * 10) / 10,
        stock_actual: stockActual,
        venta_diaria: ventaDiaria
    };

    // Análisis de tendencia de ventas
    if (ventasHistoricas && ventasHistoricas.length >= 20) {
        const ventasRecientes = ventasHistoricas.slice(0, 10); // Últimas 10 ventas
        const ventasAnteriores = ventasHistoricas.slice(10, 20); // 10 anteriores
        
        const promedioReciente = ventasRecientes.reduce((sum, v) => sum + v.cantidad, 0) / ventasRecientes.length;
        const promedioAnterior = ventasAnteriores.reduce((sum, v) => sum + v.cantidad, 0) / ventasAnteriores.length;
        
        const tendencia = promedioAnterior > 0 ? (promedioReciente - promedioAnterior) / promedioAnterior : 0;
        
        evidencia['tendencia_ventas'] = {
            promedio_reciente: Math.round(promedioReciente * 10) / 10,
            promedio_anterior: Math.round(promedioAnterior * 10) / 10,
            cambio_porcentual: Math.round(tendencia * 100)
        };
        
        if (tendencia < -0.3) { // Caída mayor al 30%
            causaPrincipal = 'caida_demanda';
            factoresContribuyentes['caida_demanda'] = `${Math.round(Math.abs(tendencia) * 100)}% de reducción`;
            confianza = 0.88;
            
            recomendaciones = [
                'Investigar causa de caída en demanda',
                'Evaluar estrategia de precios',
                'Considerar promociones para mover stock',
                'Revisar competencia y mercado'
            ];
        }
    }

    // Análisis de compras excesivas
    if (comprasRecientes && comprasRecientes.length > 0) {
        const ultimaCompra = comprasRecientes[0];
        const cantidadComprada = ultimaCompra.cantidad;
        
        if (cantidadComprada > ventaDiaria * 90) { // Más de 3 meses de venta
            causaPrincipal = 'sobrecompra_inicial';
            factoresContribuyentes['compra_excesiva'] = `${cantidadComprada} unidades vs ${Math.round(ventaDiaria * 90)} necesarias (3 meses)`;
            confianza = 0.85;
        }
        
        evidencia['ultima_compra'] = {
            cantidad: cantidadComprada,
            fecha: ultimaCompra.fecha_compra,
            cobertura_comprada: Math.round(cantidadComprada / Math.max(ventaDiaria, 0.1))
        };
    }

    // Recomendaciones específicas por nivel de exceso
    if (diasCobertura > 240) { // Más de 8 meses
        recomendaciones.unshift('CRÍTICO: Liquidación inmediata recomendada');
        recomendaciones.push('Pausar todas las órdenes futuras');
    } else if (diasCobertura > 150) { // Más de 5 meses
        recomendaciones.unshift('Promoción agresiva para mover stock');
        recomendaciones.push('Revisar estrategia de pricing');
    } else {
        recomendaciones.push('Monitorear tendencia, considerar promoción suave');
    }

    recomendaciones.push(
        'Ajustar algoritmo de reabastecimiento',
        'Implementar límites máximos de compra'
    );

    return {
        ...diagnostico,
        causa_principal: causaPrincipal,
        factores_contribuyentes: factoresContribuyentes,
        confianza_diagnostico: confianza,
        evidencia_detectada: evidencia,
        patron_detectado: diasCobertura > 180, // Más de 6 meses es patrón problemático
        recomendaciones_ia: recomendaciones
    };
}

// Función auxiliar para obtener eventos chilenos por mes
function getEventosParaMes(mes) {
    const eventosChile = {
        1: [], // Enero
        2: [], // Febrero  
        3: [{ name: 'Regreso a Clases', categories: ['Electrónicos', 'Deportes y Fitness'] }],
        4: [], // Abril
        5: [
            { name: 'Día de la Madre', categories: ['Belleza y Cuidado Personal', 'Joyas', 'Hogar y Muebles'] },
            { name: 'CyberDay', categories: ['Electrónicos', 'Hogar y Muebles', 'Deportes y Fitness'] }
        ],
        6: [{ name: 'Día del Padre', categories: ['Vehículos', 'Deportes y Fitness', 'Electrónicos'] }],
        7: [{ name: 'Vacaciones Invierno', categories: ['Juegos y Juguetes', 'Electrónicos'] }],
        8: [{ name: 'Día del Niño', categories: ['Juegos y Juguetes', 'Deportes y Fitness'] }],
        9: [
            { name: 'Fiestas Patrias', categories: ['Hogar y Muebles', 'Jardín', 'Vehículos'] },
            { name: 'CyberDay', categories: ['Electrónicos', 'Hogar y Muebles'] }
        ],
        10: [], // Octubre
        11: [
            { name: 'Black Friday', categories: ['Electrónicos', 'Hogar y Muebles', 'Juegos y Juguetes'] },
            { name: 'CyberDay', categories: ['Electrónicos', 'Hogar y Muebles'] }
        ],
        12: [{ name: 'Navidad', categories: ['Juegos y Juguetes', 'Electrónicos', 'Hogar y Muebles'] }]
    };
    
    return eventosChile[mes] || [];
}