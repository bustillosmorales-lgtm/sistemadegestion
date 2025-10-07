// pages/clear-cache-page.js
import { useState } from 'react';
import Head from 'next/head';

export default function ClearCachePage() {
  const [status, setStatus] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  const handleClearCache = async () => {
    const confirmMessage = '🔄 ¿Estás seguro de que deseas refrescar el sistema?\n\n' +
                          'Esto limpiará TODOS los caches y recalculará desde cero.';

    if (!confirm(confirmMessage)) {
      return;
    }

    setIsClearing(true);
    setStatus('⏳ Limpiando caches y regenerando...');
    console.log('🔄 Iniciando refresh completo del sistema...');

    try {
      const response = await fetch('/api/refresh-system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('📡 Respuesta:', { status: response.status, ok: response.ok });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Error del servidor:', errorData);
        throw new Error(errorData.details || errorData.error || 'Error al limpiar cache');
      }

      const result = await response.json();
      console.log('✅ Sistema refrescado:', result);

      const statusMsg = `✅ Sistema refrescado exitosamente\n\n` +
                       `Dashboard Cache: ${result.cleared?.dashboardCache || 0} eliminados\n` +
                       `SKU Cache: ${result.cleared?.skuCache || 0} eliminados\n` +
                       `Vista Materializada: ${result.cleared?.materializedView || 0} eliminados\n\n` +
                       `${result.note || ''}`;
      setStatus(statusMsg);

      // Esperar 3 segundos y hacer HARD REFRESH del dashboard
      setTimeout(() => {
        window.location.href = '/dashboard?t=' + Date.now(); // Add timestamp to force refresh
      }, 3000);

    } catch (error) {
      console.error('❌ Error:', error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <>
      <Head>
        <title>Limpiar Cache</title>
      </Head>

      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6 text-center">🔄 Refrescar Sistema</h1>

          <div className="mb-6 text-gray-700 text-sm space-y-2">
            <p>Esta acción:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Limpiará TODOS los caches del sistema</li>
              <li>Recalculará venta diaria desde ventas reales</li>
              <li>Actualizará estados de todos los productos</li>
            </ul>
            <p className="font-semibold text-blue-700 mt-3">Úsalo después de depurar ventas/compras</p>
          </div>

          <button
            onClick={handleClearCache}
            disabled={isClearing}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
              isClearing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isClearing ? '⏳ Refrescando...' : '🔄 Refrescar Sistema'}
          </button>

          {status && (
            <div className={`mt-6 p-4 rounded-lg text-sm whitespace-pre-wrap ${
              status.includes('Error')
                ? 'bg-red-50 text-red-800 border border-red-200'
                : status.includes('Limpiando')
                ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                : 'bg-green-50 text-green-800 border border-green-200'
            }`}>
              {status}
            </div>
          )}

          <div className="mt-6 text-center">
            <a
              href="/dashboard"
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              ← Volver al Dashboard
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
