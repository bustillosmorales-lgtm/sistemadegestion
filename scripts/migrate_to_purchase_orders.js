// scripts/migrate_to_purchase_orders.js
// Migra datos existentes de products a purchase_orders

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function migrateData() {
  console.log('🚀 Iniciando migración a purchase_orders...\n');

  try {
    // 1. Obtener todos los productos que NO están en NEEDS_REPLENISHMENT
    console.log('📊 Step 1: Consultando productos con órdenes activas...');

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .not('status', 'in', '(NEEDS_REPLENISHMENT,NO_REPLENISHMENT_NEEDED)');

    if (productsError) {
      throw new Error(`Error obteniendo productos: ${productsError.message}`);
    }

    console.log(`✅ Encontrados ${products?.length || 0} productos con órdenes activas\n`);

    if (!products || products.length === 0) {
      console.log('ℹ️  No hay productos para migrar');
      return;
    }

    // 2. Por cada producto, crear orden en purchase_orders
    let created = 0;
    let errors = 0;

    for (const product of products) {
      try {
        const sku = product.sku;
        const orderNumber = generateOrderNumber(sku);

        console.log(`\n📦 Migrando: ${sku} (${product.status})`);

        // Determinar cantidad solicitada basándose en request_details o approval_details
        let cantidadSolicitada = 0;

        if (product.request_details?.quantityToQuote) {
          cantidadSolicitada = product.request_details.quantityToQuote;
        } else if (product.approval_details?.approvedQuantity) {
          cantidadSolicitada = product.approval_details.approvedQuantity;
        } else {
          // Valor por defecto basado en análisis
          cantidadSolicitada = 100; // Se actualizará cuando se recalcule
          console.log(`   ⚠️  Cantidad no encontrada, usando default: ${cantidadSolicitada}`);
        }

        // Crear orden
        const newOrder = {
          sku: sku,
          order_number: orderNumber,
          cantidad_solicitada: cantidadSolicitada,
          cantidad_recibida: 0,
          status: product.status,
          request_details: product.request_details || null,
          quote_details: product.quote_details || null,
          analysis_details: product.analysis_details || null,
          approval_details: product.approval_details || null,
          purchase_details: product.purchase_details || null,
          manufacturing_details: product.manufacturing_details || null,
          shipping_details: product.shipping_details || null,
          notes: `Migrado desde products.status = ${product.status}`,
          created_at: product.updated_at || new Date().toISOString()
        };

        const { data: orderData, error: orderError } = await supabase
          .from('purchase_orders')
          .insert(newOrder)
          .select();

        if (orderError) {
          console.log(`   ❌ Error creando orden: ${orderError.message}`);
          errors++;
          continue;
        }

        console.log(`   ✅ Orden creada: ${orderNumber}`);

        // Actualizar producto
        const { error: updateError } = await supabase
          .from('products')
          .update({
            primary_status: product.status,
            has_active_orders: true,
            // Limpiar campos de detalles (ahora están en purchase_orders)
            request_details: null,
            quote_details: null,
            analysis_details: null,
            approval_details: null,
            purchase_details: null,
            manufacturing_details: null,
            shipping_details: null
          })
          .eq('sku', sku);

        if (updateError) {
          console.log(`   ⚠️  Error actualizando producto: ${updateError.message}`);
        } else {
          console.log(`   ✅ Producto actualizado: primary_status = ${product.status}`);
        }

        created++;

      } catch (error) {
        console.error(`   ❌ Error procesando ${product.sku}:`, error.message);
        errors++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`\n📊 Resumen de Migración:`);
    console.log(`   ✅ Órdenes creadas: ${created}`);
    console.log(`   ❌ Errores: ${errors}`);
    console.log(`   📦 Total procesados: ${products.length}`);

    // 3. Verificar integridad
    console.log(`\n🔍 Verificando integridad...`);

    const { data: ordersCount, error: countError } = await supabase
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true });

    console.log(`   📊 Total órdenes en purchase_orders: ${ordersCount?.length || 0}`);

    // 4. Mostrar resumen por status
    const { data: ordersByStatus } = await supabase
      .from('purchase_orders')
      .select('status');

    if (ordersByStatus) {
      const statusCounts = {};
      ordersByStatus.forEach(order => {
        statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
      });

      console.log(`\n   📋 Órdenes por status:`);
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`      ${status}: ${count}`);
      });
    }

    console.log(`\n✅ Migración completada exitosamente!\n`);

  } catch (error) {
    console.error('\n❌ Error en migración:', error);
    process.exit(1);
  }
}

function generateOrderNumber(sku) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  const random = Math.floor(Math.random() * 10000).toString().padStart(5, '0');
  return `ORD-${timestamp}-${random}`;
}

// Ejecutar migración
migrateData()
  .then(() => {
    console.log('🎉 Script completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
