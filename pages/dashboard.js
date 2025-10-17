// pages/dashboard-v3.js - Dashboard ligero basado en Excel
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import useSWR from 'swr';
import { useUser } from '../components/UserContext';
import Link from 'next/link';

const fetcher = (url) => fetch(url).then((res) => res.json());

// Configuración de status y acciones
const allStatuses = {
  NO_REPLENISHMENT_NEEDED: {
    label: 'Sin Reposición Programada',
    description: 'Stock saludable según análisis automático',
    allowedRoles: ['chile', 'china', 'admin'],
    color: 'gray',
    needsAttention: false,
    actions: [
      {
        label: '⚡ Forzar Solicitud de Cotización',
        endpoint: '/api/export-by-status?status=NO_REPLENISHMENT_NEEDED&action=force_request_quote',
        filename: 'Forzar_Cotizaciones.xlsx',
        allowedRoles: ['chile', 'admin'],
        description: 'Solicitar cotización aunque el sistema indique que no es necesario'
      },
      {
        label: '📄 Ver Productos',
        endpoint: '/api/export-by-status?status=NO_REPLENISHMENT_NEEDED&action=view',
        filename: 'Stock_Saludable.xlsx',
        allowedRoles: ['chile', 'china', 'admin']
      }
    ]
  },

  NEEDS_REPLENISHMENT: {
    label: 'Necesita Reposición',
    description: 'Stock bajo, requiere cotización',
    allowedRoles: ['chile', 'admin'],
    color: 'yellow',
    needsAttention: true,
    actions: [
      {
        label: '📥 Descargar para Solicitar Cotizaciones',
        endpoint: '/api/export-by-status?status=NEEDS_REPLENISHMENT&action=request_quote',
        filename: 'Solicitar_Cotizaciones.xlsx',
        allowedRoles: ['chile', 'admin']
      }
    ]
  },

  QUOTE_REQUESTED: {
    label: 'Cotización Solicitada',
    description: 'Esperando cotización de proveedor',
    allowedRoles: ['china', 'admin'],
    color: 'blue',
    needsAttention: true,
    actions: [
      {
        label: '📥 Descargar para Cotizar',
        endpoint: '/api/export-by-status?status=QUOTE_REQUESTED&action=quote',
        filename: 'Productos_a_Cotizar.xlsx',
        allowedRoles: ['china', 'admin']
      }
    ]
  },

  QUOTED: {
    label: 'Cotizado',
    description: 'Cotización recibida, requiere análisis',
    allowedRoles: ['chile', 'admin'],
    color: 'cyan',
    needsAttention: true,
    actions: [
      {
        label: '📥 Descargar para Analizar',
        endpoint: '/api/export-by-status?status=QUOTED&action=analyze',
        filename: 'Analizar_Cotizaciones.xlsx',
        allowedRoles: ['chile', 'admin']
      }
    ]
  },

  QUOTED_PRICE_MODIFIED: {
    label: 'Cotizado con Precio Modificado',
    description: 'Precio modificado, requiere re-análisis',
    allowedRoles: ['chile', 'admin'],
    color: 'orange',
    needsAttention: true,
    actions: [
      {
        label: '📥 Descargar para Re-Analizar',
        endpoint: '/api/export-by-status?status=QUOTED_PRICE_MODIFIED&action=analyze',
        filename: 'ReAnalizar_Cotizaciones.xlsx',
        allowedRoles: ['chile', 'admin']
      }
    ]
  },

  ANALYZING: {
    label: 'En Análisis',
    description: 'Análisis de rentabilidad en curso',
    allowedRoles: ['chile', 'admin'],
    color: 'purple',
    needsAttention: true,
    actions: [
      {
        label: '📥 Descargar para Aprobar Compra',
        endpoint: '/api/export-by-status?status=ANALYZING&action=approve',
        filename: 'Aprobar_Compras.xlsx',
        allowedRoles: ['chile', 'admin']
      }
    ]
  },

  PURCHASE_APPROVED: {
    label: 'Compra Aprobada',
    description: 'Aprobada por Chile, esperando confirmación',
    allowedRoles: ['china', 'admin'],
    color: 'green',
    needsAttention: true,
    actions: [
      {
        label: '📥 Descargar para Confirmar Compra',
        endpoint: '/api/export-by-status?status=PURCHASE_APPROVED&action=confirm_purchase',
        filename: 'Confirmar_Compras.xlsx',
        allowedRoles: ['china', 'admin']
      }
    ]
  },

  PURCHASE_CONFIRMED: {
    label: 'Compra Confirmada',
    description: 'Orden de compra enviada, en producción',
    allowedRoles: ['china', 'admin'],
    color: 'green',
    needsAttention: false,
    actions: [
      {
        label: '📥 Descargar para Confirmar Fabricación',
        endpoint: '/api/export-by-status?status=PURCHASE_CONFIRMED&action=confirm_manufacturing',
        filename: 'Confirmar_Fabricacion.xlsx',
        allowedRoles: ['china', 'admin']
      },
      {
        label: '📄 Ver Compras en Producción',
        endpoint: '/api/export-by-status?status=PURCHASE_CONFIRMED&action=view',
        filename: 'Compras_en_Produccion.xlsx',
        allowedRoles: ['china', 'admin']
      }
    ]
  },

  MANUFACTURED: {
    label: 'Fabricado',
    description: 'Producto fabricado, listo para envío',
    allowedRoles: ['china', 'admin'],
    color: 'indigo',
    needsAttention: true,
    actions: [
      {
        label: '📥 Descargar para Confirmar Envío',
        endpoint: '/api/export-by-status?status=MANUFACTURED&action=confirm_shipping',
        filename: 'Confirmar_Envios.xlsx',
        allowedRoles: ['china', 'admin']
      }
    ]
  },

  SHIPPED: {
    label: 'Enviado',
    description: 'En tránsito marítimo',
    allowedRoles: ['chile', 'china', 'admin'],
    color: 'gray',
    needsAttention: false,
    actions: [
      {
        label: '📄 Ver Productos Enviados',
        endpoint: '/api/export-by-status?status=SHIPPED&action=view',
        filename: 'Productos_Enviados.xlsx',
        allowedRoles: ['chile', 'china', 'admin']
      },
      {
        label: '📥 Marcar como Recibido',
        endpoint: '/api/export-by-status?status=SHIPPED&action=mark_received',
        filename: 'Marcar_Recibidos.xlsx',
        allowedRoles: ['chile', 'admin']
      }
    ]
  },

  QUOTE_REJECTED: {
    label: 'Cotización Rechazada',
    description: 'Cotización no aceptada, requiere acción',
    allowedRoles: ['china', 'admin'],
    color: 'red',
    needsAttention: true,
    actions: [
      {
        label: '📄 Ver Rechazadas',
        endpoint: '/api/export-by-status?status=QUOTE_REJECTED&action=view',
        filename: 'Cotizaciones_Rechazadas.xlsx',
        allowedRoles: ['china', 'admin']
      }
    ]
  }
};

export default function DashboardV3() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useUser();
  const { data: statsResponse, error, mutate } = useSWR('/api/dashboard-stats', fetcher, {
    refreshInterval: 30000 // Actualizar cada 30 segundos
  });

  const stats = statsResponse?.stats;

  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [downloadingStatus, setDownloadingStatus] = useState(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);
  const fileInputRef = useRef(null);

  // Forzar refresh del cache al cargar el dashboard
  useEffect(() => {
    async function refreshCache() {
      if (!isAuthenticated || isRefreshingCache) return;

      setIsRefreshingCache(true);
      try {
        console.log('🔄 Refrescando cache de análisis...');
        const response = await fetch('/api/analysis-cached?nocache=true');
        const data = await response.json();
        console.log('✅ Cache refrescado:', data.metadata);

        // Después de refrescar el cache, recargar las estadísticas
        mutate();
      } catch (error) {
        console.error('❌ Error refrescando cache:', error);
      } finally {
        setIsRefreshingCache(false);
      }
    }

    refreshCache();
  }, [isAuthenticated]); // Solo ejecutar cuando cambia isAuthenticated

  // Redireccionar si no está autenticado
  if (!isLoading && !isAuthenticated) {
    router.push('/');
    return null;
  }

  if (isLoading || !stats || isRefreshingCache) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isRefreshingCache ? 'Actualizando análisis de productos...' : 'Cargando dashboard...'}
          </p>
          {isRefreshingCache && (
            <p className="text-sm text-gray-500 mt-2">Esto puede tomar 1-2 minutos</p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-600">
          <p className="text-xl font-bold mb-2">Error al cargar el dashboard</p>
          <p>{error.message}</p>
          <button
            onClick={() => mutate()}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Filtrar status según rol
  const visibleStatuses = Object.entries(allStatuses)
    .filter(([_, config]) => config.allowedRoles.includes(user.role))
    .filter(([status, _]) => (stats.statusBreakdown?.[status] || 0) > 0);

  // Agrupar por categorías
  const needsAttentionStatuses = visibleStatuses.filter(([_, config]) => config.needsAttention);
  const inProgressStatuses = visibleStatuses.filter(([status, _]) =>
    ['PURCHASE_CONFIRMED', 'MANUFACTURED', 'SHIPPED'].includes(status)
  );
  const completedStatuses = visibleStatuses.filter(([status, _]) =>
    status === 'NO_REPLENISHMENT_NEEDED'
  );
  const rejectedStatuses = visibleStatuses.filter(([status, _]) =>
    status === 'QUOTE_REJECTED'
  );

  const needsAttentionCount = needsAttentionStatuses.reduce(
    (sum, [status]) => sum + (stats.statusBreakdown?.[status] || 0),
    0
  );

  // Función para descargar Excel
  const downloadExcel = async (endpoint, filename) => {
    console.log('📥 Iniciando descarga:', { endpoint, filename });

    try {
      console.log('🔄 Realizando petición fetch a:', endpoint);
      const response = await fetch(endpoint);

      console.log('📡 Respuesta recibida:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type')
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error del servidor:', errorText);
        throw new Error(`Error ${response.status}: ${response.statusText}\n${errorText.substring(0, 200)}`);
      }

      console.log('✅ Generando blob...');
      const blob = await response.blob();
      console.log('📦 Blob generado:', { size: blob.size, type: blob.type });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('✅ Descarga completada:', filename);
    } catch (error) {
      console.error('❌ Error completo en downloadExcel:', error);
      alert('Error descargando el archivo:\n\n' + error.message + '\n\nRevisa la consola (F12) para más detalles.');
    }
  };

  // Función para descargar Recordatorios y Desconsiderados
  const handleExport = async (status, action) => {
    setDownloadingStatus(status);
    try {
      const endpoint = `/api/export-by-status?status=${status}&action=${action}`;
      const filename = status === 'REMINDERS' ?
        `Recordatorios_${new Date().toISOString().split('T')[0]}.xlsx` :
        `Desconsiderados_${new Date().toISOString().split('T')[0]}.xlsx`;

      await downloadExcel(endpoint, filename);
    } finally {
      setDownloadingStatus(null);
    }
  };

  // Función para descargar bases de datos
  const handleDownloadDatabase = async (dbType) => {
    console.log('💾 Descargando base de datos:', dbType);
    setShowDownloadMenu(false);
    setDownloadingStatus(dbType); // Mostrar indicador de carga

    try {
      const endpoints = {
        ventas: '/api/export-ventas',
        compras: '/api/export-compras',
        contenedores: '/api/export-contenedores'
      };

      const endpoint = endpoints[dbType];
      const filename = `${dbType}_${new Date().toISOString().split('T')[0]}.xlsx`;

      console.log('📥 Llamando a downloadExcel con:', { endpoint, filename });
      await downloadExcel(endpoint, filename);
    } catch (error) {
      console.error('❌ Error en handleDownloadDatabase:', error);
      alert('Error descargando base de datos:\n\n' + error.message + '\n\nRevisa la consola (F12) para más detalles.');
    } finally {
      setDownloadingStatus(null); // Ocultar indicador de carga
    }
  };

  // Función para subir Excel (VERSIÓN ASÍNCRONA - Netlify Free compatible)
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // 1. Iniciar job asíncrono
      console.log('📤 Subiendo archivo y creando job...');
      const response = await fetch('/api/import-by-action-async', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al subir el archivo');
      }

      const jobId = result.job_id;
      console.log(`✅ Job creado: ${jobId}`);

      // 2. Mostrar mensaje de procesamiento
      setUploadResult({
        success: true,
        message: 'Procesando archivo en segundo plano...',
        status: 'processing',
        job_id: jobId,
        progress: 0
      });

      // 3. Polling para verificar estado (cada 3 segundos)
      let pollCount = 0;
      const maxPolls = 200; // Máximo 10 minutos (200 * 3s)

      const checkStatus = async () => {
        try {
          pollCount++;

          const statusResponse = await fetch(`/api/job-status?job_id=${jobId}`);
          const statusData = await statusResponse.json();

          console.log(`🔍 Poll ${pollCount}: ${statusData.status} (${statusData.progress}%)`);

          // Actualizar resultado con progreso
          setUploadResult({
            success: true,
            message: `Procesando... ${statusData.progress}%`,
            status: statusData.status,
            job_id: jobId,
            progress: statusData.progress,
            processed_items: statusData.processed_items,
            total_items: statusData.total_items,
            elapsed_seconds: statusData.elapsed_seconds,
            estimated_remaining_seconds: statusData.estimated_remaining_seconds
          });

          if (statusData.status === 'completed') {
            // Job completado exitosamente
            console.log('✅ Job completado:', statusData.results);

            setUploadResult({
              success: true,
              message: '¡Importación completada exitosamente!',
              status: 'completed',
              job_id: jobId,
              progress: 100,
              ...statusData.results
            });

            // Refrescar stats después de completar
            mutate();

            setIsUploading(false);
            clearInterval(pollInterval);

          } else if (statusData.status === 'failed') {
            // Job falló
            console.error('❌ Job falló:', statusData.error_message);

            setUploadResult({
              success: false,
              message: 'Error en la importación',
              status: 'failed',
              error: statusData.error_message
            });

            setIsUploading(false);
            clearInterval(pollInterval);

          } else if (pollCount >= maxPolls) {
            // Timeout
            console.warn('⚠️  Timeout esperando job');

            setUploadResult({
              success: false,
              message: 'Timeout: El procesamiento está tomando demasiado tiempo',
              status: 'timeout',
              job_id: jobId
            });

            setIsUploading(false);
            clearInterval(pollInterval);
          }

        } catch (error) {
          console.error('❌ Error verificando estado:', error);
          // Continuar polling en caso de error temporal
        }
      };

      // Iniciar polling cada 3 segundos
      const pollInterval = setInterval(checkStatus, 3000);

      // Primera verificación inmediata
      checkStatus();

    } catch (error) {
      console.error('❌ Error:', error);
      alert('Error al importar: ' + error.message);
      setIsUploading(false);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <Head>
        <title>Dashboard - Sistema de Gestión</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* HEADER */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard de Gestión</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Usuario: <span className="font-semibold">{user.name}</span> |
                  Rol: <span className="font-semibold uppercase">{user.role}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {user.role === 'admin' && (
                  <Link href="/users">
                    <button className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm" title="Gestión de Usuarios">
                      👥 Usuarios
                    </button>
                  </Link>
                )}
                <Link href="/config">
                  <button className="bg-gray-600 text-white px-3 py-2 rounded hover:bg-gray-700 text-sm" title="Configuración del Sistema">
                    ⚙️ Config
                  </button>
                </Link>
                <Link href="/bulk-upload">
                  <button className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm" title="Cargar Datos Masivos">
                    📤 Cargar
                  </button>
                </Link>
                <Link href="/contenedores">
                  <button className="bg-teal-600 text-white px-3 py-2 rounded hover:bg-teal-700 text-sm" title="Gestión de Contenedores">
                    🚢 Contened.
                  </button>
                </Link>
                <Link href="/profile">
                  <button className="bg-indigo-600 text-white px-3 py-2 rounded hover:bg-indigo-700 text-sm" title="Mi Cuenta">
                    👤 Cuenta
                  </button>
                </Link>
                <div className="relative">
                  <button
                    onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                    className="bg-purple-600 text-white px-3 py-2 rounded hover:bg-purple-700 text-sm" title="Descargar Bases de Datos"
                  >
                    💾 Descarga
                  </button>
                  {showDownloadMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 border border-gray-200">
                      <div className="py-1">
                        <button
                          onClick={() => handleDownloadDatabase('ventas')}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          📊 Base de Ventas
                        </button>
                        <button
                          onClick={() => handleDownloadDatabase('compras')}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          🛒 Base de Compras
                        </button>
                        <button
                          onClick={() => handleDownloadDatabase('contenedores')}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          🚢 Base de Contenedores
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={logout}
                  className="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm" title="Cerrar Sesión"
                >
                  🚪 Salir
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-8 py-8">
          {/* RESUMEN GENERAL */}
          <div className="grid grid-cols-6 gap-4 mb-8">
            <StatCard
              title="Total SKUs"
              value={stats.summary?.totalProducts || 0}
              icon="📦"
              color="blue"
            />
            <StatCard
              title="Requieren tu Atención"
              value={needsAttentionCount}
              icon="⚠️"
              color="red"
              highlight={needsAttentionCount > 0}
            />
            <StatCard
              title="En Proceso"
              value={stats.summary?.activeWorkflow || 0}
              icon="🔄"
              color="yellow"
            />
            <StatCard
              title="Órdenes Activas"
              value={stats.summary?.activeOrders || 0}
              icon="📋"
              color="orange"
              highlight={(stats.summary?.activeOrders || 0) > 0}
            />
            <StatCard
              title="En Tránsito"
              value={stats.summary?.inTransit || 0}
              icon="🚢"
              color="purple"
            />
            <StatCard
              title="Otros SKU"
              value={stats.summary?.noActionNeeded || 0}
              icon="✅"
              color="green"
            />
          </div>

          {/* RESUMEN DETALLADO DE TODOS LOS STATUS */}
          <div className="mb-8 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg shadow-lg p-6 border-2 border-gray-300">
            <h2 className="text-2xl font-bold mb-4 flex items-center">
              <span className="mr-2">📊</span>
              Resumen por Status
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Necesita Reposición</div>
                <div className="text-2xl font-bold text-yellow-700">{stats.statusBreakdown?.NEEDS_REPLENISHMENT || 0}</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Cotización Solicitada</div>
                <div className="text-2xl font-bold text-blue-700">{stats.statusBreakdown?.QUOTE_REQUESTED || 0}</div>
              </div>
              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Cotizado</div>
                <div className="text-2xl font-bold text-cyan-700">{stats.statusBreakdown?.QUOTED || 0}</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Precio Modificado</div>
                <div className="text-2xl font-bold text-orange-700">{stats.statusBreakdown?.QUOTED_PRICE_MODIFIED || 0}</div>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Analizando</div>
                <div className="text-2xl font-bold text-indigo-700">{stats.statusBreakdown?.ANALYZING || 0}</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Compra Aprobada</div>
                <div className="text-2xl font-bold text-purple-700">{stats.statusBreakdown?.PURCHASE_APPROVED || 0}</div>
              </div>
              <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Compra Confirmada</div>
                <div className="text-2xl font-bold text-pink-700">{stats.statusBreakdown?.PURCHASE_CONFIRMED || 0}</div>
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Fabricado</div>
                <div className="text-2xl font-bold text-teal-700">{stats.statusBreakdown?.MANUFACTURED || 0}</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Enviado</div>
                <div className="text-2xl font-bold text-emerald-700">{stats.statusBreakdown?.SHIPPED || 0}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Sin Reposición</div>
                <div className="text-2xl font-bold text-green-700">{stats.statusBreakdown?.NO_REPLENISHMENT_NEEDED || 0}</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Rechazado</div>
                <div className="text-2xl font-bold text-red-700">{stats.statusBreakdown?.QUOTE_REJECTED || 0}</div>
              </div>
              {stats.summary?.reminders > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">⏰ Recordatorios</div>
                  <div className="text-2xl font-bold text-blue-700">{stats.summary.reminders}</div>
                </div>
              )}
              {stats.summary?.disregarded > 0 && (
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">🚫 Desconsiderados</div>
                  <div className="text-2xl font-bold text-gray-700">{stats.summary.disregarded}</div>
                </div>
              )}
              {stats.summary?.activeOrders > 0 && (
                <div className="bg-orange-50 border border-orange-300 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">📋 Con Órdenes Activas</div>
                  <div className="text-2xl font-bold text-orange-700">{stats.summary.activeOrders}</div>
                </div>
              )}
            </div>
          </div>

          {/* ALERTA DE ÓRDENES ACTIVAS */}
          {stats.summary?.activeOrders > 0 && (
            <div className="mb-8 p-6 bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-300 rounded-lg shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2 flex items-center text-orange-800">
                    <span className="mr-2">📋</span>
                    Productos con Órdenes de Compra Activas
                  </h3>
                  <p className="text-gray-700 text-sm mb-3">
                    Hay <strong>{stats.summary.activeOrders}</strong> productos con órdenes de compra en proceso.
                    Estos productos pueden aparecer en múltiples estados del flujo simultáneamente.
                  </p>
                  {stats.activeOrdersProducts && stats.activeOrdersProducts.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-600 mb-2">Ejemplos de productos con órdenes activas:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {stats.activeOrdersProducts.slice(0, 6).map(product => (
                          <div key={product.sku} className="bg-white border border-orange-200 rounded p-2 text-xs">
                            <div className="font-semibold text-orange-800">{product.sku}</div>
                            <div className="text-gray-600 truncate">{product.descripcion}</div>
                            <div className="text-orange-600 mt-1">
                              En proceso: <strong>{product.totalEnProceso || 0}</strong> unidades
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* BOTÓN DE IMPORTAR (destacado arriba) */}
          <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-1 flex items-center">
                  <span className="mr-2">📤</span>
                  Importar Actualizaciones
                </h3>
                <p className="text-gray-700 text-sm">
                  Después de completar cualquier Excel descargado, súbelo aquí para actualizar el sistema.
                </p>
              </div>
              <div className="ml-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className={`cursor-pointer inline-flex items-center px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
                    isUploading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isUploading ? '⏳ Procesando...' : '📤 Seleccionar Archivo'}
                </label>
              </div>
            </div>

            {/* Resultado de la importación (con progreso asíncrono) */}
            {uploadResult && (
              <div className={`mt-4 p-4 rounded-lg ${
                uploadResult.status === 'completed' ? 'bg-green-50 border border-green-200' :
                uploadResult.status === 'failed' || uploadResult.status === 'timeout' ? 'bg-red-50 border border-red-200' :
                'bg-blue-50 border border-blue-200'
              }`}>
                {/* Header con status */}
                <div className="flex items-center justify-between mb-3">
                  <p className={`font-semibold text-lg ${
                    uploadResult.status === 'completed' ? 'text-green-800' :
                    uploadResult.status === 'failed' || uploadResult.status === 'timeout' ? 'text-red-800' :
                    'text-blue-800'
                  }`}>
                    {uploadResult.status === 'completed' && '✅ '}
                    {uploadResult.status === 'failed' && '❌ '}
                    {uploadResult.status === 'timeout' && '⏱️ '}
                    {(uploadResult.status === 'processing' || uploadResult.status === 'queued') && '⏳ '}
                    {uploadResult.message}
                  </p>

                  {uploadResult.job_id && (
                    <span className="text-xs text-gray-500 font-mono">
                      Job: {uploadResult.job_id.substring(0, 8)}...
                    </span>
                  )}
                </div>

                {/* Barra de progreso */}
                {(uploadResult.status === 'processing' || uploadResult.status === 'queued') && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-sm text-blue-700 mb-1">
                      <span>Progreso: {uploadResult.progress || 0}%</span>
                      {uploadResult.processed_items !== undefined && uploadResult.total_items && (
                        <span>{uploadResult.processed_items} / {uploadResult.total_items} items</span>
                      )}
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${uploadResult.progress || 0}%` }}
                      ></div>
                    </div>
                    {uploadResult.elapsed_seconds !== undefined && (
                      <div className="flex items-center justify-between text-xs text-blue-600 mt-1">
                        <span>⏱️ Transcurrido: {uploadResult.elapsed_seconds}s</span>
                        {uploadResult.estimated_remaining_seconds !== undefined && uploadResult.estimated_remaining_seconds > 0 && (
                          <span>⏳ Restante: ~{uploadResult.estimated_remaining_seconds}s</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Resultados finales */}
                {uploadResult.status === 'completed' && uploadResult.success !== undefined && (
                  <div className="mt-2">
                    <p className="text-green-800 font-medium">
                      ✅ Total: {uploadResult.total} |
                      Exitosos: {uploadResult.success} |
                      {uploadResult.errors > 0 && ` Errores: ${uploadResult.errors}`}
                    </p>

                    {uploadResult.details && uploadResult.errors > 0 && (
                      <details className="mt-2 text-sm text-red-700">
                        <summary className="cursor-pointer font-semibold hover:text-red-800">
                          Ver {uploadResult.errors} errores
                        </summary>
                        <ul className="mt-2 list-disc list-inside max-h-48 overflow-y-auto bg-white p-2 rounded">
                          {uploadResult.details
                            .filter(d => !d.success)
                            .map((d, i) => (
                              <li key={i} className="py-1">
                                <span className="font-mono">{d.sku}</span>: {d.error || d.reason}
                              </li>
                            ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}

                {/* Error message */}
                {(uploadResult.status === 'failed' || uploadResult.status === 'timeout') && uploadResult.error && (
                  <p className="text-red-700 text-sm mt-2">
                    Error: {uploadResult.error}
                  </p>
                )}

                {/* Spinner animado para processing */}
                {(uploadResult.status === 'processing' || uploadResult.status === 'queued') && (
                  <div className="flex items-center gap-2 text-blue-600 text-sm mt-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Procesando en segundo plano... No cierres esta ventana.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECCIÓN: REQUIEREN ATENCIÓN */}
          {needsAttentionStatuses.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4 flex items-center">
                <span className="text-red-500 mr-2">⚠️</span>
                Requieren tu Atención ({needsAttentionCount})
              </h2>
              <div className="space-y-4">
                {needsAttentionStatuses.map(([status, config]) => (
                  <StatusActionCard
                    key={status}
                    status={status}
                    config={config}
                    count={stats.statusBreakdown?.[status] || 0}
                    examples={stats.examples?.[status] || []}
                    user={user}
                    onDownload={downloadExcel}
                  />
                ))}
              </div>
            </div>
          )}

          {/* SECCIÓN: EN PROCESO */}
          {inProgressStatuses.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4 flex items-center">
                <span className="mr-2">🔄</span>
                En Proceso ({inProgressStatuses.reduce((sum, [s]) => sum + (stats.statusBreakdown?.[s] || 0), 0)})
              </h2>
              <div className="space-y-4">
                {inProgressStatuses.map(([status, config]) => (
                  <StatusActionCard
                    key={status}
                    status={status}
                    config={config}
                    count={stats.statusBreakdown?.[status] || 0}
                    examples={stats.examples?.[status] || []}
                    user={user}
                    onDownload={downloadExcel}
                  />
                ))}
              </div>
            </div>
          )}

          {/* SECCIÓN: RECHAZADOS */}
          {rejectedStatuses.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4 flex items-center">
                <span className="text-red-600 mr-2">❌</span>
                Rechazados ({rejectedStatuses.reduce((sum, [s]) => sum + (stats.statusBreakdown?.[s] || 0), 0)})
              </h2>
              <div className="space-y-4">
                {rejectedStatuses.map(([status, config]) => (
                  <StatusActionCard
                    key={status}
                    status={status}
                    config={config}
                    count={stats.statusBreakdown?.[status] || 0}
                    examples={stats.examples?.[status] || []}
                    user={user}
                    onDownload={downloadExcel}
                  />
                ))}
              </div>
            </div>
          )}

          {/* SECCIÓN: COMPLETADOS */}
          {completedStatuses.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4 flex items-center">
                <span className="text-green-600 mr-2">✅</span>
                Otros SKU ({completedStatuses.reduce((sum, [s]) => sum + (stats.statusBreakdown?.[s] || 0), 0)})
              </h2>
              <div className="space-y-4">
                {completedStatuses.map(([status, config]) => (
                  <StatusActionCard
                    key={status}
                    status={status}
                    config={config}
                    count={stats.statusBreakdown?.[status] || 0}
                    examples={stats.examples?.[status] || []}
                    user={user}
                    onDownload={downloadExcel}
                  />
                ))}
              </div>
            </div>
          )}

          {/* SECCIÓN: RECORDATORIOS */}
          {stats.summary?.reminders > 0 && (
            <div className="mb-8">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg shadow-lg p-6 border-2 border-blue-300">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold mb-2 flex items-center">
                      <span className="text-blue-600 mr-2">⏰</span>
                      Recordatorios ({stats.summary.reminders})
                    </h2>
                    <p className="text-sm text-blue-900 mb-2">
                      Productos configurados para revisar en una fecha futura.
                    </p>
                  </div>
                  <button
                    onClick={() => handleExport('REMINDERS', 'view')}
                    disabled={downloadingStatus === 'REMINDERS'}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
                  >
                    {downloadingStatus === 'REMINDERS' ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        <span>Descargando...</span>
                      </>
                    ) : (
                      <>
                        <span>📥</span>
                        <span>Descargar Excel</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Tabla de recordatorios */}
                {stats.reminderProducts && stats.reminderProducts.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-300 rounded-lg">
                      <thead className="bg-blue-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-blue-900 border-b">SKU</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-blue-900 border-b">Descripción</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-blue-900 border-b">Fecha Recordatorio</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-blue-900 border-b">Comentarios</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.reminderProducts.slice(0, 20).map((product, index) => (
                          <tr key={`reminder-${index}-${product.sku}`} className={index % 2 === 0 ? 'bg-blue-50' : 'bg-white'}>
                            <td className="px-4 py-2 text-sm text-gray-900 border-b font-mono">{product.sku}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 border-b">{product.descripcion}</td>
                            <td className="px-4 py-2 text-sm text-blue-700 border-b font-semibold">{product.remind_me_date}</td>
                            <td className="px-4 py-2 text-sm text-gray-600 border-b italic">{product.remind_me_comments || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {stats.reminderProducts.length > 20 && (
                      <p className="text-xs text-blue-700 mt-2 text-center">
                        Mostrando 20 de {stats.reminderProducts.length} productos. Descarga el Excel para ver todos.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECCIÓN: DESCONSIDERADOS */}
          {stats.summary?.disregarded > 0 && (
            <div className="mb-8">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg shadow-lg p-6 border-2 border-gray-300">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold mb-2 flex items-center">
                      <span className="text-gray-600 mr-2">🚫</span>
                      Productos Desconsiderados ({stats.summary.disregarded})
                    </h2>
                    <p className="text-sm text-gray-900 mb-2">
                      Productos marcados como desconsiderados. NO aparecen en "Necesita Reposición".
                    </p>
                  </div>
                  <button
                    onClick={() => handleExport('DISREGARDED', 'view')}
                    disabled={downloadingStatus === 'DISREGARDED'}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
                  >
                    {downloadingStatus === 'DISREGARDED' ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        <span>Descargando...</span>
                      </>
                    ) : (
                      <>
                        <span>📥</span>
                        <span>Descargar Excel</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Tabla de productos desconsiderados */}
                {stats.disregardedProducts && stats.disregardedProducts.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-300 rounded-lg">
                      <thead className="bg-gray-200">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border-b">SKU</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border-b">Descripción</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border-b">Stock Actual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.disregardedProducts.slice(0, 20).map((product, index) => (
                          <tr key={`disregarded-${index}-${product.sku}`} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="px-4 py-2 text-sm text-gray-900 border-b font-mono">{product.sku}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 border-b">{product.descripcion}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 border-b text-center">{product.stock_actual || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {stats.disregardedProducts.length > 20 && (
                      <p className="text-xs text-gray-600 mt-2 text-center">
                        Mostrando 20 de {stats.disregardedProducts.length} productos. Descarga el Excel para ver todos.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Componente: Tarjeta de estadística
function StatCard({ title, value, icon, color, highlight }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    green: 'bg-green-50 border-green-200 text-green-900',
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${colors[color]} ${highlight ? 'ring-2 ring-red-400 animate-pulse' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <div className="text-4xl opacity-50">{icon}</div>
      </div>
    </div>
  );
}

// Componente: Tarjeta de acción por status
function StatusActionCard({ status, config, count, examples, user, onDownload }) {
  const colorClasses = {
    gray: 'bg-gray-50 border-gray-300',
    yellow: 'bg-yellow-50 border-yellow-300',
    blue: 'bg-blue-50 border-blue-300',
    cyan: 'bg-cyan-50 border-cyan-300',
    orange: 'bg-orange-50 border-orange-300',
    purple: 'bg-purple-50 border-purple-300',
    green: 'bg-green-50 border-green-300',
    indigo: 'bg-indigo-50 border-indigo-300',
    red: 'bg-red-50 border-red-300',
  };

  const buttonColorClasses = {
    gray: 'bg-gray-600 hover:bg-gray-700',
    yellow: 'bg-yellow-600 hover:bg-yellow-700',
    blue: 'bg-blue-600 hover:bg-blue-700',
    cyan: 'bg-cyan-600 hover:bg-cyan-700',
    orange: 'bg-orange-600 hover:bg-orange-700',
    purple: 'bg-purple-600 hover:bg-purple-700',
    green: 'bg-green-600 hover:bg-green-700',
    indigo: 'bg-indigo-600 hover:bg-indigo-700',
    red: 'bg-red-600 hover:bg-red-700',
  };

  // Filtrar acciones según rol del usuario
  const visibleActions = config.actions.filter(action =>
    !action.allowedRoles || action.allowedRoles.includes(user.role)
  );

  return (
    <div className={`p-6 rounded-lg border-2 ${colorClasses[config.color]}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-800">{config.label}</h3>
          <p className="text-sm text-gray-600">{config.description}</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">{count} productos</p>
        </div>
        <div className={`text-4xl font-bold opacity-40`}>
          {count}
        </div>
      </div>

      {/* Ejemplos */}
      {examples && examples.length > 0 && (
        <div className="mb-4 text-sm text-gray-700 bg-white p-3 rounded border border-gray-200">
          <p className="font-semibold mb-1">📦 Ejemplos:</p>
          <ul className="list-disc list-inside space-y-1">
            {examples.slice(0, 3).map(ex => (
              <li key={ex.sku} className="truncate">
                <span className="font-mono text-xs">{ex.sku}</span> - {ex.descripcion?.substring(0, 50)}...
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex gap-2 flex-wrap">
        {visibleActions.map((action, idx) => (
          <button
            key={idx}
            onClick={() => onDownload(action.endpoint, action.filename)}
            className={`flex-1 min-w-[200px] ${buttonColorClasses[config.color]} text-white px-4 py-3 rounded-lg font-semibold transition-colors`}
            title={action.description}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
