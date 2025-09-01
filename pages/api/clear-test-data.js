// pages/api/clear-test-data.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const { confirmCode } = req.body;

    // Código de confirmación para evitar eliminaciones accidentales
    if (confirmCode !== 'CLEAR_ALL_TEST_DATA') {
        return res.status(400).json({ error: 'Código de confirmación incorrecto' });
    }

    try {
        const results = {
            containers: 0,
            products: 0,
            compras: 0,
            ventas: 0,
            errors: []
        };

        // Limpiar contenedores
        try {
            const { data: containersData, error: containersError } = await supabase
                .from('containers')
                .delete()
                .neq('id', 0); // Eliminar todos los registros

            if (containersError) {
                results.errors.push(`Containers: ${containersError.message}`);
            } else {
                results.containers = containersData?.length || 0;
            }
        } catch (error) {
            results.errors.push(`Containers: ${error.message}`);
        }

        // Limpiar productos
        try {
            const { data: productsData, error: productsError } = await supabase
                .from('products')
                .delete()
                .neq('id', 0); // Eliminar todos los registros

            if (productsError) {
                results.errors.push(`Products: ${productsError.message}`);
            } else {
                results.products = productsData?.length || 0;
            }
        } catch (error) {
            results.errors.push(`Products: ${error.message}`);
        }

        // Limpiar compras
        try {
            const { data: comprasData, error: comprasError } = await supabase
                .from('compras')
                .delete()
                .neq('id', 0); // Eliminar todos los registros

            if (comprasError) {
                results.errors.push(`Compras: ${comprasError.message}`);
            } else {
                results.compras = comprasData?.length || 0;
            }
        } catch (error) {
            results.errors.push(`Compras: ${error.message}`);
        }

        // Limpiar ventas
        try {
            const { data: ventasData, error: ventasError } = await supabase
                .from('ventas')
                .delete()
                .neq('id', 0); // Eliminar todos los registros

            if (ventasError) {
                results.errors.push(`Ventas: ${ventasError.message}`);
            } else {
                results.ventas = ventasData?.length || 0;
            }
        } catch (error) {
            results.errors.push(`Ventas: ${error.message}`);
        }

        return res.status(200).json({
            success: true,
            message: 'Limpieza de datos de prueba completada',
            results: results
        });

    } catch (error) {
        console.error('Error limpiando datos de prueba:', error);
        return res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message 
        });
    }
}