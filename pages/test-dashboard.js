// pages/test-dashboard.js - Página de prueba con precios reales
import { useState, useEffect } from 'react';

export default function TestDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadRealPrices() {
      try {
        setLoading(true);
        
        // Endpoint sin cache con timestamp único
        const timestamp = Date.now();
        const response = await fetch(`/api/test-real-prices?t=${timestamp}`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        setData(result);
        
      } catch (err) {
        setError(err.message);
        console.error('Error loading test data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadRealPrices();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
        <h1>🧪 Test Dashboard - Precios Reales</h1>
        <p>Cargando datos sin cache...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
        <h1>🧪 Test Dashboard - Error</h1>
        <p style={{ color: 'red' }}>❌ Error: {error}</p>
        <button onClick={() => window.location.reload()}>
          🔄 Reintentar
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui', maxWidth: '1200px' }}>
      <h1>🧪 Test Dashboard - Precios Reales Verificados</h1>
      
      {/* Header info */}
      <div style={{ 
        backgroundColor: '#e8f5e8', 
        padding: '15px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        border: '2px solid #4caf50'
      }}>
        <h2>✅ DATOS CONFIRMADOS</h2>
        <p><strong>Timestamp:</strong> {data.timestamp}</p>
        <p><strong>Total productos:</strong> {data.totalProducts}</p>
        <p><strong>Precio más alto:</strong> ${data.summary?.precioMasAlto?.toLocaleString()} CLP</p>
        <p><strong>Valor más alto:</strong> ${data.summary?.valorTotalMasAlto?.toLocaleString()} CLP</p>
        <p><strong>Rango de precios:</strong> {data.summary?.rangoPrecios}</p>
      </div>

      {/* Results table */}
      <div style={{ marginBottom: '20px' }}>
        <h2>📊 PRODUCTOS ORDENADOS POR IMPACTO ECONÓMICO</h2>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          backgroundColor: 'white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={{ border: '1px solid #dee2e6', padding: '12px', textAlign: 'left' }}>#</th>
              <th style={{ border: '1px solid #dee2e6', padding: '12px', textAlign: 'left' }}>SKU</th>
              <th style={{ border: '1px solid #dee2e6', padding: '12px', textAlign: 'left' }}>Precio Real</th>
              <th style={{ border: '1px solid #dee2e6', padding: '12px', textAlign: 'left' }}>Stock</th>
              <th style={{ border: '1px solid #dee2e6', padding: '12px', textAlign: 'left' }}>Cantidad Sugerida</th>
              <th style={{ border: '1px solid #dee2e6', padding: '12px', textAlign: 'left' }}>Valor Total</th>
              <th style={{ border: '1px solid #dee2e6', padding: '12px', textAlign: 'left' }}>Prioridad</th>
              <th style={{ border: '1px solid #dee2e6', padding: '12px', textAlign: 'left' }}>Descripción</th>
            </tr>
          </thead>
          <tbody>
            {data.results?.map((product, index) => (
              <tr key={product.sku} style={{ 
                backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa',
                borderBottom: '1px solid #dee2e6'
              }}>
                <td style={{ border: '1px solid #dee2e6', padding: '12px' }}>
                  {index + 1}
                </td>
                <td style={{ border: '1px solid #dee2e6', padding: '12px', fontFamily: 'monospace' }}>
                  {product.sku}
                </td>
                <td style={{ 
                  border: '1px solid #dee2e6', 
                  padding: '12px',
                  fontWeight: 'bold',
                  color: '#007bff'
                }}>
                  ${product.precioReal?.toLocaleString()} CLP
                </td>
                <td style={{ border: '1px solid #dee2e6', padding: '12px' }}>
                  {product.stockActual}
                </td>
                <td style={{ border: '1px solid #dee2e6', padding: '12px' }}>
                  {product.cantidadSugerida}
                </td>
                <td style={{ 
                  border: '1px solid #dee2e6', 
                  padding: '12px',
                  fontWeight: 'bold',
                  color: product.valorTotal > 500000 ? '#dc3545' : 
                         product.valorTotal > 200000 ? '#fd7e14' : '#28a745'
                }}>
                  ${product.valorTotal?.toLocaleString()}
                </td>
                <td style={{ border: '1px solid #dee2e6', padding: '12px' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: 'white',
                    backgroundColor: product.prioridad === 'CRÍTICA' ? '#dc3545' :
                                    product.prioridad === 'ALTA' ? '#fd7e14' : '#28a745'
                  }}>
                    {product.prioridad}
                  </span>
                </td>
                <td style={{ border: '1px solid #dee2e6', padding: '12px', fontSize: '14px' }}>
                  {product.descripcion}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Comparison */}
      <div style={{
        backgroundColor: '#fff3cd',
        padding: '15px',
        borderRadius: '8px',
        border: '2px solid #ffc107'
      }}>
        <h2>🎯 COMPARACIÓN</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <h3 style={{ color: '#dc3545' }}>❌ PROBLEMA ANTERIOR</h3>
            <p>Todos los productos mostraban <strong>$5.000 CLP</strong></p>
            <p>Ordenamiento incorrecto</p>
            <p>Sin impacto económico real</p>
          </div>
          <div>
            <h3 style={{ color: '#28a745' }}>✅ SOLUCIÓN ACTUAL</h3>
            <p>Precios reales desde <strong>${data.summary?.rangoPrecios}</strong></p>
            <p>Ordenamiento por valor económico real</p>
            <p>Impacto basado en ventas históricas</p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button 
          onClick={() => window.location.reload()} 
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          🔄 Recargar Datos
        </button>
      </div>
    </div>
  );
}