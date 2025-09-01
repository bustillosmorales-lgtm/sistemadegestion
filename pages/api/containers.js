// pages/api/containers.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('containers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { 
        container_number, 
        container_type, 
        max_cbm, 
        departure_port, 
        arrival_port, 
        estimated_departure, 
        estimated_arrival, 
        shipping_company,
        notes 
      } = req.body;

      if (!container_number) {
        return res.status(400).json({ error: 'Número de contenedor es requerido' });
      }

      // Verificar que no exista ya un contenedor con ese número
      const { data: existingContainer } = await supabase
        .from('containers')
        .select('container_number')
        .eq('container_number', container_number)
        .single();

      if (existingContainer) {
        return res.status(400).json({ error: 'Ya existe un contenedor con ese número' });
      }

      const newContainer = {
        container_number,
        container_type: container_type || 'STD',
        max_cbm: parseFloat(max_cbm) || 68,
        departure_port: departure_port || '',
        arrival_port: arrival_port || '',
        estimated_departure,
        estimated_arrival,
        shipping_company: shipping_company || '',
        notes: notes || '',
        status: 'CREATED',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('containers')
        .insert(newContainer)
        .select();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data[0]);
    } catch (err) {
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { id } = req.query;
      const { container_number } = req.query;
      const updateData = { ...req.body, updated_at: new Date().toISOString() };
      
      // Si se proporciona fecha efectiva de llegada, procesar todos los SKUs del contenedor
      if (updateData.actual_arrival_date && !updateData.processed) {
        // Buscar productos en este contenedor con status SHIPPED
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('sku, shipping_details')
          .eq('status', 'SHIPPED');
        
        if (!productsError && products) {
          const containerProducts = products.filter(product => 
            product.shipping_details?.containerNumber === (container_number || updateData.container_number)
          );
          
          // Crear registros de compras históricas
          const purchaseRecords = containerProducts.map(product => ({
            sku: product.sku,
            fecha_llegada_real: updateData.actual_arrival_date,
            cantidad: product.shipping_details?.shippedQuantity || 0,
            container_number: container_number || updateData.container_number,
            created_at: new Date().toISOString()
          }));
          
          if (purchaseRecords.length > 0) {
            // Insertar en tabla de compras
            await supabase.from('compras').insert(purchaseRecords);
            
            // Actualizar status de productos a NEEDS_REPLENISHMENT y incrementar stock
            for (const product of containerProducts) {
              const currentQuantity = product.shipping_details?.shippedQuantity || 0;
              
              // Obtener stock actual
              const { data: productData } = await supabase
                .from('products')
                .select('stock_actual')
                .eq('sku', product.sku)
                .single();
              
              const newStock = (productData?.stock_actual || 0) + currentQuantity;
              
              // Marcar producto como finalizado (no debe aparecer en dashboard)
              await supabase
                .from('products')
                .update({
                  stock_actual: newStock,
                  // Marcar como finalizados para filtrar del dashboard
                  workflow_completed: true,
                  completed_at: updateData.actual_arrival_date,
                  // Mantener todos los detalles como historial
                  shipping_details: {
                    ...product.shipping_details,
                    arrived: true,
                    arrival_date: updateData.actual_arrival_date,
                    completed: true
                  },
                  updated_at: new Date().toISOString()
                })
                .eq('sku', product.sku);
            }
          }
          
          // Marcar como procesado
          updateData.processed = true;
        }
        
        // Actualizar status del contenedor a DELIVERED
        updateData.status = 'DELIVERED';
      }
      
      const whereClause = id ? { id } : { container_number };
      const { data, error } = await supabase
        .from('containers')
        .update(updateData)
        .match(whereClause)
        .select();
      
      if (error) return res.status(500).json({ error: error.message });
      if (!data || data.length === 0) return res.status(404).json({ error: 'Contenedor no encontrado' });
      
      return res.status(200).json(data[0]);
    } catch (err) {
      console.error('Error en PATCH containers:', err);
      return res.status(500).json({ error: 'Error interno del servidor: ' + err.message });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}