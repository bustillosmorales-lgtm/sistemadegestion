// pages/api/ai-feedback.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
    const { method } = req;

    switch (method) {
        case 'GET':
            return await handleGetFeedback(req, res);
        case 'POST':
            return await handleCreateFeedback(req, res);
        case 'PUT':
            return await handleUpdateFeedback(req, res);
        default:
            res.setHeader('Allow', ['GET', 'POST', 'PUT']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}

async function handleGetFeedback(req, res) {
    try {
        const { sku, tipo_feedback, usuario } = req.query;

        let query = supabase
            .from('ai_human_feedback')
            .select('*')
            .order('fecha_feedback', { ascending: false });

        if (sku) {
            query = query.eq('sku', sku);
        }

        if (tipo_feedback) {
            query = query.eq('tipo_feedback', tipo_feedback);
        }

        if (usuario) {
            query = query.eq('usuario', usuario);
        }

        const { data: feedback, error } = await query.limit(100);

        if (error) {
            console.error('Error obteniendo feedback:', error);
            return res.status(500).json({ error: 'Error obteniendo feedback IA' });
        }

        // Obtener estadísticas de feedback
        const { data: stats, error: statsError } = await supabase
            .from('ai_human_feedback')
            .select('tipo_feedback, calificacion')
            .not('calificacion', 'is', null);

        let estadisticas = {};
        if (!statsError && stats) {
            estadisticas = stats.reduce((acc, item) => {
                if (!acc[item.tipo_feedback]) {
                    acc[item.tipo_feedback] = {
                        total: 0,
                        promedio: 0,
                        suma: 0,
                        count: 0
                    };
                }
                acc[item.tipo_feedback].total++;
                if (item.calificacion !== null) {
                    acc[item.tipo_feedback].suma += item.calificacion;
                    acc[item.tipo_feedback].count++;
                    acc[item.tipo_feedback].promedio = acc[item.tipo_feedback].suma / acc[item.tipo_feedback].count;
                }
                return acc;
            }, {});
        }

        return res.status(200).json({
            feedback: feedback || [],
            estadisticas,
            total: feedback?.length || 0
        });

    } catch (error) {
        console.error('Error en API ai-feedback GET:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}

async function handleCreateFeedback(req, res) {
    try {
        const { 
            sku, 
            tipo_feedback, 
            usuario, 
            calificacion, 
            comentarios, 
            datos_ia_original,
            accion_tomada,
            mejora_sugerida
        } = req.body;

        if (!sku || !tipo_feedback || !usuario) {
            return res.status(400).json({ 
                error: 'Faltan campos requeridos: sku, tipo_feedback, usuario' 
            });
        }

        if (calificacion && (calificacion < 1 || calificacion > 5)) {
            return res.status(400).json({ 
                error: 'La calificación debe estar entre 1 y 5' 
            });
        }

        // Insertar feedback
        const { data: newFeedback, error: insertError } = await supabase
            .from('ai_human_feedback')
            .insert({
                sku,
                tipo_feedback,
                usuario,
                calificacion,
                comentarios,
                datos_ia_original,
                accion_tomada,
                mejora_sugerida,
                fecha_feedback: new Date().toISOString()
            })
            .select()
            .single();

        if (insertError) {
            console.error('Error insertando feedback:', insertError);
            return res.status(500).json({ error: 'Error guardando feedback' });
        }

        // Actualizar métricas de aprendizaje en tiempo real
        await updateLearningMetrics(tipo_feedback, calificacion, sku);

        return res.status(201).json({
            message: 'Feedback registrado exitosamente',
            feedback: newFeedback
        });

    } catch (error) {
        console.error('Error en API ai-feedback POST:', error);
        return res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message
        });
    }
}

async function handleUpdateFeedback(req, res) {
    try {
        const { id, calificacion, comentarios, accion_tomada } = req.body;

        if (!id) {
            return res.status(400).json({ error: 'ID de feedback requerido' });
        }

        const updateData = {
            updated_at: new Date().toISOString()
        };

        if (calificacion !== undefined) {
            if (calificacion < 1 || calificacion > 5) {
                return res.status(400).json({ 
                    error: 'La calificación debe estar entre 1 y 5' 
                });
            }
            updateData.calificacion = calificacion;
        }

        if (comentarios !== undefined) {
            updateData.comentarios = comentarios;
        }

        if (accion_tomada !== undefined) {
            updateData.accion_tomada = accion_tomada;
        }

        const { data: updatedFeedback, error: updateError } = await supabase
            .from('ai_human_feedback')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('Error actualizando feedback:', updateError);
            return res.status(500).json({ error: 'Error actualizando feedback' });
        }

        return res.status(200).json({
            message: 'Feedback actualizado exitosamente',
            feedback: updatedFeedback
        });

    } catch (error) {
        console.error('Error en API ai-feedback PUT:', error);
        return res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message
        });
    }
}

async function updateLearningMetrics(tipoFeedback, calificacion, sku) {
    try {
        // Solo procesar si hay calificación
        if (!calificacion) return;

        // Obtener producto para análisis
        const { data: producto, error: prodError } = await supabase
            .from('products')
            .select('categoria, venta_diaria')
            .eq('sku', sku)
            .single();

        if (prodError) {
            console.warn('No se pudo obtener datos del producto para métricas de aprendizaje:', prodError);
            return;
        }

        // Actualizar patrones estacionales si el feedback es sobre predicciones
        if (tipoFeedback === 'prediccion' && producto.categoria) {
            const ajusteFactor = calificacion >= 4 ? 1.05 : (calificacion <= 2 ? 0.95 : 1.0);
            
            await supabase
                .from('seasonal_patterns_chile')
                .update({ 
                    factor: supabase.raw(`factor * ${ajusteFactor}`),
                    updated_at: new Date().toISOString()
                })
                .eq('categoria', producto.categoria);
        }

        // Log de mejora continua
        console.log(`📊 Métrica de aprendizaje actualizada: ${tipoFeedback} - Calificación: ${calificacion} - SKU: ${sku}`);

    } catch (error) {
        console.error('Error actualizando métricas de aprendizaje:', error);
    }
}