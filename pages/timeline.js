import { useState, useEffect, useMemo } from 'react';
import { useUser } from '../components/UserContext';
import { useRouter } from 'next/router';
import Link from 'next/link';
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then((res) => res.json());

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
};

const getDaysFromNow = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const StatusBadge = ({ status, className = "" }) => {
    const statusConfig = {
        'NEEDS_REPLENISHMENT': { text: 'Reponer', color: 'bg-red-500' },
        'QUOTE_REQUESTED': { text: 'Cotizar', color: 'bg-orange-500' },
        'PURCHASE_APPROVED': { text: 'Comprar', color: 'bg-yellow-500' },
        'PURCHASE_CONFIRMED': { text: 'Fabricando', color: 'bg-blue-500' },
        'MANUFACTURED': { text: 'Manufactured', color: 'bg-purple-500' },
        'SHIPPED': { text: 'En Tránsito', color: 'bg-green-500' },
        'NO_REPLENISHMENT_NEEDED': { text: 'OK', color: 'bg-gray-400' }
    };
    const config = statusConfig[status] || { text: status, color: 'bg-gray-400' };
    return (
        <span className={`text-xs font-bold text-white px-2 py-1 rounded-full ${config.color} ${className}`}>
            {config.text}
        </span>
    );
};

const TimelineVisualization = ({ timelineData, stockMaximo }) => {
    const maxDays = 120; // 4 meses
    const today = new Date();
    
    // Crear array de días para los próximos 4 meses
    const days = Array.from({ length: maxDays }, (_, i) => {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        return {
            date,
            dayNumber: i,
            dateStr: date.toISOString().split('T')[0],
            stock: 0,
            events: [],
            ventaPerdida: 0 // Nueva propiedad para venta perdida
        };
    });

    // Calcular stock día a día y venta perdida
    let currentStock = timelineData.stock_actual || 0;
    const ventaDiaria = timelineData.venta_diaria || 0;
    const precioPromedio = timelineData.precio_promedio || 0;
    
    days.forEach((day, index) => {
        // Aplicar llegadas de contenedores/compras ANTES de la venta del día
        timelineData.llegadas?.forEach(llegada => {
            const llegadaDate = new Date(llegada.fecha);
            if (llegadaDate.toDateString() === day.date.toDateString()) {
                currentStock += llegada.cantidad;
                day.events.push({
                    type: 'arrival',
                    cantidad: llegada.cantidad,
                    source: llegada.source
                });
            }
        });
        
        // Calcular venta perdida si no hay suficiente stock
        if (currentStock < ventaDiaria && ventaDiaria > 0) {
            const unidadesPerdidas = ventaDiaria - Math.max(0, currentStock);
            day.ventaPerdida = unidadesPerdidas * precioPromedio;
        }
        
        // Aplicar venta diaria
        currentStock -= ventaDiaria;
        day.stock = Math.max(0, currentStock);
    });

    // Calcular ventas perdidas por mes
    const ventasPerdidaePorMes = {};
    days.forEach(day => {
        if (day.ventaPerdida > 0) {
            const mesKey = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}`;
            if (!ventasPerdidaePorMes[mesKey]) {
                ventasPerdidaePorMes[mesKey] = 0;
            }
            ventasPerdidaePorMes[mesKey] += day.ventaPerdida;
        }
    });
    
    const totalVentaPerdida = Object.values(ventasPerdidaePorMes).reduce((sum, val) => sum + val, 0);
    const diasSinStock = days.filter(d => d.stock === 0 && ventaDiaria > 0).length;

    return (
        <div className="bg-white p-4 rounded-lg border">
            <div className="mb-4">
                <h4 className="font-semibold text-gray-800">Proyección próximos 4 meses</h4>
                <div className="text-sm text-gray-600 space-y-1">
                    <div>Stock actual: {timelineData.stock_actual} | Venta diaria: {ventaDiaria.toFixed(1)} | Precio prom: ${precioPromedio.toFixed(2)}</div>
                    {totalVentaPerdida > 0 && (
                        <div className="text-red-600 font-medium">
                            💰 Venta perdida estimada: ${totalVentaPerdida.toLocaleString('es-ES', {maximumFractionDigits: 0})} ({diasSinStock} días sin stock)
                        </div>
                    )}
                </div>
            </div>
            
            {/* Leyenda */}
            <div className="flex gap-4 text-xs mb-3">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span>Stock saludable</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                    <span>Stock bajo</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-500 rounded"></div>
                    <span>Quiebre stock</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span>Llegada</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-purple-500 rounded"></div>
                    <span>Sobrestock</span>
                </div>
            </div>

            {/* Timeline visual - Una sola línea */}
            <div className="relative overflow-x-auto">
                <div className="flex items-end gap-0.5 min-w-max pb-2">
                    {days.map((day, index) => {
                        let color = 'bg-green-500'; // Stock saludable
                        
                        if (day.stock <= 0) {
                            color = 'bg-red-500'; // Quiebre
                        } else if (day.stock < (stockMaximo * 0.3)) {
                            color = 'bg-yellow-500'; // Stock bajo
                        } else if (day.stock > (stockMaximo * 1.5)) {
                            color = 'bg-purple-500'; // Sobrestock
                        }
                        
                        // Si hay llegada, mostrar en azul
                        if (day.events.some(e => e.type === 'arrival')) {
                            color = 'bg-blue-500';
                        }
                        
                        // Mostrar fecha cada 7 días o en días con eventos
                        const showDate = index % 7 === 0 || day.events.length > 0;
                        
                        return (
                            <div key={index} className="flex flex-col items-center">
                                {showDate && (
                                    <div className="text-xs text-gray-500 mb-1 rotate-45 origin-bottom-left w-6 h-4">
                                        {formatDate(day.dateStr)}
                                    </div>
                                )}
                                <div
                                    className={`w-3 h-6 ${color} rounded-sm cursor-pointer`}
                                    title={`${formatDate(day.dateStr)}: Stock ${Math.round(day.stock)}${day.ventaPerdida > 0 ? ` | 💰 Venta perdida: $${day.ventaPerdida.toFixed(0)}` : ''}${day.events.length > 0 ? ` | ${day.events.map(e => `+${e.cantidad} (${e.source})`).join(', ')}` : ''}`}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Alertas críticas */}
            <div className="mt-4 space-y-2">
                {(() => {
                    const alertas = [];
                    const primerQuiebre = days.find(d => d.stock <= 0);
                    const sobrestocks = days.filter(d => d.stock > (stockMaximo * 1.5));
                    
                    if (primerQuiebre) {
                        alertas.push(
                            <div key="quiebre" className="bg-red-50 border border-red-200 p-2 rounded text-sm">
                                <span className="text-red-600 font-semibold">⚠️ Quiebre de stock:</span> 
                                <span className="ml-1">Día {primerQuiebre.dayNumber + 1} ({formatDate(primerQuiebre.dateStr)})</span>
                            </div>
                        );
                    }
                    
                    if (sobrestocks.length > 0) {
                        alertas.push(
                            <div key="sobrestock" className="bg-purple-50 border border-purple-200 p-2 rounded text-sm">
                                <span className="text-purple-600 font-semibold">📈 Sobrestock:</span>
                                <span className="ml-1">{sobrestocks.length} días con exceso de inventario</span>
                            </div>
                        );
                    }
                    
                    return alertas;
                })()}
            </div>
        </div>
    );
};

export default function Timeline() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading, logout } = useUser();
    const [skuFilter, setSkuFilter] = useState('');
    const [nameFilter, setNameFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    
    // Cargar datos del timeline
    const { data: timelineData, error: timelineError } = useSWR('/api/timeline', fetcher);
    const { data: configData } = useSWR('/api/config', fetcher);

    const config = configData?.config || {};

    useEffect(() => {
        if (!isLoading && (!isAuthenticated || !user)) {
            router.push('/');
        }
        // Verificar permisos de acceso - solo Chile y Admin
        if (!isLoading && isAuthenticated && user && user.role !== 'chile' && user.role !== 'admin') {
            router.push('/dashboard');
        }
    }, [isAuthenticated, user, isLoading, router]);

    // Filtrar datos
    const filteredTimeline = useMemo(() => {
        if (!timelineData?.timeline) return [];
        
        return timelineData.timeline.filter(item => {
            const skuMatch = item.sku.toLowerCase().includes(skuFilter.toLowerCase());
            const nameMatch = item.descripcion?.toLowerCase().includes(nameFilter.toLowerCase()) || false;
            const statusMatch = statusFilter ? item.status === statusFilter : true;
            
            return skuMatch && nameMatch && statusMatch;
        });
    }, [timelineData, skuFilter, nameFilter, statusFilter]);

    // Calcular ventas perdidas totales por mes
    const ventasPerdidasTotalesPorMes = useMemo(() => {
        if (!filteredTimeline || filteredTimeline.length === 0) return {};
        
        const totalesPorMes = {};
        
        filteredTimeline.forEach(item => {
            const maxDays = 120;
            const today = new Date();
            const ventaDiaria = item.venta_diaria || 0;
            const precioPromedio = item.precio_promedio || 0;
            let currentStock = item.stock_actual || 0;
            
            for (let i = 0; i < maxDays; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() + i);
                
                // Aplicar llegadas
                item.llegadas?.forEach(llegada => {
                    const llegadaDate = new Date(llegada.fecha);
                    if (llegadaDate.toDateString() === date.toDateString()) {
                        currentStock += llegada.cantidad;
                    }
                });
                
                // Calcular venta perdida
                if (currentStock < ventaDiaria && ventaDiaria > 0) {
                    const unidadesPerdidas = ventaDiaria - Math.max(0, currentStock);
                    const ventaPerdida = unidadesPerdidas * precioPromedio;
                    const mesKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    
                    if (!totalesPorMes[mesKey]) {
                        totalesPorMes[mesKey] = 0;
                    }
                    totalesPorMes[mesKey] += ventaPerdida;
                }
                
                // Aplicar venta diaria
                currentStock -= ventaDiaria;
                currentStock = Math.max(0, currentStock);
            }
        });
        
        return totalesPorMes;
    }, [filteredTimeline]);

    // Debug para ver los datos
    console.log('Ventas perdidas por mes:', ventasPerdidasTotalesPorMes);
    console.log('Filtered timeline:', filteredTimeline?.slice(0, 2)); // Solo los primeros 2 para debug

    if (isLoading) return <div className="p-8 text-center">Cargando...</div>;
    if (!isAuthenticated || !user) return <div className="p-8 text-center">No autorizado</div>;
    
    // Verificar permisos de acceso
    if (user.role !== 'chile' && user.role !== 'admin') {
        return (
            <div className="p-8 text-center">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
                    <h2 className="text-lg font-semibold text-red-800 mb-2">Acceso Restringido</h2>
                    <p className="text-red-600 mb-4">Esta funcionalidad está disponible solo para usuarios de Chile y Administradores.</p>
                    <Link href="/dashboard">
                        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                            ← Volver al Dashboard
                        </button>
                    </Link>
                </div>
            </div>
        );
    }

    if (timelineError) {
        return (
            <div className="p-8 text-center">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600">Error cargando timeline: {timelineError.message}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-100 min-h-screen">
            <div className="sticky top-0 z-20 bg-gray-100/80 backdrop-blur-md shadow-sm p-4">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-2xl font-bold">Timeline de Inventario</h1>
                        <p className="text-sm text-gray-600">Proyección de stock próximos 4 meses ({filteredTimeline.length} productos)</p>
                    </div>
                    <Link href="/dashboard">
                        <button className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2">
                            ← Dashboard
                        </button>
                    </Link>
                </div>
                <div>
                        
                        {/* Totalizador de ventas perdidas por mes */}
                        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <h3 className="text-sm font-semibold text-red-800 mb-2">💰 Ventas Perdidas Estimadas por Mes:</h3>
                            {Object.keys(ventasPerdidasTotalesPorMes).length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                    {Object.entries(ventasPerdidasTotalesPorMes)
                                        .sort(([a], [b]) => a.localeCompare(b))
                                        .map(([mes, total]) => {
                                            const [year, month] = mes.split('-');
                                            const monthName = new Date(year, month - 1).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
                                            return (
                                                <div key={mes} className="bg-white p-2 rounded border">
                                                    <div className="font-medium text-red-700">{monthName}</div>
                                                    <div className="text-red-600">${total.toLocaleString('es-ES', {maximumFractionDigits: 0})}</div>
                                                </div>
                                            );
                                        })}
                                    <div className="bg-red-100 p-2 rounded border border-red-300">
                                        <div className="font-bold text-red-800">Total</div>
                                        <div className="text-red-700 font-bold">
                                            ${Object.values(ventasPerdidasTotalesPorMes).reduce((sum, val) => sum + val, 0).toLocaleString('es-ES', {maximumFractionDigits: 0})}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-gray-600">
                                    Sin ventas perdidas estimadas o cargando datos... 
                                    (Productos: {filteredTimeline?.length || 0})
                                    <div className="text-xs mt-1">
                                        Debug: {JSON.stringify(Object.keys(ventasPerdidasTotalesPorMes))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Link href="/dashboard">
                            <button className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 text-sm">
                                ← Dashboard
                            </button>
                        </Link>
                        <button 
                            onClick={() => {
                                logout();
                                router.push('/');
                            }}
                            className="bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 text-sm flex items-center gap-2"
                        >
                            🚪 Cerrar Sesión
                        </button>
                    </div>
                </div>

                {/* Filtros */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <input 
                        type="text" 
                        placeholder="Filtrar por SKU..." 
                        value={skuFilter} 
                        onChange={e => setSkuFilter(e.target.value)} 
                        className="w-full border rounded-md p-2 text-sm" 
                    />
                    <input 
                        type="text" 
                        placeholder="Filtrar por nombre..." 
                        value={nameFilter} 
                        onChange={e => setNameFilter(e.target.value)} 
                        className="w-full border rounded-md p-2 text-sm" 
                    />
                    <select 
                        value={statusFilter} 
                        onChange={e => setStatusFilter(e.target.value)} 
                        className="w-full border rounded-md p-2 text-sm bg-white"
                    >
                        <option value="">Todos los estados</option>
                        <option value="NEEDS_REPLENISHMENT">Reponer</option>
                        <option value="QUOTE_REQUESTED">Cotizar</option>
                        <option value="PURCHASE_APPROVED">Comprar</option>
                        <option value="PURCHASE_CONFIRMED">Fabricando</option>
                        <option value="MANUFACTURED">Manufactured</option>
                        <option value="SHIPPED">En Tránsito</option>
                        <option value="NO_REPLENISHMENT_NEEDED">OK</option>
                    </select>
                </div>
            </div>

            <div className="p-4">
                {!timelineData ? (
                    <div className="text-center py-8">Cargando timeline...</div>
                ) : filteredTimeline.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-md p-8 text-center">
                        <h2 className="text-xl font-bold text-gray-800 mb-2">No hay productos</h2>
                        <p className="text-gray-600">No se encontraron productos que coincidan con los filtros.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {filteredTimeline.map((item) => {
                            const stockMaximo = (item.venta_diaria || 0) * (config.tiempoEntrega || 60);
                            
                            return (
                                <div key={item.sku} className="bg-white rounded-lg shadow-md p-6">
                                    {/* Header del producto */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h2 className="text-xl font-bold">{item.sku}</h2>
                                                <StatusBadge status={item.status} />
                                            </div>
                                            <p className="text-gray-600 mt-1">{item.descripcion}</p>
                                            <div className="flex gap-6 text-sm text-gray-500 mt-2">
                                                <span>Stock: <strong>{item.stock_actual || 0}</strong></span>
                                                <span>Venta diaria: <strong>{(item.venta_diaria || 0).toFixed(1)}</strong></span>
                                                <span>Precio prom: <strong>${(item.precio_promedio || 0).toFixed(2)}</strong></span>
                                                <span>Stock máximo saludable: <strong>{Math.round(stockMaximo)}</strong></span>
                                                {item.enTransito > 0 && (
                                                    <span>En tránsito: <strong className="text-blue-600">{item.enTransito}</strong></span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right text-sm text-gray-500">
                                            {item.llegadas && item.llegadas.length > 0 && (
                                                <div>
                                                    <div className="font-semibold">Próximas llegadas:</div>
                                                    {item.llegadas.slice(0, 3).map((llegada, idx) => (
                                                        <div key={idx} className="text-xs">
                                                            {formatDate(llegada.fecha)}: +{llegada.cantidad} ({llegada.source})
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Timeline visual */}
                                    <TimelineVisualization 
                                        timelineData={item} 
                                        stockMaximo={stockMaximo}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}