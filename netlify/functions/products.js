exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const products = [
    {
      sku: '649701',
      descripcion: 'Smartphone Galaxy Pro',
      stockActual: 50,
      ventaDiaria: 2.5,
      totalEnTransito: 100,
      proximaLlegada: '2025-09-15',
      stockProyectado90dias: -175,
      cantidadSugerida: 400,
      estadoInventario: 'CRÍTICO',
      precioMinPostArribo: 19990,
      fechaPrecioMin: '2025-08-01'
    },
    {
      sku: '549802',
      descripcion: 'Laptop Business Elite',
      stockActual: 25,
      ventaDiaria: 1.2,
      totalEnTransito: 50,
      proximaLlegada: '2025-09-20',
      stockProyectado90dias: 25,
      cantidadSugerida: 83,
      estadoInventario: 'NORMAL',
      precioMinPostArribo: 45990,
      fechaPrecioMin: '2025-07-15'
    }
  ];

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(products)
  };
};