// test-production-api.js - Prueba directa del API de producción
const https = require('https');

function testProductionAPI() {
  console.log('🧪 Probando API de producción...\n');
  
  const options = {
    hostname: 'sistemadegestion.net',
    port: 443,
    path: '/api/analysis-fast?limit=3',
    method: 'GET',
    headers: {
      'User-Agent': 'Node.js Test',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    
    console.log(`📡 Status: ${res.statusCode}`);
    console.log(`📋 Headers:`, res.headers);
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        console.log('\n🔍 RESPUESTA DEL API:');
        
        if (result.results && result.results.length > 0) {
          result.results.forEach((product, i) => {
            const precio = product.impactoEconomico?.precioPromedioReal || 'N/A';
            const valor = product.impactoEconomico?.valorTotal || 'N/A';
            console.log(`   ${i+1}. ${product.sku}: Precio=$${precio} Valor=$${valor}`);
          });
          
          console.log('\n🎯 ANÁLISIS:');
          const preciosReales = result.results.filter(p => 
            p.impactoEconomico?.precioPromedioReal && 
            p.impactoEconomico?.precioPromedioReal !== 5000 &&
            p.impactoEconomico?.precioPromedioReal !== 8000
          );
          
          if (preciosReales.length > 0) {
            console.log(`   ✅ ${preciosReales.length}/${result.results.length} productos con precios reales`);
          } else {
            console.log(`   ❌ Todos los productos siguen con precios fallback (5000/8000)`);
            console.log(`   🔧 PROBLEMA: El API no está usando los precios importados`);
          }
          
        } else {
          console.log('   ❌ No se obtuvieron productos del API');
        }
        
        if (result.metadata) {
          console.log(`\n📊 METADATA:`);
          console.log(`   - Tiempo: ${result.metadata.processingTime}`);
          console.log(`   - Cache hit ratio: ${result.metadata.cacheHitRatio}`);
          console.log(`   - From cache: ${result.metadata.fromCacheCount}`);
        }
        
      } catch (error) {
        console.log('\n❌ Respuesta no es JSON válido:');
        console.log(data.substring(0, 500));
      }
      
      process.exit(0);
    });
  });
  
  req.on('error', (error) => {
    console.error('❌ Error en request:', error.message);
    process.exit(1);
  });
  
  req.setTimeout(10000, () => {
    console.error('❌ Timeout del request');
    req.destroy();
    process.exit(1);
  });
  
  req.end();
}

testProductionAPI();