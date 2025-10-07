// pages/test-downloads.js
import { useState } from 'react';
import Head from 'next/head';

export default function TestDownloads() {
  const [status, setStatus] = useState('');
  const [logs, setLogs] = useState([]);

  const log = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry);
    setLogs(prev => [...prev, logEntry]);
  };

  const testDownload = async (endpoint, label) => {
    log(`🔄 Iniciando descarga de: ${label}`);
    setStatus('⏳ Descargando...');

    const startTime = Date.now();

    try {
      log(`📡 Haciendo fetch a: ${endpoint}`);
      const response = await fetch(endpoint);

      log(`📡 Respuesta recibida: ${response.status} ${response.statusText}`);
      log(`📋 Content-Type: ${response.headers.get('content-type')}`);
      log(`📋 Content-Disposition: ${response.headers.get('content-disposition')}`);

      if (!response.ok) {
        const errorText = await response.text();
        log(`❌ Error del servidor: ${errorText.substring(0, 200)}`);
        throw new Error(`Error ${response.status}: ${response.statusText}\n${errorText.substring(0, 200)}`);
      }

      const blob = await response.blob();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      log(`✅ Blob generado: ${(blob.size / 1024).toFixed(2)} KB`);
      log(`⏱️ Tiempo total: ${elapsed}s`);

      // Extraer nombre del archivo de Content-Disposition
      const disposition = response.headers.get('content-disposition');
      let filename = 'download.xlsx';
      if (disposition && disposition.includes('filename=')) {
        const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Descargar el archivo
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      log(`✅ Descarga completada: ${filename}`);
      setStatus(`✅ Descarga completada: ${filename} (${(blob.size / 1024).toFixed(2)} KB en ${elapsed}s)`);
    } catch (error) {
      log(`❌ Error: ${error.message}`);
      setStatus(`❌ Error: ${error.message}`);
    }
  };

  return (
    <>
      <Head>
        <title>Test de Descargas</title>
      </Head>

      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">🧪 Test de APIs de Descarga</h1>
          <p className="text-gray-600 mb-8">Esta página prueba las APIs de descarga del sistema</p>

          {/* Bases de Datos */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Bases de Datos</h2>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => testDownload('/api/export-ventas', 'Ventas')}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                📊 Descargar Ventas
              </button>
              <button
                onClick={() => testDownload('/api/export-compras', 'Compras')}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                🛒 Descargar Compras
              </button>
              <button
                onClick={() => testDownload('/api/export-contenedores', 'Contenedores')}
                className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700"
              >
                🚢 Descargar Contenedores
              </button>
            </div>
          </div>

          {/* Estados de Productos */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Estados de Productos</h2>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => testDownload('/api/export-by-status?status=NEEDS_REPLENISHMENT&action=request_quote', 'Necesita Reposición')}
                className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
              >
                📥 Necesita Reposición
              </button>
              <button
                onClick={() => testDownload('/api/export-by-status?status=QUOTE_REQUESTED&action=quote', 'Cotizar')}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
              >
                📋 Cotizar
              </button>
              <button
                onClick={() => testDownload('/api/export-by-status?status=QUOTED&action=analyze', 'Analizar')}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
              >
                🔍 Analizar
              </button>
              <button
                onClick={() => testDownload('/api/export-by-status?status=NO_REPLENISHMENT_NEEDED&action=view', 'Stock Saludable')}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                📄 Stock Saludable
              </button>
            </div>
          </div>

          {/* Status */}
          {status && (
            <div className={`p-4 rounded-lg mb-6 ${
              status.includes('Error') ? 'bg-red-50 text-red-800 border border-red-200' :
              status.includes('Descargando') ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' :
              'bg-green-50 text-green-800 border border-green-200'
            }`}>
              {status}
            </div>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <div className="bg-gray-900 text-green-400 rounded-lg p-4 overflow-x-auto">
              <h3 className="text-lg font-bold mb-2">📋 Logs:</h3>
              <pre className="text-sm font-mono whitespace-pre-wrap">
                {logs.join('\n')}
              </pre>
            </div>
          )}

          {/* Instrucciones */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-bold text-blue-900 mb-2">ℹ️ Instrucciones:</h3>
            <ul className="text-blue-800 text-sm space-y-1">
              <li>• Abre la consola del navegador (F12) para ver más detalles</li>
              <li>• Haz clic en cualquier botón para probar la descarga</li>
              <li>• Los logs aparecerán tanto aquí como en la consola</li>
              <li>• Si hay un error, copia el mensaje completo de la consola</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
