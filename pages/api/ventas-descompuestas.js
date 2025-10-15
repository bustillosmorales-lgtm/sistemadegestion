// pages/api/ventas-descompuestas.js
import { supabase } from '../../lib/supabaseClient';

/**
 * API para obtener ventas con packs descompuestos
 * GET /api/ventas-descompuestas?fecha_inicio=2024-10-01&fecha_fin=2024-10-31
 */
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { fecha_inicio, fecha_fin, sku } = req.query;

    if (!fecha_inicio || !fecha_fin) {
        return res.status(400).json({
            error: 'Parámetros requeridos: fecha_inicio, fecha_fin',
            ejemplo: '/api/ventas-descompuestas?fecha_inicio=2024-10-01&fecha_fin=2024-10-31'
        });
    }

    try {
        console.log(`📊 Obteniendo ventas descompuestas: ${fecha_inicio} a ${fecha_fin}`);

        // Usar la función de PostgreSQL
        const { data, error } = await supabase
            .rpc('obtener_ventas_diarias_con_packs', {
                p_fecha_inicio: fecha_inicio,
                p_fecha_fin: fecha_fin
            });

        if (error) {
            console.error('Error obteniendo ventas descompuestas:', error);
            return res.status(500).json({ error: error.message });
        }

        // Filtrar por SKU si se especifica
        let resultado = data;
        if (sku) {
            resultado = data.filter(v => v.sku === sku);
        }

        // Agrupar por SKU para resumen
        const resumenPorSku = {};
        resultado.forEach(venta => {
            if (!resumenPorSku[venta.sku]) {
                resumenPorSku[venta.sku] = {
                    sku: venta.sku,
                    cantidad_total: 0,
                    ventas_directas: 0,
                    ventas_por_packs: 0,
                    dias_vendidos: 0
                };
            }

            resumenPorSku[venta.sku].cantidad_total += parseInt(venta.cantidad_total);
            resumenPorSku[venta.sku].ventas_directas += parseInt(venta.ventas_directas);
            resumenPorSku[venta.sku].ventas_por_packs += parseInt(venta.ventas_por_packs);
            resumenPorSku[venta.sku].dias_vendidos += 1;
        });

        return res.status(200).json({
            fecha_inicio,
            fecha_fin,
            total_registros: resultado.length,
            ventas_diarias: resultado,
            resumen_por_sku: Object.values(resumenPorSku).sort((a, b) => b.cantidad_total - a.cantidad_total)
        });

    } catch (error) {
        console.error('Error en ventas-descompuestas:', error);
        return res.status(500).json({ error: error.message });
    }
}
