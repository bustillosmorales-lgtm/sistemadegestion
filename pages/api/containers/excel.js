// pages/api/containers/excel.js
import { supabase } from '../../../lib/supabaseClient';
import * as XLSX from 'xlsx';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const { container_number } = req.query;

    if (!container_number) {
        return res.status(400).json({ error: 'container_number es requerido' });
    }

    try {
        // 1. Obtener información del contenedor
        const { data: container, error: containerError } = await supabase
            .from('containers')
            .select('*')
            .eq('container_number', container_number)
            .single();

        if (containerError || !container) {
            return res.status(404).json({ error: 'Contenedor no encontrado' });
        }

        // 2. Obtener productos asignados al contenedor
        // Los productos en SHIPPED que tienen este contenedor en shipping_details
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select(`
                sku,
                descripcion,
                stock_actual,
                costo_fob_rmb,
                cbm,
                link,
                status,
                purchase_details,
                manufacturing_details,
                shipping_details
            `)
            .eq('status', 'SHIPPED');

        if (productsError) {
            return res.status(500).json({ error: 'Error obteniendo productos: ' + productsError.message });
        }

        // 3. Filtrar productos que están en este contenedor
        const containerProducts = (products || []).filter(product => 
            product.shipping_details?.containerNumber === container_number
        );

        // 4. Obtener compras relacionadas para obtener cantidades y precios
        const skusInContainer = containerProducts.map(p => p.sku);
        let compras = [];
        
        if (skusInContainer.length > 0) {
            const { data: comprasData, error: comprasError } = await supabase
                .from('compras')
                .select('*')
                .in('sku', skusInContainer);
            
            compras = comprasData || [];
        }

        // 5. Preparar datos para Excel
        const excelData = containerProducts.map(product => {
            // Encontrar compra relacionada más reciente para este SKU
            const compraRelacionada = compras
                .filter(c => c.sku === product.sku)
                .sort((a, b) => new Date(b.fecha_compra) - new Date(a.fecha_compra))[0];

            // Obtener cantidades desde los detalles del producto
            const cantidadEnviada = product.shipping_details?.shippedQuantity || 
                                  product.manufacturing_details?.manufacturedQuantity || 
                                  product.purchase_details?.confirmedQuantity || 0;

            return {
                sku: product.sku,
                descripcion: product.descripcion || '',
                cantidad_enviada: cantidadEnviada,
                cbm_unitario: product.cbm || 0,
                cbm_total: (product.cbm || 0) * cantidadEnviada,
                costo_fob_rmb_unitario: product.costo_fob_rmb || 0,
                costo_fob_rmb_total: (product.costo_fob_rmb || 0) * cantidadEnviada,
                link: product.link || '',
                status: product.status,
                fecha_compra: compraRelacionada?.fecha_compra || '',
                fecha_llegada_estimada: compraRelacionada?.fecha_llegada_estimada || '',
                proveedor: compraRelacionada?.proveedor || '',
                notas_compra: compraRelacionada?.notas || ''
            };
        });

        // 6. Calcular totales
        const totales = excelData.reduce((acc, item) => ({
            cantidad_total: acc.cantidad_total + item.cantidad_enviada,
            cbm_total: acc.cbm_total + item.cbm_total,
            costo_total_rmb: acc.costo_total_rmb + item.costo_fob_rmb_total
        }), { cantidad_total: 0, cbm_total: 0, costo_total_rmb: 0 });

        // 7. Agregar fila de totales
        excelData.push({
            sku: 'TOTALES',
            descripcion: '',
            cantidad_enviada: totales.cantidad_total,
            cbm_unitario: '',
            cbm_total: totales.cbm_total,
            costo_fob_rmb_unitario: '',
            costo_fob_rmb_total: totales.costo_total_rmb,
            link: '',
            status: '',
            fecha_compra: '',
            fecha_llegada_estimada: '',
            proveedor: '',
            notas_compra: ''
        });

        // 8. Si no hay productos, mostrar mensaje
        if (containerProducts.length === 0) {
            excelData.push({
                sku: 'Sin productos asignados',
                descripcion: 'Este contenedor no tiene productos asignados actualmente',
                cantidad_enviada: '',
                cbm_unitario: '',
                cbm_total: '',
                costo_fob_rmb_unitario: '',
                costo_fob_rmb_total: '',
                link: '',
                status: '',
                fecha_compra: '',
                fecha_llegada_estimada: '',
                proveedor: '',
                notas_compra: ''
            });
        }

        // 9. Crear workbook con información del contenedor
        const workbook = XLSX.utils.book_new();
        
        // Hoja 1: Información del contenedor
        const containerInfo = [
            ['INFORMACIÓN DEL CONTENEDOR', ''],
            ['Número de Contenedor', container.container_number],
            ['Tipo', container.container_type],
            ['Capacidad Máxima (CBM)', container.max_cbm],
            ['CBM Utilizado', totales.cbm_total],
            ['% Utilización', container.max_cbm > 0 ? ((totales.cbm_total / container.max_cbm) * 100).toFixed(2) + '%' : '0%'],
            ['Puerto Salida', container.departure_port || ''],
            ['Puerto Llegada', container.arrival_port || ''],
            ['Fecha Salida Estimada', container.estimated_departure || ''],
            ['Fecha Llegada Estimada', container.estimated_arrival || ''],
            ['Naviera', container.shipping_company || ''],
            ['Estado', container.status],
            ['Notas', container.notes || ''],
            ['', ''],
            ['RESUMEN', ''],
            ['Total Productos', containerProducts.length],
            ['Total Cantidad', totales.cantidad_total],
            ['Total CBM', totales.cbm_total.toFixed(2)],
            ['Costo Total (RMB)', totales.costo_total_rmb.toFixed(2)]
        ];

        const infoSheet = XLSX.utils.aoa_to_sheet(containerInfo);
        XLSX.utils.book_append_sheet(workbook, infoSheet, 'Info Contenedor');

        // Hoja 2: Productos detallados
        const productsSheet = XLSX.utils.json_to_sheet(excelData);
        
        // Configurar ancho de columnas
        const columnWidths = [
            { wch: 15 }, // sku
            { wch: 40 }, // descripcion
            { wch: 12 }, // cantidad_enviada
            { wch: 12 }, // cbm_unitario
            { wch: 12 }, // cbm_total
            { wch: 15 }, // costo_fob_rmb_unitario
            { wch: 15 }, // costo_fob_rmb_total
            { wch: 30 }, // link
            { wch: 15 }, // status
            { wch: 15 }, // fecha_compra
            { wch: 15 }, // fecha_llegada_estimada
            { wch: 20 }, // proveedor
            { wch: 30 }  // notas_compra
        ];
        productsSheet['!cols'] = columnWidths;

        XLSX.utils.book_append_sheet(workbook, productsSheet, 'Productos');

        // 10. Generar archivo Excel
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // 11. Configurar headers y enviar
        const fileName = `Contenedor_${container_number}_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        
        return res.send(excelBuffer);

    } catch (error) {
        console.error('Error generando Excel del contenedor:', error);
        return res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
}