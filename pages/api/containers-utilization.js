// pages/api/containers-utilization.js
import { supabase } from '../../lib/supabaseClient';

/**
 * API para obtener la utilización de contenedores basada en compras
 * GET /api/containers-utilization
 *
 * Retorna para cada contenedor:
 * - Productos asignados (desde compras)
 * - CBM total usado
 * - Cantidad total de productos
 * - Porcentaje de utilización
 */
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('📊 Calculando utilización de contenedores...');

        // 1. Obtener todas las compras con container_number
        // NUEVO: Ahora incluimos CBM directamente desde compras
        const { data: compras, error: comprasError } = await supabase
            .from('compras')
            .select('sku, cantidad, container_number, cbm')
            .not('container_number', 'is', null);

        if (comprasError) {
            console.error('Error obteniendo compras:', comprasError);
            return res.status(500).json({ error: comprasError.message });
        }

        console.log(`✅ Obtenidas ${compras?.length || 0} compras con contenedor`);

        // 2. Obtener SKUs únicos para buscar descripciones en products
        const skusUnicos = [...new Set(compras?.map(c => c.sku) || [])];

        const { data: productos, error: productosError } = await supabase
            .from('products')
            .select('sku, descripcion')
            .in('sku', skusUnicos);

        if (productosError) {
            console.error('Error obteniendo productos:', productosError);
            // No fallar, continuar sin descripciones
        }

        // Crear mapa de descripciones
        const descripcionesMap = {};
        productos?.forEach(p => {
            descripcionesMap[p.sku] = p.descripcion || 'Sin descripción';
        });

        // 3. Agrupar compras por contenedor
        const contenedoresUtilizacion = {};

        compras?.forEach(compra => {
            const containerNumber = compra.container_number;

            if (!contenedoresUtilizacion[containerNumber]) {
                contenedoresUtilizacion[containerNumber] = {
                    container_number: containerNumber,
                    productos: [],
                    total_productos: 0,
                    total_cantidad: 0,
                    total_cbm: 0
                };
            }

            // NUEVO: CBM viene directamente de la tabla compras
            const cbmProducto = parseFloat(compra.cbm) || 0;
            const cbmTotal = cbmProducto * compra.cantidad;

            contenedoresUtilizacion[containerNumber].productos.push({
                sku: compra.sku,
                cantidad: compra.cantidad,
                cbm_unitario: cbmProducto,
                cbm_total: cbmTotal,
                descripcion: descripcionesMap[compra.sku] || 'Sin descripción'
            });

            contenedoresUtilizacion[containerNumber].total_productos += 1;
            contenedoresUtilizacion[containerNumber].total_cantidad += compra.cantidad;
            contenedoresUtilizacion[containerNumber].total_cbm += cbmTotal;
        });

        console.log(`✅ Calculada utilización para ${Object.keys(contenedoresUtilizacion).length} contenedores`);

        return res.status(200).json({
            success: true,
            total_contenedores: Object.keys(contenedoresUtilizacion).length,
            contenedores: contenedoresUtilizacion
        });

    } catch (error) {
        console.error('❌ Error en containers-utilization:', error);
        return res.status(500).json({ error: error.message });
    }
}
