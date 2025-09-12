// pages/debug-prices.js - Página temporal para debug de precios
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function DebugPrices() {
  const [debugData, setDebugData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function testPricing() {
      try {
        // Test 1: Check database connection
        const { data: testConnection } = await supabase
          .from('ventas')
          .select('count')
          .single();
        
        // Test 2: Check for imported prices
        const { data: realPrices } = await supabase
          .from('ventas')
          .select('sku, precio_unitario')
          .not('precio_unitario', 'is', null)
          .gt('precio_unitario', 10000)
          .order('precio_unitario', { ascending: false })
          .limit(5);
          
        // Test 3: Test specific high-value SKU
        const { data: specificSku } = await supabase
          .from('ventas')
          .select('sku, precio_unitario')
          .eq('sku', '649762430726-TUR')
          .not('precio_unitario', 'is', null);
          
        // Test 4: Check environment variables
        const env = {
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
          hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          nodeEnv: process.env.NODE_ENV,
          timestamp: new Date().toISOString()
        };
        
        // Test 5: Call analysis API directly
        const apiResponse = await fetch('/api/analysis-fast?limit=3');
        const apiData = await apiResponse.json();
        
        setDebugData({
          connection: testConnection ? 'OK' : 'FAILED',
          realPrices: realPrices || [],
          specificSku: specificSku || [],
          environment: env,
          apiSample: apiData?.results?.slice(0, 2) || [],
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        setDebugData({
          error: error.message,
          timestamp: new Date().toISOString()
        });
      } finally {
        setLoading(false);
      }
    }
    
    testPricing();
  }, []);

  if (loading) {
    return <div style={{padding: '20px'}}>🔍 Debugging pricing system...</div>;
  }

  return (
    <div style={{padding: '20px', fontFamily: 'monospace', fontSize: '14px'}}>
      <h1>🐛 Price Debug Page - {debugData.timestamp}</h1>
      
      <div style={{marginBottom: '20px', padding: '10px', border: '1px solid #ccc'}}>
        <h3>📊 Database Connection</h3>
        <p>Status: {debugData.connection}</p>
      </div>
      
      <div style={{marginBottom: '20px', padding: '10px', border: '1px solid #ccc'}}>
        <h3>💰 Real Prices Found (>$10,000)</h3>
        {debugData.realPrices?.length > 0 ? (
          <ul>
            {debugData.realPrices.map((price, i) => (
              <li key={i}>{price.sku}: ${price.precio_unitario.toLocaleString()} CLP</li>
            ))}
          </ul>
        ) : (
          <p>❌ No real prices found - This is the problem!</p>
        )}
      </div>
      
      <div style={{marginBottom: '20px', padding: '10px', border: '1px solid #ccc'}}>
        <h3>🎯 Specific SKU Test (649762430726-TUR should be $179,991)</h3>
        {debugData.specificSku?.length > 0 ? (
          <ul>
            {debugData.specificSku.map((price, i) => (
              <li key={i}>{price.sku}: ${price.precio_unitario.toLocaleString()} CLP</li>
            ))}
          </ul>
        ) : (
          <p>❌ Specific high-value SKU not found</p>
        )}
      </div>
      
      <div style={{marginBottom: '20px', padding: '10px', border: '1px solid #ccc'}}>
        <h3>🔧 Environment Info</h3>
        <pre>{JSON.stringify(debugData.environment, null, 2)}</pre>
      </div>
      
      <div style={{marginBottom: '20px', padding: '10px', border: '1px solid #ccc'}}>
        <h3>⚡ API Response Sample</h3>
        {debugData.apiSample?.map((product, i) => (
          <div key={i} style={{margin: '10px 0', padding: '5px', background: '#f5f5f5'}}>
            <strong>{product.sku}</strong><br/>
            Price: ${product.impactoEconomico?.precioPromedioReal || 'N/A'}<br/>
            Value: ${product.impactoEconomico?.valorTotal || 'N/A'}<br/>
            From Cache: {product.fromCache ? 'Yes' : 'No'}
          </div>
        ))}
      </div>
      
      {debugData.error && (
        <div style={{color: 'red', padding: '10px', border: '2px solid red'}}>
          <h3>❌ Error</h3>
          <p>{debugData.error}</p>
        </div>
      )}
      
      <div style={{marginTop: '30px', padding: '10px', background: '#e8f4fd'}}>
        <h3>🎯 Expected Results</h3>
        <p>✅ Should find SKU 649762430726-TUR with price $179,991</p>
        <p>✅ Should find SKU 649762431419 with price $54,980</p>
        <p>✅ API should return these real prices instead of 5000/8000</p>
        <p>❌ If not found: Production uses different database</p>
      </div>
    </div>
  );
}