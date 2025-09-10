// components/SyncConfigPanel.js - Panel de configuración granular de sincronización
import { useState, useEffect } from 'react';

export default function SyncConfigPanel({ onConfigChange }) {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadSyncConfig();
    }, []);

    const loadSyncConfig = async () => {
        try {
            const response = await fetch('/api/sync/config');
            const data = await response.json();
            
            if (data.success) {
                setConfig(data.config);
            }
        } catch (error) {
            console.error('Error cargando configuración de sync:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateConfig = (section, key, value) => {
        const newConfig = {
            ...config,
            [section]: {
                ...config[section],
                [key]: value
            }
        };
        setConfig(newConfig);
    };

    const updateSyncSettings = (platform, key, value) => {
        const newConfig = {
            ...config,
            [platform]: {
                ...config[platform],
                sync_settings: {
                    ...config[platform].sync_settings,
                    [key]: value
                }
            }
        };
        setConfig(newConfig);
    };

    const saveConfig = async () => {
        setSaving(true);
        try {
            const response = await fetch('/api/sync/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config })
            });

            const result = await response.json();
            
            if (result.success) {
                showNotification('✅ Configuración guardada exitosamente', 'success');
                if (onConfigChange) onConfigChange(config);
            } else {
                showNotification('❌ Error guardando configuración', 'error');
            }
        } catch (error) {
            console.error('Error guardando configuración:', error);
            showNotification('❌ Error guardando configuración', 'error');
        } finally {
            setSaving(false);
        }
    };

    const showNotification = (message, type) => {
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

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                    <div className="space-y-3">
                        <div className="h-4 bg-gray-200 rounded"></div>
                        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!config) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="text-center text-gray-500">
                    Error cargando configuración de sincronización
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Configuración de Sincronización</h3>
                <button
                    onClick={saveConfig}
                    disabled={saving}
                    className="btn btn-blue"
                >
                    {saving ? 'Guardando...' : '💾 Guardar Configuración'}
                </button>
            </div>

            <div className="space-y-8">
                {/* Configuración Global */}
                <div className="border-b pb-6">
                    <h4 className="text-md font-medium text-gray-900 mb-4">🌐 Configuración Global</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Modo de Carga de Datos
                            </label>
                            <select
                                value={config.global_settings?.bulk_upload_mode || 'coexist'}
                                onChange={(e) => updateConfig('global_settings', 'bulk_upload_mode', e.target.value)}
                                className="input"
                            >
                                <option value="coexist">🤝 Coexisten (Carga masiva + API)</option>
                                <option value="api_only">🔄 Solo API (Bloquear carga masiva)</option>
                                <option value="bulk_only">📁 Solo carga masiva (Sin API)</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                                Define si permitir carga masiva cuando la API está activa
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Frecuencia de Sincronización
                            </label>
                            <select
                                value={config.global_settings?.sync_frequency || 'manual'}
                                onChange={(e) => updateConfig('global_settings', 'sync_frequency', e.target.value)}
                                className="input"
                            >
                                <option value="manual">🖱️ Manual</option>
                                <option value="hourly">⏰ Cada hora</option>
                                <option value="daily">📅 Diario</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Resolución de Conflictos
                            </label>
                            <select
                                value={config.global_settings?.conflict_resolution || 'api_priority'}
                                onChange={(e) => updateConfig('global_settings', 'conflict_resolution', e.target.value)}
                                className="input"
                            >
                                <option value="api_priority">🔄 Prioridad API</option>
                                <option value="manual_review">👁️ Revisión manual</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Máximo de Errores de Sync
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={config.global_settings?.max_sync_errors || 10}
                                onChange={(e) => updateConfig('global_settings', 'max_sync_errors', parseInt(e.target.value))}
                                className="input"
                            />
                        </div>
                    </div>
                </div>

                {/* Configuración MercadoLibre */}
                {config.mercadolibre?.available && (
                    <div className="border-b pb-6">
                        <div className="flex items-center mb-4">
                            <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center mr-3">
                                <span className="text-lg">🛒</span>
                            </div>
                            <h4 className="text-md font-medium text-gray-900">MercadoLibre</h4>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="ml-enabled"
                                    checked={config.mercadolibre?.enabled || false}
                                    onChange={(e) => updateConfig('mercadolibre', 'enabled', e.target.checked)}
                                    className="h-4 w-4 text-blue-600"
                                />
                                <label htmlFor="ml-enabled" className="ml-2 text-sm font-medium text-gray-700">
                                    Habilitar sincronización con MercadoLibre
                                </label>
                            </div>

                            {config.mercadolibre?.enabled && (
                                <div className="ml-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={config.mercadolibre?.sync_settings?.update_stock || false}
                                                    onChange={(e) => updateSyncSettings('mercadolibre', 'update_stock', e.target.checked)}
                                                    className="h-4 w-4 text-blue-600"
                                                />
                                                <span className="ml-2 text-sm text-gray-700">📦 Actualizar stock</span>
                                            </label>
                                        </div>

                                        <div>
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={config.mercadolibre?.sync_settings?.update_prices || false}
                                                    onChange={(e) => updateSyncSettings('mercadolibre', 'update_prices', e.target.checked)}
                                                    className="h-4 w-4 text-blue-600"
                                                />
                                                <span className="ml-2 text-sm text-gray-700">💰 Actualizar precios</span>
                                            </label>
                                        </div>

                                        <div>
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={config.mercadolibre?.sync_settings?.import_new_orders || false}
                                                    onChange={(e) => updateSyncSettings('mercadolibre', 'import_new_orders', e.target.checked)}
                                                    className="h-4 w-4 text-blue-600"
                                                />
                                                <span className="ml-2 text-sm text-gray-700">📥 Importar órdenes nuevas</span>
                                            </label>
                                        </div>

                                        <div>
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={config.mercadolibre?.sync_settings?.create_products || false}
                                                    onChange={(e) => updateSyncSettings('mercadolibre', 'create_products', e.target.checked)}
                                                    className="h-4 w-4 text-blue-600"
                                                />
                                                <span className="ml-2 text-sm text-gray-700">➕ Crear productos automáticamente</span>
                                            </label>
                                        </div>

                                        <div>
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={config.mercadolibre?.sync_settings?.pause_out_of_stock || false}
                                                    onChange={(e) => updateSyncSettings('mercadolibre', 'pause_out_of_stock', e.target.checked)}
                                                    className="h-4 w-4 text-blue-600"
                                                />
                                                <span className="ml-2 text-sm text-gray-700">⏸️ Pausar sin stock</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Intervalo de sincronización automática (minutos)
                                        </label>
                                        <input
                                            type="number"
                                            min="5"
                                            max="1440"
                                            value={config.mercadolibre?.auto_sync_interval || 60}
                                            onChange={(e) => updateConfig('mercadolibre', 'auto_sync_interval', parseInt(e.target.value))}
                                            className="input w-32"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Solo aplica si frecuencia global no es manual
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Configuración Defontana */}
                {config.defontana?.available && (
                    <div>
                        <div className="flex items-center mb-4">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                                <span className="text-lg text-white">📊</span>
                            </div>
                            <h4 className="text-md font-medium text-gray-900">Defontana</h4>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="df-enabled"
                                    checked={config.defontana?.enabled || false}
                                    onChange={(e) => updateConfig('defontana', 'enabled', e.target.checked)}
                                    className="h-4 w-4 text-blue-600"
                                />
                                <label htmlFor="df-enabled" className="ml-2 text-sm font-medium text-gray-700">
                                    Habilitar sincronización con Defontana
                                </label>
                            </div>

                            {config.defontana?.enabled && (
                                <div className="ml-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={config.defontana?.sync_settings?.auto_create_invoices || false}
                                                    onChange={(e) => updateSyncSettings('defontana', 'auto_create_invoices', e.target.checked)}
                                                    className="h-4 w-4 text-blue-600"
                                                />
                                                <span className="ml-2 text-sm text-gray-700">🧾 Crear facturas automáticamente</span>
                                            </label>
                                        </div>

                                        <div>
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={config.defontana?.sync_settings?.sync_customers || false}
                                                    onChange={(e) => updateSyncSettings('defontana', 'sync_customers', e.target.checked)}
                                                    className="h-4 w-4 text-blue-600"
                                                />
                                                <span className="ml-2 text-sm text-gray-700">👥 Sincronizar clientes</span>
                                            </label>
                                        </div>

                                        <div>
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={config.defontana?.sync_settings?.update_product_costs || false}
                                                    onChange={(e) => updateSyncSettings('defontana', 'update_product_costs', e.target.checked)}
                                                    className="h-4 w-4 text-blue-600"
                                                />
                                                <span className="ml-2 text-sm text-gray-700">💲 Actualizar costos de productos</span>
                                            </label>
                                        </div>

                                        <div>
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={config.defontana?.sync_settings?.export_accounting_data || false}
                                                    onChange={(e) => updateSyncSettings('defontana', 'export_accounting_data', e.target.checked)}
                                                    className="h-4 w-4 text-blue-600"
                                                />
                                                <span className="ml-2 text-sm text-gray-700">📋 Exportar datos contables</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Warning sobre APIs no configuradas */}
                {(!config.mercadolibre?.available && !config.defontana?.available) && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <span className="text-yellow-400 text-lg">⚠️</span>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-yellow-800">
                                    No hay APIs configuradas
                                </h3>
                                <div className="mt-2 text-sm text-yellow-700">
                                    <p>
                                        Configura al menos una API (MercadoLibre o Defontana) para poder gestionar 
                                        las opciones de sincronización.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                .btn {
                    @apply px-4 py-2 rounded-lg font-medium text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed;
                }
                .btn-blue {
                    @apply bg-blue-600 text-white hover:bg-blue-700;
                }
                .input {
                    @apply w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
                }
            `}</style>
        </div>
    );
}