// pages/api/ai-chat.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const { mensaje, sku, session_id, usuario_email } = req.body;

        if (!mensaje || !session_id) {
            return res.status(400).json({ 
                error: 'Mensaje y session_id son requeridos' 
            });
        }

        // Obtener datos del producto si se proporciona SKU
        let contextualData = {};
        if (sku) {
            const { data: producto, error: productoError } = await supabase
                .from('products')
                .select(`
                    *,
                    ai_predictions!ai_predictions_sku_fkey(*)
                `)
                .eq('sku', sku)
                .single();

            if (!productoError && producto) {
                contextualData = {
                    producto: producto,
                    predicciones: producto.ai_predictions || []
                };
            }
        }

        // Obtener contexto de conversación previa
        const { data: conversacionPrevia } = await supabase
            .from('ai_chat_conversations')
            .select('mensaje_usuario, respuesta_ia, contexto_conversacion')
            .eq('session_id', session_id)
            .order('created_at', { ascending: false })
            .limit(5);

        // Procesar mensaje y generar respuesta
        const chatResponse = await processAIChat(
            mensaje, 
            contextualData, 
            conversacionPrevia || []
        );

        // Guardar conversación
        const { data: conversacionGuardada, error: guardarError } = await supabase
            .from('ai_chat_conversations')
            .insert({
                session_id,
                sku: sku || null,
                usuario_email: usuario_email || null,
                mensaje_usuario: mensaje,
                respuesta_ia: chatResponse.respuesta,
                contexto_conversacion: contextualData,
                intent_detectado: chatResponse.intent,
                confianza_respuesta: chatResponse.confianza
            })
            .select()
            .single();

        if (guardarError) {
            console.warn('Error guardando conversación:', guardarError);
        }

        return res.status(200).json({
            respuesta: chatResponse.respuesta,
            intent: chatResponse.intent,
            confianza: chatResponse.confianza,
            sugerencias: chatResponse.sugerencias || [],
            datos_utilizados: chatResponse.datos_utilizados || {}
        });

    } catch (error) {
        console.error('Error en AI Chat:', error);
        return res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
}

async function processAIChat(mensaje, contextualData, historialConversacion) {
    const mensajeLower = mensaje.toLowerCase().trim();
    
    // Detectar intent
    const intent = detectIntent(mensajeLower);
    
    let respuesta = '';
    let confianza = 0.7;
    let sugerencias = [];
    let datosUtilizados = {};

    try {
        switch (intent) {
            case 'explain_prediction':
                const result = await explainPrediction(mensajeLower, contextualData);
                respuesta = result.respuesta;
                confianza = result.confianza;
                datosUtilizados = result.datos;
                break;

            case 'why_excess_stock':
                const excessResult = await explainExcessStock(contextualData);
                respuesta = excessResult.respuesta;
                confianza = excessResult.confianza;
                datosUtilizados = excessResult.datos;
                break;

            case 'why_stockout':
                const stockoutResult = await explainStockout(contextualData);
                respuesta = stockoutResult.respuesta;
                confianza = stockoutResult.confianza;
                datosUtilizados = stockoutResult.datos;
                break;

            case 'temporal_analysis':
                const temporalResult = await explainTiming(contextualData);
                respuesta = temporalResult.respuesta;
                confianza = temporalResult.confianza;
                datosUtilizados = temporalResult.datos;
                break;

            case 'simulate_scenario':
                const simulationResult = await simulateScenario(mensajeLower, contextualData);
                respuesta = simulationResult.respuesta;
                confianza = simulationResult.confianza;
                datosUtilizados = simulationResult.datos;
                break;

            case 'compare_options':
                const compareResult = await compareOptions(contextualData);
                respuesta = compareResult.respuesta;
                confianza = compareResult.confianza;
                datosUtilizados = compareResult.datos;
                break;

            case 'greeting':
                respuesta = generateGreeting(contextualData);
                confianza = 1.0;
                break;

            case 'help':
                respuesta = generateHelpResponse();
                sugerencias = getHelpSuggestions();
                confianza = 1.0;
                break;

            default:
                respuesta = generateFallbackResponse(mensajeLower, contextualData);
                sugerencias = getDefaultSuggestions(contextualData);
                confianza = 0.5;
                break;
        }

        // Agregar sugerencias contextual es si no las hay
        if (sugerencias.length === 0) {
            sugerencias = generateContextualSuggestions(intent, contextualData);
        }

    } catch (error) {
        console.error('Error procesando chat:', error);
        respuesta = "Disculpa, hubo un error procesando tu consulta. ¿Podrías reformular tu pregunta?";
        confianza = 0.1;
    }

    return {
        respuesta,
        intent,
        confianza,
        sugerencias,
        datos_utilizados: datosUtilizados
    };
}

function detectIntent(mensaje) {
    const intents = {
        explain_prediction: [
            'por qué recomiendas', 'explica la sugerencia', 'de donde sale',
            'por qué esta cantidad', 'cómo calculaste', 'explica el número'
        ],
        why_excess_stock: [
            'por qué tengo mucho stock', 'exceso de stock', 'demasiado inventario',
            'por qué tantos días', 'stock excesivo', 'sobrante'
        ],
        why_stockout: [
            'por qué me quedé sin stock', 'por qué quiebre', 'stock agotado',
            'por qué cero stock', 'se acabó', 'sin inventario'
        ],
        temporal_analysis: [
            'cuándo ordenar', 'cuándo comprar', 'timing', 'fecha límite',
            'para qué evento', 'qué fecha'
        ],
        simulate_scenario: [
            'qué pasa si', 'simula', 'y si bajo precio', 'y si subo',
            'simulación', 'escenario'
        ],
        compare_options: [
            'diferencia entre', 'cuál es mejor', 'sistema vs ia',
            'qué opción', 'comparar'
        ],
        greeting: [
            'hola', 'buenas', 'hey', 'saludos', 'qué tal'
        ],
        help: [
            'help', 'ayuda', 'qué puedes hacer', 'opciones',
            'comandos', 'funciones'
        ]
    };

    for (const [intent, keywords] of Object.entries(intents)) {
        if (keywords.some(keyword => mensaje.includes(keyword))) {
            return intent;
        }
    }

    return 'unknown';
}

async function explainPrediction(mensaje, contextualData) {
    if (!contextualData.producto) {
        return {
            respuesta: "Para explicar una predicción necesito que selecciones un producto específico.",
            confianza: 0.3,
            datos: {}
        };
    }

    const producto = contextualData.producto;
    const sugerenciaIA = producto.sugerencia_reposicion_ia;
    const logicaIA = producto.logica_explicacion_ia;
    
    if (!sugerenciaIA || !logicaIA) {
        return {
            respuesta: `Este producto (${producto.sku}) aún no tiene predicciones IA generadas. ¿Quieres que genere una predicción ahora?`,
            confianza: 0.8,
            datos: { necesita_prediccion: true }
        };
    }

    const factores = logicaIA.factores_aplicados || {};
    const breakdown = logicaIA.breakdown_calculo || {};
    
    let explicacion = `🔍 **ANÁLISIS DETALLADO - ${producto.sku}**\n\n`;
    explicacion += `🎯 **Sugerencia IA: ${sugerenciaIA} unidades**\n`;
    explicacion += `📊 **Confianza: ${Math.round((producto.confianza_prediccion_ia || 0.75) * 100)}%**\n\n`;
    
    explicacion += `📋 **DESGLOSE DEL CÁLCULO:**\n`;
    
    if (breakdown.paso_1_base) {
        explicacion += `1️⃣ ${breakdown.paso_1_base}\n`;
    }
    if (breakdown.paso_2_estacional) {
        explicacion += `2️⃣ ${breakdown.paso_2_estacional}\n`;
    }
    if (breakdown.paso_3_mercadolibre) {
        explicacion += `3️⃣ ${breakdown.paso_3_mercadolibre}\n`;
    }
    if (breakdown.paso_4_buffer) {
        explicacion += `4️⃣ ${breakdown.paso_4_buffer}\n`;
    }
    if (breakdown.paso_5_final) {
        explicacion += `5️⃣ ${breakdown.paso_5_final}\n`;
    }
    
    explicacion += `\n🎯 **EVENTO OBJETIVO:** ${producto.temporalidad_prediccion || 'No especificado'}\n`;
    
    if (producto.alertas_temporales) {
        const alerta = producto.alertas_temporales;
        explicacion += `\n⏰ **TIMING CRÍTICO:**\n`;
        explicacion += `📅 Fecha límite para ordenar: ${new Date(alerta.fecha_limite_orden).toLocaleDateString('es-CL')}\n`;
        explicacion += `⚠️ Días restantes: **${alerta.dias_restantes}** (${alerta.status_alerta})\n`;
    }

    return {
        respuesta: explicacion,
        confianza: 0.92,
        datos: {
            sugerencia: sugerenciaIA,
            factores: factores,
            breakdown: breakdown
        }
    };
}

async function explainExcessStock(contextualData) {
    if (!contextualData.producto) {
        return {
            respuesta: "Para analizar exceso de stock necesito que selecciones un producto específico.",
            confianza: 0.3,
            datos: {}
        };
    }

    const producto = contextualData.producto;
    const stockActual = producto.stock_actual || 0;
    const ventaDiaria = parseFloat(producto.breakdown?.ventaDiaria || 0);
    const diasCobertura = ventaDiaria > 0 ? stockActual / ventaDiaria : 0;

    if (diasCobertura < 90) {
        return {
            respuesta: `El producto ${producto.sku} no parece tener exceso de stock. Tiene ${Math.round(diasCobertura)} días de cobertura, lo que está en rango normal (30-90 días).`,
            confianza: 0.8,
            datos: { dias_cobertura: diasCobertura }
        };
    }

    // Obtener diagnóstico si existe
    const { data: diagnostico } = await supabase
        .from('stock_events_analysis')
        .select('*')
        .eq('sku', producto.sku)
        .eq('evento_tipo', 'exceso_stock')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    let respuesta = `🚨 **DIAGNÓSTICO EXCESO DE STOCK - ${producto.sku}**\n\n`;
    respuesta += `📊 **Stock actual:** ${stockActual} unidades\n`;
    respuesta += `📈 **Venta diaria:** ${ventaDiaria.toFixed(1)} unidades/día\n`;
    respuesta += `⏰ **Cobertura:** ${Math.round(diasCobertura)} días (${Math.round(diasCobertura/30)} meses)\n\n`;

    if (diagnostico) {
        respuesta += `🔍 **CAUSA PRINCIPAL:** ${diagnostico.causa_principal.replace(/_/g, ' ')}\n\n`;
        
        if (diagnostico.evidencia_detectada) {
            respuesta += `📋 **EVIDENCIA DETECTADA:**\n`;
            const evidencia = diagnostico.evidencia_detectada;
            
            if (evidencia.tendencia_ventas) {
                const tendencia = evidencia.tendencia_ventas;
                respuesta += `• Cambio en ventas: ${tendencia.cambio_porcentual}%\n`;
                respuesta += `• Promedio reciente: ${tendencia.promedio_reciente} vs anterior: ${tendencia.promedio_anterior}\n`;
            }
            
            if (evidencia.ultima_compra) {
                const compra = evidencia.ultima_compra;
                respuesta += `• Última compra: ${compra.cantidad} unidades\n`;
                respuesta += `• Cobertura comprada: ${compra.cobertura_comprada} días\n`;
            }
        }

        respuesta += `\n💡 **RECOMENDACIONES IA:**\n`;
        diagnostico.recomendaciones_ia?.forEach((rec, index) => {
            respuesta += `${index + 1}. ${rec}\n`;
        });
        
        respuesta += `\n🎯 **Confianza diagnóstico:** ${Math.round(diagnostico.confianza_diagnostico * 100)}%`;
    } else {
        respuesta += `🤔 **Análisis automático:**\n`;
        respuesta += `• Tienes stock para ${Math.round(diasCobertura/30)} meses\n`;
        respuesta += `• Considera promoción para acelerar ventas\n`;
        respuesta += `• Pausa órdenes futuras hasta normalizar\n`;
    }

    return {
        respuesta: respuesta,
        confianza: diagnostico ? 0.88 : 0.65,
        datos: {
            dias_cobertura: diasCobertura,
            diagnostico: diagnostico
        }
    };
}

async function explainStockout(contextualData) {
    if (!contextualData.producto) {
        return {
            respuesta: "Para analizar un quiebre de stock necesito que selecciones un producto específico.",
            confianza: 0.3,
            datos: {}
        };
    }

    const producto = contextualData.producto;
    
    if (producto.stock_actual > 0) {
        return {
            respuesta: `El producto ${producto.sku} no está agotado. Stock actual: ${producto.stock_actual} unidades.`,
            confianza: 0.8,
            datos: { stock_actual: producto.stock_actual }
        };
    }

    // Obtener diagnóstico de quiebre
    const { data: diagnostico } = await supabase
        .from('stock_events_analysis')
        .select('*')
        .eq('sku', producto.sku)
        .eq('evento_tipo', 'quiebre_stock')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    let respuesta = `❌ **DIAGNÓSTICO QUIEBRE DE STOCK - ${producto.sku}**\n\n`;
    respuesta += `📦 **Stock actual:** 0 unidades ⚠️\n\n`;

    if (diagnostico) {
        respuesta += `🔍 **CAUSA PRINCIPAL:** ${diagnostico.causa_principal.replace(/_/g, ' ')}\n\n`;
        
        if (diagnostico.evidencia_detectada) {
            respuesta += `📊 **EVIDENCIA:**\n`;
            const evidencia = diagnostico.evidencia_detectada;
            
            if (evidencia.pico_ratio) {
                respuesta += `• Pico de demanda: ${evidencia.pico_ratio}x sobre promedio\n`;
                respuesta += `• Venta máxima: ${evidencia.venta_maxima_30d} vs promedio: ${evidencia.venta_promedio_30d}\n`;
            }
            
            if (evidencia.evento_detectado) {
                respuesta += `• Evento detectado: ${evidencia.evento_detectado}\n`;
            }
        }

        respuesta += `\n💡 **RECOMENDACIONES PARA EVITAR:**\n`;
        diagnostico.recomendaciones_ia?.forEach((rec, index) => {
            respuesta += `${index + 1}. ${rec}\n`;
        });
        
        respuesta += `\n🎯 **Confianza diagnóstico:** ${Math.round(diagnostico.confianza_diagnostico * 100)}%`;
    } else {
        respuesta += `🤔 Sin diagnóstico específico disponible.\n`;
        respuesta += `💡 **Acciones generales:**\n`;
        respuesta += `1. Revisar demanda reciente vs stock previo\n`;
        respuesta += `2. Implementar alertas de stock mínimo\n`;
        respuesta += `3. Evaluar tiempo de reabastecimiento\n`;
    }

    return {
        respuesta: respuesta,
        confianza: diagnostico ? 0.85 : 0.6,
        datos: {
            diagnostico: diagnostico
        }
    };
}

async function explainTiming(contextualData) {
    if (!contextualData.producto) {
        return {
            respuesta: "Para explicar timing necesito que selecciones un producto específico.",
            confianza: 0.3,
            datos: {}
        };
    }

    const producto = contextualData.producto;
    const alertas = producto.alertas_temporales;
    
    let respuesta = `⏰ **ANÁLISIS TEMPORAL - ${producto.sku}**\n\n`;
    
    if (alertas) {
        const fechaLimite = new Date(alertas.fecha_limite_orden);
        const diasRestantes = alertas.dias_restantes;
        
        respuesta += `🎯 **Evento objetivo:** ${producto.temporalidad_prediccion || 'No especificado'}\n`;
        respuesta += `📅 **Fecha límite orden:** ${fechaLimite.toLocaleDateString('es-CL')}\n`;
        respuesta += `⏳ **Días restantes:** ${diasRestantes} días\n`;
        respuesta += `🚨 **Status:** ${getStatusEmoji(alertas.status_alerta)} ${alertas.status_alerta}\n\n`;
        
        if (diasRestantes > 0) {
            respuesta += `💡 **¿Por qué esta fecha?**\n`;
            respuesta += `El cálculo considera:\n`;
            respuesta += `• Tiempo fabricación en China\n`;
            respuesta += `• Tiempo tránsito marítimo\n`;
            respuesta += `• Buffer de seguridad\n\n`;
            
            if (diasRestantes <= 14) {
                respuesta += `⚠️ **URGENTE:** Tienes poco tiempo para ordenar.\n`;
                respuesta += `Si no ordenas pronto, perderás el evento objetivo.\n`;
            } else if (diasRestantes <= 30) {
                respuesta += `📋 **PLANIFICA:** Tiempo ideal para preparar la orden.\n`;
            } else {
                respuesta += `✅ **TRANQUILO:** Tienes tiempo suficiente para planificar.\n`;
            }
        } else {
            respuesta += `❌ **TIEMPO VENCIDO:** Ya pasó la fecha límite.\n`;
            respuesta += `Para el próximo evento similar, planifica con ${Math.abs(diasRestantes)} días más de anticipación.\n`;
        }
        
        respuesta += `\n💬 ${alertas.mensaje || ''}`;
        
    } else {
        respuesta += `Este producto no tiene alertas temporales configuradas.\n`;
        respuesta += `Esto podría significar:\n`;
        respuesta += `• No se ha generado predicción IA\n`;
        respuesta += `• Producto en estado normal (sin eventos próximos)\n`;
        respuesta += `• No se detectaron eventos estacionales relevantes\n`;
    }

    return {
        respuesta: respuesta,
        confianza: alertas ? 0.9 : 0.6,
        datos: {
            alertas: alertas
        }
    };
}

async function simulateScenario(mensaje, contextualData) {
    // Detectar tipo de simulación del mensaje
    let tipoSimulacion = 'general';
    let parametro = null;
    
    if (mensaje.includes('precio')) {
        tipoSimulacion = 'precio';
        // Extraer número del mensaje
        const match = mensaje.match(/(\d+[,.]?\d*)/);
        if (match) {
            parametro = parseFloat(match[1].replace(',', ''));
        }
    }
    
    if (!contextualData.producto) {
        return {
            respuesta: "Para simular escenarios necesito que selecciones un producto específico.",
            confianza: 0.3,
            datos: {}
        };
    }

    const producto = contextualData.producto;
    
    let respuesta = `🎲 **SIMULACIÓN - ${producto.sku}**\n\n`;
    
    if (tipoSimulacion === 'precio' && parametro) {
        const precioActual = producto.costo_fob_rmb || 0;
        const ventaDiaria = parseFloat(producto.breakdown?.ventaDiaria || 1);
        const stockActual = producto.stock_actual || 0;
        
        respuesta += `💰 **Simulación cambio precio:**\n`;
        respuesta += `• Precio actual: ${precioActual} RMB\n`;
        respuesta += `• Precio simulado: ${parametro} RMB\n`;
        respuesta += `• Cambio: ${((parametro - precioActual) / precioActual * 100).toFixed(1)}%\n\n`;
        
        // Estimación simple de elasticidad
        const cambioPrecio = (parametro - precioActual) / precioActual;
        const elasticidad = -1.2; // Asumimos elasticidad típica
        const cambioDemandasEstimado = cambioPrecio * elasticidad;
        const nuevaVentaDiaria = ventaDiaria * (1 + cambioDemandasEstimado);
        const diasParaVenderStock = nuevaVentaDiaria > 0 ? stockActual / nuevaVentaDiaria : 0;
        
        respuesta += `📊 **Impacto estimado:**\n`;
        respuesta += `• Nueva venta diaria: ${nuevaVentaDiaria.toFixed(1)} unidades/día (${(cambioDemandasEstimado * 100).toFixed(1)}%)\n`;
        respuesta += `• Días para vender stock actual: ${Math.round(diasParaVenderStock)} días\n`;
        
        if (cambioPrecio < 0) {
            respuesta += `\n✅ **Precio más bajo:** Debería aumentar ventas\n`;
        } else {
            respuesta += `\n⚠️ **Precio más alto:** Podría reducir ventas\n`;
        }
        
    } else {
        respuesta += `Para simulaciones más específicas, menciona:\n`;
        respuesta += `• "¿Qué pasa si bajo precio a X?"\n`;
        respuesta += `• "¿Y si subo precio en X%?"\n`;
        respuesta += `• "Simula aumento demanda 50%"\n`;
    }

    return {
        respuesta: respuesta,
        confianza: tipoSimulacion === 'precio' && parametro ? 0.75 : 0.5,
        datos: {
            tipo_simulacion: tipoSimulacion,
            parametro: parametro
        }
    };
}

async function compareOptions(contextualData) {
    if (!contextualData.producto) {
        return {
            respuesta: "Para comparar opciones necesito que selecciones un producto específico.",
            confianza: 0.3,
            datos: {}
        };
    }

    const producto = contextualData.producto;
    const cantidadSistema = producto.cantidadSugerida || 0;
    const sugerenciaIA = producto.sugerencia_reposicion_ia || 0;
    
    let respuesta = `⚖️ **COMPARACIÓN SISTEMA vs IA - ${producto.sku}**\n\n`;
    
    respuesta += `📊 **CANTIDAD SUGERIDA:**\n`;
    respuesta += `• Sistema actual: **${cantidadSistema} unidades**\n`;
    respuesta += `• Sugerencia IA: **${sugerenciaIA} unidades**\n`;
    respuesta += `• Diferencia: **${Math.abs(sugerenciaIA - cantidadSistema)} unidades** (${sugerenciaIA > cantidadSistema ? '+' : ''}${((sugerenciaIA - cantidadSistema) / Math.max(cantidadSistema, 1) * 100).toFixed(1)}%)\n\n`;
    
    respuesta += `🔍 **METODOLOGÍA:**\n`;
    respuesta += `**Sistema Actual:**\n`;
    respuesta += `• Basado en venta diaria + stock mínimo\n`;
    respuesta += `• No considera eventos estacionales\n`;
    respuesta += `• Cálculo estático\n\n`;
    
    respuesta += `**IA Temporal:**\n`;
    respuesta += `• Considera eventos chilenos (CyberDay, Navidad, etc.)\n`;
    respuesta += `• Anticipa 3-4 meses según lead time\n`;
    respuesta += `• Factores MercadoLibre integrados\n`;
    respuesta += `• Confianza: ${Math.round((producto.confianza_prediccion_ia || 0.75) * 100)}%\n\n`;
    
    respuesta += `💡 **RECOMENDACIÓN:**\n`;
    
    if (Math.abs(sugerenciaIA - cantidadSistema) / Math.max(cantidadSistema, 1) < 0.2) {
        respuesta += `✅ **Ambos sistemas coinciden** (diferencia <20%)\n`;
        respuesta += `Puedes usar cualquiera de los dos valores con confianza.\n`;
    } else if (sugerenciaIA > cantidadSistema * 1.5) {
        respuesta += `🎯 **IA sugiere mucho más** - Posible evento estacional\n`;
        respuesta += `Evento detectado: ${producto.temporalidad_prediccion || 'No especificado'}\n`;
        respuesta += `Considera usar sugerencia IA si el evento es relevante.\n`;
    } else if (sugerenciaIA < cantidadSistema * 0.7) {
        respuesta += `📉 **IA sugiere menos** - Posible sobrestock detectado\n`;
        respuesta += `IA detectó que demanda real es menor de lo esperado.\n`;
    } else {
        respuesta += `📊 **Diferencia moderada** - Evalúa contexto específico\n`;
        respuesta += `Sistema actual para pedidos regulares, IA para eventos especiales.\n`;
    }

    return {
        respuesta: respuesta,
        confianza: 0.85,
        datos: {
            cantidad_sistema: cantidadSistema,
            sugerencia_ia: sugerenciaIA,
            diferencia_porcentual: ((sugerenciaIA - cantidadSistema) / Math.max(cantidadSistema, 1) * 100)
        }
    };
}

function generateGreeting(contextualData) {
    const producto = contextualData.producto;
    
    if (producto) {
        return `¡Hola! 👋 Estoy aquí para ayudarte a entender todo sobre **${producto.sku}**.\n\n` +
               `Puedes preguntarme:\n` +
               `• ¿Por qué esta sugerencia de cantidad?\n` +
               `• ¿Cuándo debo ordenar?\n` +
               `• ¿Qué eventos afectan este producto?\n` +
               `• Simular escenarios de precio\n\n` +
               `¿En qué te puedo ayudar? 🤖`;
    } else {
        return `¡Hola! 👋 Soy tu asistente IA de inventario.\n\n` +
               `Selecciona un producto específico para obtener análisis detallados, o pregúntame sobre:\n` +
               `• Predicciones temporales\n` +
               `• Diagnósticos de stock\n` +
               `• Eventos estacionales\n` +
               `• Alertas de reabastecimiento\n\n` +
               `¿Cómo puedo ayudarte? 🤖`;
    }
}

function generateHelpResponse() {
    return `🤖 **COMANDOS DISPONIBLES:**\n\n` +
           `📊 **Análisis de Producto:**\n` +
           `• "¿Por qué recomiendas X unidades?"\n` +
           `• "Explica la sugerencia IA"\n` +
           `• "¿De dónde sale ese número?"\n\n` +
           
           `🚨 **Diagnósticos de Stock:**\n` +
           `• "¿Por qué tengo exceso de stock?"\n` +
           `• "¿Por qué me quedé sin stock?"\n` +
           `• "Analiza el problema de inventario"\n\n` +
           
           `⏰ **Análisis Temporal:**\n` +
           `• "¿Cuándo debo ordenar?"\n` +
           `• "¿Para qué evento es esta predicción?"\n` +
           `• "¿Cuál es la fecha límite?"\n\n` +
           
           `🎲 **Simulaciones:**\n` +
           `• "¿Qué pasa si bajo precio a X?"\n` +
           `• "Simula aumento de demanda"\n` +
           `• "¿Y si cambio el precio?"\n\n` +
           
           `⚖️ **Comparaciones:**\n` +
           `• "Sistema vs IA"\n` +
           `• "¿Cuál opción es mejor?"\n` +
           `• "Diferencias entre sugerencias"\n\n` +
           
           `💡 **Tip:** Sé específico en tus preguntas para obtener mejores respuestas.`;
}

function generateFallbackResponse(mensaje, contextualData) {
    const suggestions = [
        "¿Podrías ser más específico?",
        "Intenta preguntar sobre predicciones, stock, o timing.",
        "Escribe 'help' para ver todos los comandos disponibles."
    ];
    
    return `🤔 No estoy seguro de cómo responder a eso.\n\n${suggestions.join('\n')}\n\n¿En qué más te puedo ayudar?`;
}

function generateContextualSuggestions(intent, contextualData) {
    const producto = contextualData.producto;
    
    if (!producto) {
        return [
            "¿Qué eventos afectan mi inventario?",
            "¿Cómo funciona la predicción temporal?",
            "¿Qué es el diagnóstico automático?"
        ];
    }
    
    const baseSuggestions = [
        `¿Por qué esta sugerencia para ${producto.sku}?`,
        "¿Cuándo debo ordenar?",
        "¿Qué eventos lo afectan?"
    ];
    
    // Sugerencias específicas según contexto
    if (producto.stock_actual === 0) {
        baseSuggestions.push("¿Por qué me quedé sin stock?");
    }
    
    if (producto.sugerencia_reposicion_ia && producto.cantidadSugerida) {
        baseSuggestions.push("Comparar sistema vs IA");
    }
    
    return baseSuggestions;
}

function getHelpSuggestions() {
    return [
        "¿Cómo funciona la predicción IA?",
        "¿Qué eventos considera el sistema?",
        "¿Cómo interpretar las alertas temporales?",
        "¿Puedo simular escenarios?"
    ];
}

function getDefaultSuggestions(contextualData) {
    return [
        "¿En qué te puedo ayudar?",
        "Pregunta sobre predicciones, stock o timing",
        "Escribe 'help' para ver comandos"
    ];
}

function getStatusEmoji(status) {
    const emojis = {
        'planificacion': '📋',
        'urgente': '⚠️',
        'critico': '🚨',
        'vencido': '❌'
    };
    return emojis[status] || '📊';
}