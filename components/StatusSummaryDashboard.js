// components/StatusSummaryDashboard.js - Vista de resumen rápida por status
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const StatusSummaryDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dashboard-stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
        setError(null);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const statusConfig = {
    'NEEDS_REPLENISHMENT': { 
      text: 'Necesita Reposición', 
      color: 'bg-yellow-500', 
      textColor: 'text-yellow-900',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      icon: '📋'
    },
    'QUOTE_REQUESTED': { 
      text: 'Cotización Solicitada', 
      color: 'bg-blue-500',
      textColor: 'text-blue-900',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      icon: '💭'
    },
    'QUOTED': { 
      text: 'Cotizado', 
      color: 'bg-cyan-500',
      textColor: 'text-cyan-900', 
      bgColor: 'bg-cyan-50',
      borderColor: 'border-cyan-200',
      icon: '💰'
    },
    'QUOTED_PRICE_MODIFIED': { 
      text: 'Precio Modificado', 
      color: 'bg-orange-500',
      textColor: 'text-orange-900',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      icon: '🔧'
    },
    'ANALYZING': { 
      text: 'En Análisis', 
      color: 'bg-purple-500',
      textColor: 'text-purple-900',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      icon: '🔍'
    },
    'PURCHASE_APPROVED': { 
      text: 'Compra Aprobada', 
      color: 'bg-green-500',
      textColor: 'text-green-900',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      icon: '✅'
    },
    'PURCHASE_CONFIRMED': { 
      text: 'Compra Confirmada', 
      color: 'bg-green-600',
      textColor: 'text-green-900',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      icon: '📄'
    },
    'MANUFACTURED': { 
      text: 'Fabricado', 
      color: 'bg-indigo-500',
      textColor: 'text-indigo-900',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      icon: '🏭'
    },
    'SHIPPED': { 
      text: 'Enviado', 
      color: 'bg-gray-700',
      textColor: 'text-gray-900',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      icon: '🚢'
    },
    'NO_REPLENISHMENT_NEEDED': { 
      text: 'Sin Reposición', 
      color: 'bg-gray-400',
      textColor: 'text-gray-900',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      icon: '✓'
    },
    'QUOTE_REJECTED': { 
      text: 'Cotización Rechazada', 
      color: 'bg-red-700',
      textColor: 'text-red-900',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      icon: '❌'
    }
  };

  const navigateToStatus = (status) => {
    // Navegar al dashboard filtrado por status
    router.push(`/dashboard?status=${status}`);
  };

  const navigateToFullDashboard = () => {
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">❌</div>
          <p className="text-red-600">Error: {error}</p>
          <button 
            onClick={loadStats}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard por Status</h1>
            <p className="text-gray-600 mt-1">Vista rápida del estado de todos los productos</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={navigateToFullDashboard}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              📋 Dashboard Completo
            </button>
            <button
              onClick={loadStats}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              🔄 Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* Resumen General */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100">
              <span className="text-2xl">📊</span>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Productos</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.summary?.totalProducts || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100">
              <span className="text-2xl">⚡</span>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">En Proceso</p>
              <p className="text-2xl font-bold text-yellow-600">{stats?.summary?.activeWorkflow || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-orange-100">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Requiere Atención</p>
              <p className="text-2xl font-bold text-orange-600">{stats?.summary?.needsAttention || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100">
              <span className="text-2xl">🚢</span>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">En Tránsito</p>
              <p className="text-2xl font-bold text-green-600">{stats?.summary?.inTransit || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Object.entries(stats?.statusBreakdown || {}).map(([status, count]) => {
          const config = statusConfig[status];
          if (!config || count === 0) return null;

          const examples = stats?.examples?.[status] || [];
          
          return (
            <div 
              key={status}
              className={`${config.bgColor} ${config.borderColor} border-2 rounded-lg p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105`}
              onClick={() => navigateToStatus(status)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{config.icon}</span>
                  <div>
                    <h3 className={`font-semibold ${config.textColor}`}>
                      {config.text}
                    </h3>
                    <p className="text-2xl font-bold text-gray-900">{count}</p>
                  </div>
                </div>
              </div>
              
              {examples.length > 0 && (
                <div className="mt-4 space-y-1">
                  <p className="text-xs text-gray-600 font-medium">Ejemplos:</p>
                  {examples.slice(0, 2).map((example, idx) => (
                    <p key={idx} className="text-xs text-gray-700 truncate">
                      • {example.sku} - {example.descripcion?.substring(0, 25)}...
                    </p>
                  ))}
                  {count > 2 && (
                    <p className="text-xs text-gray-500 italic">
                      +{count - 2} más...
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="mt-8 text-center text-gray-500 text-sm">
        <p>Haz click en cualquier tarjeta para ver los productos de ese status</p>
        <p className="mt-1">🚀 Carga ultra-rápida • Sin timeouts • Navegación intuitiva</p>
      </div>
    </div>
  );
};

export default StatusSummaryDashboard;