// pages/api-config.js - Interfaz de configuración de APIs externas
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { AdminProtection } from '../lib/adminAuth';
import SyncConfigPanel from '../components/SyncConfigPanel';

export default function APIConfig() {
    const router = useRouter();
    const [configs, setConfigs] = useState({
        mercadolibre: { configured: false, loading: true },
        defontana: { configured: false, loading: true }
    });
    const [defontanaForm, setDefontanaForm] = useState({
        apiKey: '',
        baseURL: 'https://www.defontana.com/api'
    });
    const [syncStatus, setSyncStatus] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        checkConfigurations();
        getSyncStatus();
        
        // Manejar mensajes de URL (callbacks)
        const { success, error } = router.query;
        if (success === 'mercadolibre_configured') {
            showNotification('✅ MercadoLibre configurado exitosamente', 'success');
        } else if (error) {
            showNotification(`❌ Error: ${error.replace(/_/g, ' ')}`, 'error');
        }
    }, [router.query]);

    const checkConfigurations = async () => {
        try {
            // Verificar MercadoLibre
            const mlResponse = await fetch('/api/auth/mercadolibre');
            const mlConfig = await mlResponse.json();
            
            // Verificar Defontana
            const dfResponse = await fetch('/api/auth/defontana');
            const dfConfig = await dfResponse.json();
            
            setConfigs({
                mercadolibre: { ...mlConfig, loading: false },
                defontana: { ...dfConfig, loading: false }
            });
            
        } catch (error) {
            console.error('Error verificando configuraciones:', error);
            setConfigs({
                mercadolibre: { configured: false, loading: false },
                defontana: { configured: false, loading: false }
            });
        }
    };

    const getSyncStatus = async () => {
        try {
            const response = await fetch('/api/sync/inventory');
            const data = await response.json();
            setSyncStatus(data.stats);
        } catch (error) {
            console.error('Error obteniendo estado de sincronización:', error);
        }
    };

    const connectMercadoLibre = () => {
        window.location.href = '/api/auth/mercadolibre?action=authorize';
    };

    const disconnectMercadoLibre = async () => {
        if (!confirm('¿Estás seguro de desconectar MercadoLibre?')) return;
        
        try {
            const response = await fetch('/api/auth/mercadolibre', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'disconnect' })
            });
            
            if (response.ok) {
                showNotification('MercadoLibre desconectado', 'success');
                checkConfigurations();
            }
        } catch (error) {
            showNotification('Error desconectando MercadoLibre', 'error');
        }
    };

    const configureDefontana = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        
        try {
            const response = await fetch('/api/auth/defontana', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'configure',
                    apiKey: defontanaForm.apiKey,
                    baseURL: defontanaForm.baseURL
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showNotification('✅ Defontana configurado exitosamente', 'success');
                setDefontanaForm({ apiKey: '', baseURL: 'https://www.defontana.com/api' });
                checkConfigurations();
            } else {
                showNotification(`❌ ${result.error}`, 'error');
            }
        } catch (error) {
            showNotification('Error configurando Defontana', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const disconnectDefontana = async () => {
        if (!confirm('¿Estás seguro de desconectar Defontana?')) return;
        
        try {
            const response = await fetch('/api/auth/defontana', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'disconnect' })
            });
            
            if (response.ok) {
                showNotification('Defontana desconectado', 'success');
                checkConfigurations();
            }
        } catch (error) {
            showNotification('Error desconectando Defontana', 'error');
        }
    };

    const syncInventory = async (platform) => {
        if (!confirm(`¿Sincronizar todo el inventario con ${platform}? Esto puede tomar varios minutos.`)) return;
        
        setIsLoading(true);
        try {
            const response = await fetch('/api/sync/inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'sync_all',
                    platform: platform
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showNotification(`✅ Inventario sincronizado con ${platform}: ${result.results.success} productos actualizados`, 'success');
                getSyncStatus();
            } else {
                showNotification(`❌ Error sincronizando con ${platform}`, 'error');
            }
        } catch (error) {
            showNotification('Error en sincronización', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const syncSales = async (platform) => {
        if (!confirm(`¿Importar ventas recientes desde ${platform}?`)) return;
        
        setIsLoading(true);
        try {
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - 7); // Últimos 7 días
            
            const response = await fetch('/api/sync/sales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'sync_orders',
                    platform: platform,
                    from_date: fromDate.toISOString(),
                    to_date: new Date().toISOString()
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showNotification(`✅ Ventas sincronizadas: ${result.results.success} órdenes importadas`, 'success');
            } else {
                showNotification(`❌ Error sincronizando ventas`, 'error');
            }
        } catch (error) {
            showNotification('Error en sincronización de ventas', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const showNotification = (message, type) => {
        // Crear notificación temporal
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg z-50 ${
            type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 5000);
    };

    return (
        <AdminProtection>
            <Head>
                <title>Configuración APIs - Sistema de Gestión</title>
            </Head>
            
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900">Configuración de APIs</h1>
                        <p className="mt-2 text-gray-600">
                            Conecta tu sistema con MercadoLibre y Defontana para sincronizar inventario y ventas automáticamente.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* MercadoLibre */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex items-center mb-4">
                                <div className="w-12 h-12 bg-yellow-400 rounded-lg flex items-center justify-center">
                                    <span className="text-2xl">🛒</span>
                                </div>
                                <div className="ml-4">
                                    <h2 className="text-xl font-semibold text-gray-900">MercadoLibre</h2>
                                    <p className="text-sm text-gray-500">Marketplace líder en América Latina</p>
                                </div>
                                <div className="ml-auto">
                                    {configs.mercadolibre.loading ? (
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-400"></div>
                                    ) : (
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            configs.mercadolibre.configured 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-red-100 text-red-800'
                                        }`}>
                                            {configs.mercadolibre.configured ? 'Conectado' : 'Desconectado'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {configs.mercadolibre.configured ? (
                                <div className="space-y-4">
                                    <div className="bg-green-50 p-4 rounded-lg">
                                        <p className="text-sm text-green-700">
                                            ✅ Conectado como: <strong>{configs.mercadolibre.nickname}</strong>
                                        </p>
                                        <p className="text-xs text-green-600 mt-1">
                                            Configurado el: {new Date(configs.mercadolibre.configuredAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    
                                    <div className="flex flex-col space-y-2">
                                        <button
                                            onClick={() => syncInventory('mercadolibre')}
                                            disabled={isLoading}
                                            className="btn btn-blue"
                                        >
                                            {isLoading ? 'Sincronizando...' : '🔄 Sincronizar Inventario'}
                                        </button>
                                        <button
                                            onClick={() => syncSales('mercadolibre')}
                                            disabled={isLoading}
                                            className="btn btn-green"
                                        >
                                            📥 Importar Ventas (7 días)
                                        </button>
                                        <button
                                            onClick={disconnectMercadoLibre}
                                            className="btn btn-red"
                                        >
                                            🔌 Desconectar
                                        </button>
                                    </div>
                                    
                                    {syncStatus?.mercadolibre && (
                                        <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
                                            <p>📊 Productos mapeados: <strong>{syncStatus.mercadolibre.mapped_products}</strong></p>
                                            <p>⏰ Última sincronización: {
                                                syncStatus.mercadolibre.last_sync 
                                                    ? new Date(syncStatus.mercadolibre.last_sync).toLocaleString()
                                                    : 'Nunca'
                                            }</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-sm text-gray-600">
                                        Conecta tu cuenta de MercadoLibre para sincronizar productos y órdenes automáticamente.
                                    </p>
                                    <button
                                        onClick={connectMercadoLibre}
                                        className="w-full btn btn-yellow"
                                    >
                                        🔗 Conectar con MercadoLibre
                                    </button>
                                    
                                    <div className="text-xs text-gray-500 space-y-1">
                                        <p><strong>Funcionalidades:</strong></p>
                                        <ul className="list-disc list-inside space-y-1">
                                            <li>Sincronización automática de stock</li>
                                            <li>Importación de órdenes y ventas</li>
                                            <li>Actualización de precios</li>
                                            <li>Pausar/activar publicaciones</li>
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Defontana */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex items-center mb-4">
                                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                                    <span className="text-2xl text-white">📊</span>
                                </div>
                                <div className="ml-4">
                                    <h2 className="text-xl font-semibold text-gray-900">Defontana</h2>
                                    <p className="text-sm text-gray-500">Sistema de gestión empresarial</p>
                                </div>
                                <div className="ml-auto">
                                    {configs.defontana.loading ? (
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                    ) : (
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            configs.defontana.configured 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-red-100 text-red-800'
                                        }`}>
                                            {configs.defontana.configured ? 'Conectado' : 'Desconectado'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {configs.defontana.configured ? (
                                <div className="space-y-4">
                                    <div className="bg-green-50 p-4 rounded-lg">
                                        <p className="text-sm text-green-700">
                                            ✅ API configurada correctamente
                                        </p>
                                        <p className="text-xs text-green-600 mt-1">
                                            Configurado el: {new Date(configs.defontana.configuredAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    
                                    <div className="flex flex-col space-y-2">
                                        <button
                                            onClick={() => syncInventory('defontana')}
                                            disabled={isLoading}
                                            className="btn btn-blue"
                                        >
                                            {isLoading ? 'Sincronizando...' : '🔄 Sincronizar con Defontana'}
                                        </button>
                                        <button
                                            onClick={disconnectDefontana}
                                            className="btn btn-red"
                                        >
                                            🔌 Desconectar
                                        </button>
                                    </div>
                                    
                                    {syncStatus?.defontana && (
                                        <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
                                            <p>📊 Productos mapeados: <strong>{syncStatus.defontana.mapped_products}</strong></p>
                                            <p>⏰ Última sincronización: {
                                                syncStatus.defontana.last_sync 
                                                    ? new Date(syncStatus.defontana.last_sync).toLocaleString()
                                                    : 'Nunca'
                                            }</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-sm text-gray-600">
                                        Configura tu API Key de Defontana para crear facturas automáticamente.
                                    </p>
                                    
                                    <form onSubmit={configureDefontana} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                API Key
                                            </label>
                                            <input
                                                type="password"
                                                value={defontanaForm.apiKey}
                                                onChange={(e) => setDefontanaForm({...defontanaForm, apiKey: e.target.value})}
                                                className="input"
                                                placeholder="Tu API Key de Defontana"
                                                required
                                            />
                                        </div>
                                        
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Base URL (opcional)
                                            </label>
                                            <input
                                                type="url"
                                                value={defontanaForm.baseURL}
                                                onChange={(e) => setDefontanaForm({...defontanaForm, baseURL: e.target.value})}
                                                className="input"
                                                placeholder="https://www.defontana.com/api"
                                            />
                                        </div>
                                        
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="w-full btn btn-blue"
                                        >
                                            {isLoading ? 'Configurando...' : '🔗 Configurar Defontana'}
                                        </button>
                                    </form>
                                    
                                    <div className="text-xs text-gray-500 space-y-1">
                                        <p><strong>Funcionalidades:</strong></p>
                                        <ul className="list-disc list-inside space-y-1">
                                            <li>Creación automática de facturas</li>
                                            <li>Sincronización de productos</li>
                                            <li>Exportación de datos contables</li>
                                            <li>Reportes financieros</li>
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Panel de Configuración de Sincronización */}
                    <div className="mt-8">
                        <SyncConfigPanel onConfigChange={(config) => console.log('Config updated:', config)} />
                    </div>

                    {/* Panel de Estado General */}
                    <div className="mt-8 bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Estado General de Sincronización</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">
                                    {(syncStatus?.mercadolibre?.mapped_products || 0) + (syncStatus?.defontana?.mapped_products || 0)}
                                </div>
                                <div className="text-sm text-gray-600">Productos Mapeados</div>
                            </div>
                            
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">
                                    {configs.mercadolibre.configured && configs.defontana.configured ? '100%' : 
                                     (configs.mercadolibre.configured || configs.defontana.configured ? '50%' : '0%')}
                                </div>
                                <div className="text-sm text-gray-600">APIs Configuradas</div>
                            </div>
                            
                            <div className="text-center">
                                <div className="text-2xl font-bold text-yellow-600">
                                    {(syncStatus?.mercadolibre?.needs_sync || 0) + (syncStatus?.defontana?.needs_sync || 0)}
                                </div>
                                <div className="text-sm text-gray-600">Necesitan Sincronización</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .btn {
                    @apply px-4 py-2 rounded-lg font-medium text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed;
                }
                .btn-blue {
                    @apply bg-blue-600 text-white hover:bg-blue-700;
                }
                .btn-green {
                    @apply bg-green-600 text-white hover:bg-green-700;
                }
                .btn-yellow {
                    @apply bg-yellow-400 text-gray-900 hover:bg-yellow-500;
                }
                .btn-red {
                    @apply bg-red-600 text-white hover:bg-red-700;
                }
                .input {
                    @apply w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
                }
            `}</style>
        </AdminProtection>
    );
}