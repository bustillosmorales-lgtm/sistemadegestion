// pages/system-diagnosis.js - Diagnóstico completo del sistema
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function SystemDiagnosis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function runDiagnosis() {
      const results = {};
      
      try {
        // 1. Environment info
        results.environment = {
          nodeEnv: process.env.NODE_ENV,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          timestamp: new Date().toISOString(),
          userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Server',
          hostname: typeof window !== 'undefined' ? window.location.hostname : 'Server'
        };

        // 2. Database connection test
        results.dbConnection = { status: 'testing...' };
        try {
          const { data: testQuery, error } = await supabase
            .from('products')
            .select('count')
            .single();
          
          results.dbConnection = {
            status: error ? 'ERROR' : 'OK',
            error: error?.message,
            queryResult: testQuery
          };
        } catch (dbError) {
          results.dbConnection = {
            status: 'FAILED',
            error: dbError.message
          };
        }

        // 3. Products with prices count
        try {
          const { count: totalProducts } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true });
            
          const { count: withPrices } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .not('precio_venta_sugerido', 'is', null)
            .gt('precio_venta_sugerido', 0);

          results.productStats = {
            totalProducts,
            withPrices,
            percentage: totalProducts > 0 ? Math.round((withPrices/totalProducts)*100) : 0
          };
        } catch (error) {
          results.productStats = { error: error.message };
        }

        // 4. Sample products with highest prices
        try {
          const { data: topProducts } = await supabase
            .from('products')
            .select('sku, descripcion, precio_venta_sugerido')
            .not('precio_venta_sugerido', 'is', null)
            .gt('precio_venta_sugerido', 0)
            .order('precio_venta_sugerido', { ascending: false })
            .limit(5);

          results.topProducts = topProducts || [];
        } catch (error) {
          results.topProducts = { error: error.message };
        }

        // 5. API endpoint test
        try {
          const apiResponse = await fetch('/api/analysis-fast?limit=3');
          const apiData = await apiResponse.json();
          
          results.apiTest = {
            status: apiResponse.ok ? 'OK' : 'ERROR',
            statusCode: apiResponse.status,
            resultCount: apiData.results?.length || 0,
            samplePrices: apiData.results?.slice(0, 3).map(p => ({
              sku: p.sku,
              price: p.impactoEconomico?.precioPromedioReal || 'N/A'
            })) || []
          };
        } catch (error) {
          results.apiTest = {
            status: 'FAILED',
            error: error.message
          };
        }

        // 6. Recent commits check (client-side only)
        if (typeof window !== 'undefined') {
          results.deployInfo = {
            url: window.location.href,
            timestamp: new Date().toISOString(),
            cacheStatus: 'Client-side diagnosis'
          };
        }

        setData(results);
      } catch (error) {
        setData({ globalError: error.message });
      } finally {
        setLoading(false);
      }
    }

    runDiagnosis();
  }, []);

  if (loading) {
    return <div style={{padding: '20px', fontFamily: 'monospace'}}>
      🔍 Running system diagnosis...
    </div>;
  }

  return (
    <div style={{
      padding: '20px', 
      fontFamily: 'monospace', 
      fontSize: '14px',
      maxWidth: '1200px'
    }}>
      <h1>🩺 SYSTEM DIAGNOSIS - {new Date().toLocaleString()}</h1>
      
      {/* Environment */}
      <div style={{marginBottom: '20px', padding: '15px', border: '2px solid #007acc', backgroundColor: '#f0f8ff'}}>
        <h2>🌍 ENVIRONMENT</h2>
        <table style={{width: '100%', borderCollapse: 'collapse'}}>
          <tbody>
            <tr><td><strong>Node ENV:</strong></td><td>{data.environment?.nodeEnv}</td></tr>
            <tr><td><strong>Hostname:</strong></td><td>{data.environment?.hostname}</td></tr>
            <tr><td><strong>Supabase URL:</strong></td><td>{data.environment?.supabaseUrl?.substring(0, 40)}...</td></tr>
            <tr><td><strong>Has Anon Key:</strong></td><td>{data.environment?.hasAnonKey ? 'YES' : 'NO'}</td></tr>
            <tr><td><strong>Timestamp:</strong></td><td>{data.environment?.timestamp}</td></tr>
          </tbody>
        </table>
      </div>

      {/* Database Connection */}
      <div style={{marginBottom: '20px', padding: '15px', border: '2px solid #28a745', backgroundColor: '#f8fff8'}}>
        <h2>🗄️ DATABASE CONNECTION</h2>
        <p><strong>Status:</strong> <span style={{
          color: data.dbConnection?.status === 'OK' ? 'green' : 'red',
          fontWeight: 'bold'
        }}>{data.dbConnection?.status}</span></p>
        {data.dbConnection?.error && <p style={{color: 'red'}}>Error: {data.dbConnection.error}</p>}
      </div>

      {/* Product Statistics */}
      <div style={{marginBottom: '20px', padding: '15px', border: '2px solid #ffc107', backgroundColor: '#fffbf0'}}>
        <h2>📊 PRODUCT STATISTICS</h2>
        {data.productStats?.error ? (
          <p style={{color: 'red'}}>Error: {data.productStats.error}</p>
        ) : (
          <>
            <p><strong>Total Products:</strong> {data.productStats?.totalProducts?.toLocaleString()}</p>
            <p><strong>With Prices:</strong> {data.productStats?.withPrices?.toLocaleString()}</p>
            <p><strong>Percentage:</strong> {data.productStats?.percentage}%</p>
          </>
        )}
      </div>

      {/* Top Products */}
      <div style={{marginBottom: '20px', padding: '15px', border: '2px solid #dc3545', backgroundColor: '#fff8f8'}}>
        <h2>💰 TOP PRICED PRODUCTS</h2>
        {Array.isArray(data.topProducts) ? (
          <table style={{width: '100%', borderCollapse: 'collapse'}}>
            <thead>
              <tr style={{backgroundColor: '#f1f1f1'}}>
                <th style={{border: '1px solid #ddd', padding: '8px', textAlign: 'left'}}>SKU</th>
                <th style={{border: '1px solid #ddd', padding: '8px', textAlign: 'left'}}>Price (CLP)</th>
                <th style={{border: '1px solid #ddd', padding: '8px', textAlign: 'left'}}>Description</th>
              </tr>
            </thead>
            <tbody>
              {data.topProducts.map((product, i) => (
                <tr key={i}>
                  <td style={{border: '1px solid #ddd', padding: '8px'}}>{product.sku}</td>
                  <td style={{border: '1px solid #ddd', padding: '8px'}}>
                    ${product.precio_venta_sugerido?.toLocaleString()}
                  </td>
                  <td style={{border: '1px solid #ddd', padding: '8px'}}>
                    {product.descripcion?.substring(0, 50)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{color: 'red'}}>Error: {data.topProducts?.error}</p>
        )}
      </div>

      {/* API Test */}
      <div style={{marginBottom: '20px', padding: '15px', border: '2px solid #17a2b8', backgroundColor: '#f0fcff'}}>
        <h2>🔌 API ENDPOINT TEST</h2>
        <p><strong>Status:</strong> <span style={{
          color: data.apiTest?.status === 'OK' ? 'green' : 'red',
          fontWeight: 'bold'
        }}>{data.apiTest?.status}</span></p>
        <p><strong>Status Code:</strong> {data.apiTest?.statusCode}</p>
        <p><strong>Results Count:</strong> {data.apiTest?.resultCount}</p>
        
        {data.apiTest?.samplePrices && (
          <div>
            <strong>Sample Prices from API:</strong>
            <ul>
              {data.apiTest.samplePrices.map((item, i) => (
                <li key={i}>{item.sku}: ${item.price}</li>
              ))}
            </ul>
          </div>
        )}
        
        {data.apiTest?.error && <p style={{color: 'red'}}>API Error: {data.apiTest.error}</p>}
      </div>

      {/* Diagnosis Summary */}
      <div style={{marginTop: '30px', padding: '20px', border: '3px solid #6f42c1', backgroundColor: '#f8f6ff'}}>
        <h2>🎯 DIAGNOSIS SUMMARY</h2>
        
        {data.productStats?.withPrices > 100 ? (
          <div>
            <p style={{color: 'green', fontSize: '16px', fontWeight: 'bold'}}>
              ✅ DATABASE HAS {data.productStats.withPrices} PRODUCTS WITH REAL PRICES
            </p>
            <p>The database contains real pricing data. If dashboard still shows 5000, the issue is:</p>
            <ul>
              <li>🔄 <strong>Browser cache:</strong> Try Ctrl+F5 or incognito mode</li>
              <li>🌐 <strong>CDN cache:</strong> Netlify may be serving old version</li>
              <li>⚙️ <strong>API cache:</strong> Internal caching returning old data</li>
            </ul>
          </div>
        ) : (
          <div>
            <p style={{color: 'red', fontSize: '16px', fontWeight: 'bold'}}>
              ❌ DATABASE HAS ONLY {data.productStats?.withPrices || 0} PRODUCTS WITH PRICES
            </p>
            <p>This suggests:</p>
            <ul>
              <li>🗄️ <strong>Different database:</strong> Production uses different Supabase instance</li>
              <li>📡 <strong>Environment variables:</strong> Wrong database credentials in production</li>
              <li>🔄 <strong>Sync issue:</strong> Price updates not reaching production database</li>
            </ul>
          </div>
        )}

        <div style={{marginTop: '20px', padding: '10px', backgroundColor: '#fff3cd', border: '1px solid #ffeaa7'}}>
          <strong>🔧 NEXT STEPS:</strong>
          <ol>
            <li>Check if this page shows many products with prices</li>
            <li>If YES: Clear browser/CDN cache issue</li>
            <li>If NO: Production database environment issue</li>
          </ol>
        </div>
      </div>
    </div>
  );
}