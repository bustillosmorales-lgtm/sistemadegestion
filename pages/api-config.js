// pages/api-config.js - Interfaz de configuración de APIs externas
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import SyncConfigPanel from '../components/SyncConfigPanel';
import { useUser } from '../components/UserContext';
import { useSimpleAdminCheck } from '../lib/simpleAdminAuth';

export default function APIConfig() {
    const router = useRouter();
    const { user, isAuthenticated } = useUser();
    const isAdmin = useSimpleAdminCheck();
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

    // Helper para requests con datos de usuario
    const fetchWithUser = async (url, options = {}) => {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        if (options.method === 'POST' || options.method === 'PUT') {
            const body = options.body ? JSON.parse(options.body) : {};
            body.user = user; // Incluir datos de usuario
            defaultOptions.body = JSON.stringify(body);
        }

        return fetch(url, { ...options, ...defaultOptions });
    };

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
        console.log('🔍 Verificando configuraciones...');
        
        let mlConfig = { configured: false };
        let dfConfig = { configured: false };
        
        try {
            // Verificar MercadoLibre
            console.log('🔍 Consultando MercadoLibre status...');
            const mlResponse = await fetch('/api/mercadolibre/status/');
            if (mlResponse.ok) {
                const mlData = await mlResponse.json();
                console.log('✅ MercadoLibre response:', mlData);
                mlConfig = {
                    configured: mlData.connected === true,
                    nickname: mlData.user?.nickname || 'N/A',
                    configuredAt: mlData.connection?.last_updated || new Date().toISOString(),
                    loading: false
                };
            } else {
                console.error('❌ MercadoLibre status error:', mlResponse.status, mlResponse.statusText);
                mlConfig = { configured: false, loading: false };
            }
        } catch (error) {
            console.error('❌ Error verificando MercadoLibre:', error);
            mlConfig = { configured: false, loading: false };
        }
        
        try {
            // Verificar Defontana
            console.log('🔍 Consultando Defontana status...');
            const dfResponse = await fetch('/api/auth/defontana/');
            if (dfResponse.ok) {
                const dfData = await dfResponse.json();
                console.log('✅ Defontana response:', dfData);
                dfConfig = { ...dfData, loading: false };
            } else {
                console.error('❌ Defontana status error:', dfResponse.status, dfResponse.statusText);
                dfConfig = { configured: false, loading: false };
            }
        } catch (error) {
            console.error('❌ Error verificando Defontana:', error);
            dfConfig = { configured: false, loading: false };
        }
        
        console.log('🎯 Configuración final:', { mercadolibre: mlConfig, defontana: dfConfig });
        
        setConfigs({
            mercadolibre: mlConfig,
            defontana: dfConfig
        });
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
        window.location.href = '/api/mercadolibre/auth?redirect=true';
    };

    const disconnectMercadoLibre = async () => {
        if (!confirm('¿Estás seguro de desconectar MercadoLibre?')) return;
        
        try {
            const response = await fetchWithUser('/api/auth/mercadolibre', {
                method: 'POST',
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
            const response = await fetchWithUser('/api/auth/defontana', {
                method: 'POST',
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
            const response = await fetchWithUser('/api/auth/defontana', {
                method: 'POST',
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
            const response = await fetchWithUser('/api/sync/inventory', {
                method: 'POST',
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
            
            const response = await fetchWithUser('/api/sync/sales', {
                method: 'POST',
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

    const testMercadoLibreConnection = async () => {
        try {
            const response = await fetch('/api/test/mercadolibre');
            const diagnostic = await response.json();
            
            console.log('🔍 MercadoLibre Diagnostic:', diagnostic);
            
            // Crear modal con diagnóstico
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
            modal.innerHTML = `
                <div class="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-auto p-6">
                    <h2 class="text-xl font-bold mb-4">🔍 Diagnóstico MercadoLibre</h2>
                    <div class="space-y-4">
                        <div>
                            <h3 class="font-semibold">Variables de Entorno:</h3>
                            <pre class="bg-gray-100 p-2 rounded text-sm">${JSON.stringify(diagnostic.environment_variables, null, 2)}</pre>
                        </div>
                        <div>
                            <h3 class="font-semibold">Configuración BD:</h3>
                            <pre class="bg-gray-100 p-2 rounded text-sm">${JSON.stringify(diagnostic.database_config, null, 2)}</pre>
                        </div>
                        <div>
                            <h3 class="font-semibold">Pruebas API:</h3>
                            <pre class="bg-gray-100 p-2 rounded text-sm">${JSON.stringify(diagnostic.api_tests, null, 2)}</pre>
                        </div>
                        <div>
                            <h3 class="font-semibold">Diagnósticos:</h3>
                            ${diagnostic.diagnostics.map(d => `
                                <div class="p-2 rounded ${d.type === 'error' ? 'bg-red-100' : d.type === 'warning' ? 'bg-yellow-100' : 'bg-green-100'}">
                                    <strong>${d.message}</strong><br>
                                    <small>${d.solution}</small>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <button onclick="this.parentElement.parentElement.remove()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded">Cerrar</button>
                </div>
            `;
            
            document.body.appendChild(modal);
            
        } catch (error) {
            showNotification('Error ejecutando diagnóstico: ' + error.message, 'error');
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

    // Verificar autenticación y permisos admin
    if (!isAuthenticated || !user) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">🔐</span>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        Autenticación Requerida
                    </h2>
                    <p className="text-gray-600 mb-6">
                        Debes iniciar sesión para acceder a la configuración de APIs.
                    </p>
                    <button
                        onClick={() => router.push('/login')}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                        Iniciar Sesión
                    </button>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">🔒</span>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        Acceso Denegado
                    </h2>
                    <p className="text-gray-600 mb-6">
                        Solo los administradores pueden acceder a la configuración de APIs.
                    </p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                        Volver al Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <Head>
                <title>Configuración APIs - Sistema de Gestión</title>
            </Head>
            
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="mb-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Configuración de APIs</h1>
                                <p className="mt-2 text-gray-600">
                                    Conecta tu sistema con MercadoLibre y Defontana para sincronizar inventario y ventas automáticamente.
                                </p>
                            </div>
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2"
                            >
                                ← Volver al Dashboard
                            </button>
                        </div>
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
                                            onClick={() => testMercadoLibreConnection()}
                                            className="btn btn-purple"
                                        >
                                            🔍 Diagnosticar Conexión
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
                .btn-purple {
                    @apply bg-purple-600 text-white hover:bg-purple-700;
                }
                .input {
                    @apply w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
                }
            `}</style>
        </>
    );
}