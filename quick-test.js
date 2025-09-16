// quick-test.js - Test API locally
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/analysis-fast?limit=2',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('\n✅ JSON válido');
      console.log('Products:', result.results?.length || 0);
      if (result.results?.[0]) {
        const first = result.results[0];
        console.log(`Primer producto: ${first.sku} - Precio: $${first.impactoEconomico?.precioPromedioReal || 'N/A'}`);
      }
    } catch (error) {
      console.log('\n❌ JSON inválido:');
      console.log('Error:', error.message);
      console.log('Data length:', data.length);
      console.log('First 200 chars:', data.substring(0, 200));
    }
    process.exit(0);
  });
});

req.on('error', (error) => {
  console.error('Request error:', error.message);
  process.exit(1);
});

req.setTimeout(5000, () => {
  console.error('Request timeout');
  req.destroy();
  process.exit(1);
});

req.end();