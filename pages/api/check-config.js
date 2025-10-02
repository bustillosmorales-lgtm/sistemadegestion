// pages/api/check-config.js - Verificar configuración actual
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  try {
    // Get current configuration
    const { data: configData, error: configError } = await supabase
      .from('configuration')
      .select('data')
      .eq('id', 1)
      .single();

    if (configError) {
      return res.status(500).json({
        error: 'Config not found',
        details: configError.message
      });
    }

    const config = configData.data;

    return res.status(200).json({
      success: true,
      configuration: config,
      calculationDetails: {
        stockSaludableMinDias: config.stockSaludableMinDias || 'NO CONFIGURADO',
        tiempoEntrega: config.tiempoEntrega || 'NO CONFIGURADO',
        tiempoPromedioFabricacion: config.tiempoPromedioFabricacion || 'NO CONFIGURADO',
        leadTimeDias: (config.tiempoEntrega || 60) + (config.tiempoPromedioFabricacion || 30),
        calculationExample: {
          ventaDiaria: 1.24,
          stockObjetivoCalculado: Math.round(1.24 * (config.stockSaludableMinDias || 30)),
          formula: `ventaDiaria (1.24) × stockSaludableMinDias (${config.stockSaludableMinDias || 30}) = ${Math.round(1.24 * (config.stockSaludableMinDias || 30))}`
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Error checking config',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}