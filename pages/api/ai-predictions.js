// pages/api/ai-predictions.js
import { supabase } from '../../lib/supabaseClient';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { promisify } from 'util';

export default async function handler(req, res) {
    const { method } = req;

    switch (method) {
        case 'GET':
            return await handleGetPredictions(req, res);
        case 'POST':
            return await handleCreatePredictions(req, res);
        default:
            res.setHeader('Allow', ['GET', 'POST']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}

async function handleGetPredictions(req, res) {
    try {
        const { sku, tipo } = req.query;

        // Verificar si la tabla existe y manejar el error graciosamente
        let query = supabase
            .from('ai_predictions')
            .select('*')
            .order('fecha_prediccion', { ascending: false });

        if (sku) {
            query = query.eq('sku', sku);
        }

        if (tipo) {
            query = query.eq('evento_objetivo', tipo);
        }

        const { data: predicciones, error } = await query.limit(100);

        if (error) {
            console.error('Error obteniendo predicciones:', error);

            // Si la tabla no existe, devolver datos vacíos en lugar de error 500
            if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
                console.log('Tabla ai_predictions no existe, devolviendo datos vacíos');
                return res.status(200).json({
                    predicciones: [],
                    alertas: [],
                    message: 'Servicio de predicciones IA no está disponible'
                });
            }

            return res.status(500).json({ error: 'Error obteniendo predicciones IA' });
        }

        // Obtener alertas temporales activas
        const { data: alertas, error: alertasError } = await supabase
            .from('temporal_alerts')
            .select('*')
            .eq('activo', true)
            .order('fecha_evento', { ascending: true });

        // Si hay error obteniendo alertas, usar array vacío
        let alertasResult = [];
        if (alertasError) {
            console.error('Error obteniendo alertas temporales:', alertasError);
            if (alertasError.code === 'PGRST205' || alertasError.message?.includes('Could not find the table')) {
                console.log('Tabla temporal_alerts no existe, usando array vacío');
            }
        } else {
            alertasResult = alertas || [];
        }

        return res.status(200).json({
            predicciones: predicciones || [],
            alertas_temporales: alertasResult,
            total: predicciones?.length || 0
        });

    } catch (error) {
        console.error('Error en API ai-predictions GET:', error);
        
        // Si la tabla no existe, devolver datos vacíos en lugar de error
        if (error.message?.includes('relation "ai_predictions" does not exist') || 
            error.code === 'PGRST116' || 
            error.message?.includes('does not exist')) {
            console.log('Tabla ai_predictions no existe, devolviendo datos vacíos');
            return res.status(200).json({
                predicciones: [],
                alertas_temporales: [],
                total: 0
            });
        }
        
        return res.status(500).json({ error: 'Error obteniendo predicciones IA' });
    }
}

async function handleCreatePredictions(req, res) {
    try {
        const { skus, force_refresh = false } = req.body;

        if (!Array.isArray(skus) || skus.length === 0) {
            return res.status(400).json({ 
                error: 'Se requiere array de SKUs para generar predicciones' 
            });
        }

        // Obtener configuración actual
        const { data: configData, error: configError } = await supabase
            .from('configuration')
            .select('data')
            .eq('id', 1)
            .single();

        if (configError) {
            return res.status(500).json({ error: 'No se pudo obtener configuración' });
        }

        const config = configData.data;

        // Obtener datos de productos
        const { data: productos, error: productosError } = await supabase
            .from('products')
            .select('*')
            .in('sku', skus);

        if (productosError) {
            return res.status(500).json({ error: 'Error obteniendo productos' });
        }

        if (!productos || productos.length === 0) {
            return res.status(404).json({ error: 'No se encontraron productos con esos SKUs' });
        }

        // Ejecutar sistema IA Python (con fallback)
        const aiResults = await executeAISystem(productos, config);

        if (!aiResults.success) {
            console.log('Sistema Python falló, usando fallback:', aiResults.error);
            // Usar sistema fallback en caso de error
            const fallbackPredictions = generateFallbackPredictions(productos, config);
            aiResults.success = true;
            aiResults.predictions = fallbackPredictions;
            aiResults.temporal_alerts = [];
        }

        // Guardar predicciones en base de datos
        const prediccionesGuardadas = [];
        const erroresGuardado = [];

        for (const prediction of aiResults.predictions) {
            try {
                // Verificar si ya existe predicción reciente (últimas 24h)
                if (!force_refresh) {
                    const { data: existente } = await supabase
                        .from('ai_predictions')
                        .select('id')
                        .eq('sku', prediction.sku)
                        .eq('temporalidad_target', prediction.temporalidad_target)
                        .gte('fecha_prediccion', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                        .single();

                    if (existente) {
                        prediccionesGuardadas.push({ 
                            sku: prediction.sku, 
                            status: 'exists', 
                            message: 'Predicción reciente existe' 
                        });
                        continue;
                    }
                }

                // Insertar nueva predicción
                const { data: nuevaPrediccion, error: insertError } = await supabase
                    .from('ai_predictions')
                    .insert({
                        sku: prediction.sku,
                        cantidad_predicha: prediction.cantidad_predicha,
                        confianza: prediction.confianza,
                        evento_objetivo: prediction.evento_objetivo,
                        temporalidad_target: prediction.temporalidad_target,
                        factores_aplicados: prediction.factores_aplicados,
                        logica_detallada: prediction.logica_detallada,
                        fecha_prediccion: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (insertError) {
                    erroresGuardado.push({
                        sku: prediction.sku,
                        error: insertError.message
                    });
                } else {
                    // Actualizar producto con predicción IA
                    await supabase
                        .from('products')
                        .update({
                            sugerencia_reposicion_ia: prediction.cantidad_predicha,
                            confianza_prediccion_ia: prediction.confianza,
                            logica_explicacion_ia: prediction.logica_detallada,
                            temporalidad_prediccion: prediction.evento_objetivo,
                            alertas_temporales: prediction.alerta_temporal,
                            ultima_prediccion_ia: new Date().toISOString()
                        })
                        .eq('sku', prediction.sku);

                    prediccionesGuardadas.push({
                        sku: prediction.sku,
                        status: 'created',
                        prediccion_id: nuevaPrediccion.id,
                        cantidad: prediction.cantidad_predicha,
                        confianza: prediction.confianza
                    });
                }

            } catch (error) {
                erroresGuardado.push({
                    sku: prediction.sku,
                    error: error.message
                });
            }
        }

        return res.status(200).json({
            message: 'Predicciones IA generadas',
            resultados: {
                exitosas: prediccionesGuardadas.length,
                errores: erroresGuardado.length,
                total_procesadas: aiResults.predictions.length
            },
            predicciones: prediccionesGuardadas,
            errores: erroresGuardado,
            alertas_temporales: aiResults.temporal_alerts || []
        });

    } catch (error) {
        console.error('Error en API ai-predictions POST:', error);
        return res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message
        });
    }
}

async function executeAISystem(productos, config) {
    return new Promise((resolve) => {
        try {
            const scriptPath = path.join(process.cwd(), 'scripts', 'temporal_ai_system.py');
            
            // Preparar datos para el script Python
            const inputData = {
                productos: productos.map(p => ({
                    sku: p.sku,
                    categoria: p.categoria || 'Unknown',
                    venta_diaria: parseFloat(p.breakdown?.ventaDiaria || p.venta_diaria || 1.0),
                    en_transito: parseInt(p.breakdown?.stockEnTransitoQueLlega || 0),
                    stock_actual: parseInt(p.stock_actual || 0)
                })),
                config: {
                    tiempoPromedioFabricacion: config.tiempoPromedioFabricacion || 30,
                    tiempoEntrega: config.tiempoEntrega || 60,
                    bufferSeguridad: config.bufferSeguridad || 10
                }
            };

            // Ejecutar script Python (intentar python3 primero, luego python)
            const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
            const pythonProcess = spawn(pythonCommand, [scriptPath], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let outputData = '';
            let errorData = '';
            
            // Manejo de errores del proceso
            pythonProcess.on('error', (error) => {
                console.error('Error en proceso Python:', error);
                resolve({
                    success: false,
                    error: `Error proceso Python: ${error.message}`
                });
            });

            // Enviar datos al script
            pythonProcess.stdin.write(JSON.stringify(inputData));
            pythonProcess.stdin.end();

            // Capturar output
            pythonProcess.stdout.on('data', (data) => {
                outputData += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorData += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    console.error('Error ejecutando script IA:', errorData);
                    const errorMsg = errorData || 'Sin detalles del error';
                    resolve({
                        success: false,
                        error: `Python falló (código ${code}): ${errorMsg}`
                    });
                    return;
                }

                try {
                    const result = JSON.parse(outputData);
                    resolve({
                        success: true,
                        predictions: result.predictions || [],
                        temporal_alerts: result.temporal_alerts || []
                    });
                } catch (parseError) {
                    console.error('Error parsing AI output:', parseError);
                    resolve({
                        success: false,
                        error: `Error parsing output: ${parseError.message}`
                    });
                }
            });

            // Timeout después de 30 segundos
            setTimeout(() => {
                pythonProcess.kill();
                resolve({
                    success: false,
                    error: 'Timeout ejecutando sistema IA'
                });
            }, 30000);

        } catch (error) {
            console.error('Error iniciando proceso Python:', error);
            resolve({
                success: false,
                error: `Error iniciando Python: ${error.message}`
            });
        }
    });
}

// Función auxiliar para generar predicciones fallback (sin Python)
function generateFallbackPredictions(productos, config) {
    const predictions = [];
    
    const eventos_proximos = [
        { nombre: 'CyberDay Mayo 2025', mes: 5, factor: 3.5 },
        { nombre: 'Día del Padre 2025', mes: 6, factor: 1.8 },
        { nombre: 'Fiestas Patrias 2025', mes: 9, factor: 2.8 },
        { nombre: 'Black Friday 2025', mes: 11, factor: 4.2 },
        { nombre: 'Navidad 2025', mes: 12, factor: 3.8 }
    ];
    
    // Elegir evento más próximo basado en mes actual
    const mesActual = new Date().getMonth() + 1;
    const evento_proximo = eventos_proximos.find(e => e.mes >= mesActual) || eventos_proximos[0];
    
    productos.forEach(producto => {
        const venta_diaria = parseFloat(producto.breakdown?.ventaDiaria || 1.0);
        const dias_mes = 30;
        const demanda_base = venta_diaria * dias_mes;
        const demanda_evento = demanda_base * evento_proximo.factor;
        const buffer = demanda_evento * 1.1; // 10% buffer
        const cantidad_sugerida = Math.max(0, Math.round(buffer));
        
        const prediction = {
            sku: producto.sku,
            cantidad_predicha: cantidad_sugerida,
            confianza: 0.75,
            evento_objetivo: evento_proximo.nombre,
            temporalidad_target: `2025-${evento_proximo.mes.toString().padStart(2, '0')}-15`,
            factores_aplicados: {
                venta_diaria_base: venta_diaria,
                dias_mes: dias_mes,
                factor_evento: evento_proximo.factor,
                buffer_aplicado: '10%'
            },
            logica_detallada: {
                metodologia: 'Fallback Simple',
                formula: `(${venta_diaria} × ${dias_mes}) × ${evento_proximo.factor} × 1.1`,
                breakdown: {
                    demanda_base: demanda_base,
                    demanda_evento: demanda_evento,
                    cantidad_final: cantidad_sugerida
                }
            },
            alerta_temporal: {
                fecha_limite_orden: `2025-0${evento_proximo.mes - 3}-15`,
                dias_restantes: 60,
                status_alerta: 'planificacion'
            }
        };
        
        predictions.push(prediction);
    });
    
    return predictions;
}