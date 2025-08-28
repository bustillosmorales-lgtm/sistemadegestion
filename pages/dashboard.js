// pages/dashboard.js
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useMemo, useEffect } from 'react';
import ActionModal from '../components/ActionModal';
import { useUser } from '../components/UserContext';

const fetcher = (url) => fetch(url).then((res) => res.json());

const formatDate = (isoDate) => {
    if (!isoDate || typeof isoDate !== 'string' || !isoDate.includes('-')) return isoDate;
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return isoDate;
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
};

const statusConfig = {
    NEEDS_REPLENISHMENT: { text: 'Necesita Reposición', color: 'bg-yellow-500', nextAction: 'QUOTE_REQUESTED', buttonText: 'Pedir Cotización', role: 'chile', hasForm: true },
    QUOTE_REQUESTED: { text: 'Cotización Solicitada', color: 'bg-blue-500', nextAction: 'QUOTED', buttonText: 'Cotizar', role: 'china', hasForm: true },
    QUOTED: { text: 'Cotizado', color: 'bg-cyan-500', nextAction: 'ANALYZING', buttonText: 'Analizar', role: 'chile', hasForm: true },
    ANALYZING: { text: 'En Análisis', color: 'bg-purple-500', nextAction: 'PURCHASE_APPROVED', buttonText: 'Aprobar Compra', role: 'chile', hasForm: true },
    PURCHASE_APPROVED: { text: 'Compra Aprobada', color: 'bg-green-500', nextAction: 'PURCHASE_CONFIRMED', buttonText: 'Confirmar Compra', role: 'china', hasForm: true },
    PURCHASE_CONFIRMED: { text: 'Compra Confirmada', color: 'bg-green-600', nextAction: 'MANUFACTURED', buttonText: 'Confirmar Fabricación', role: 'china', hasForm: true },
    MANUFACTURED: { text: 'Fabricado', color: 'bg-indigo-500', nextAction: 'SHIPPED', buttonText: 'Confirmar Carga', role: 'china', hasForm: true },
    SHIPPED: { text: 'Enviado', color: 'bg-gray-700', nextAction: null, buttonText: 'Proceso Finalizado', role: null, hasForm: false },
    QUOTE_REJECTED: { text: 'Cotización Rechazada', color: 'bg-red-700', nextAction: 'NEEDS_REPLENISHMENT', buttonText: 'Re-cotizar', role: 'chile', hasForm: false },
};

const workflowOrder = Object.keys(statusConfig).filter(s => s !== 'QUOTE_REJECTED');

const detailFieldNames = {
    quantityToQuote: 'Cantidad Solicitada', comments: 'Comentarios', unitPrice: 'Precio Unitario',
    currency: 'Moneda', unitsPerBox: 'Unidades/Bulto', cbmPerBox: 'CBM/Bulto',
    productionDays: 'Días de Producción', sellingPrice: 'Precio de Venta Usado', approved: 'Aprobado',
    targetPurchasePrice: 'Precio Objetivo', estimatedDeliveryDate: 'Fecha Entrega Est.', completionDate: 'Fecha Finalización',
    qualityNotes: 'Notas de Calidad', containerNumber: 'Nº Contenedor', shippingDate: 'Fecha de Embarque',
    eta: 'Llegada Estimada (ETA)',
};

export default function Dashboard() {
  const router = useRouter();
  const { user } = useUser();
  const { data, error } = useSWR('/api/analysis', fetcher);
  const [expandedSku, setExpandedSku] = useState(null);
  const [isUpdating, setIsUpdating] = useState(null);
  const [modalState, setModalState] = useState({ isOpen: false, product: null, status: null });
  
  const [skuFilter, setSkuFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (!user) {
        router.push('/');
    }
  }, [user, router]);

  const products = data?.results || [];

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
        const skuMatch = p.sku.toLowerCase().includes(skuFilter.toLowerCase());
        const nameMatch = p.descripcion.toLowerCase().includes(nameFilter.toLowerCase());
        const statusMatch = statusFilter ? p.status === statusFilter : true;
        return skuMatch && nameMatch && statusMatch;
    });
  }, [products, skuFilter, nameFilter, statusFilter]);

  if (error) return <div className="p-8 text-red-500 font-bold">Error al cargar datos</div>;
  if (!data || !user) return <div className="p-8 text-center">Cargando...</div>;

  const handleActionClick = (product, status) => {
    const action = statusConfig[status];
    if (!action || (!action.nextAction && status !== 'QUOTE_REJECTED')) return;
    if (status === 'QUOTE_REJECTED') {
        handleStatusChange(product.sku, action.nextAction);
        return;
    }
    if (action.hasForm) {
      setModalState({ isOpen: true, product: product, status: status });
    } else {
      handleStatusChange(product.sku, action.nextAction);
    }
  };

  const handleStatusChange = async (sku, nextStatus, payload = null) => {
    setIsUpdating(sku);
    try {
        const res = await fetch('/api/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sku, nextStatus, payload }),
        });
        if (!res.ok) {
            const errorData = await res.json();
            alert(`Error: ${errorData.error}`);
        }
        mutate('/api/analysis');
    } catch (err) {
        alert('Error de conexión al actualizar el estado.');
    } finally {
        setIsUpdating(null);
        setModalState({ isOpen: false, product: null, status: null });
    }
  };

  const toggleExpand = (sku) => {
    setExpandedSku(expandedSku === sku ? null : sku);
  };
  
  const renderDetailCard = (title, details, product, isPending = false) => {
    if (isPending) {
        return (
           <div className="bg-gray-100 p-4 rounded-lg border border-dashed">
               <h4 className="font-bold text-gray-400 mb-2">{title}</h4>
               <p className="text-sm text-gray-400">Pendiente</p>
           </div>
       );
    }
    if (!details) return null;

    if (title.includes("Solicitud de Cotización")) {
        const ventaDiariaDetails = product.breakdown?.ventaDiariaDetails;
        const reposicionDetails = product.breakdown;
        return (
            <div className="bg-white p-4 rounded-lg shadow-sm col-span-full lg:col-span-1">
                <h4 className="font-bold text-gray-800 mb-2">{title}</h4>
                <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-gray-600">Cantidad Solicitada:</span><span className="font-mono">{details.quantityToQuote}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Comentarios:</span><span className="font-mono">{details.comments}</span></div>
                </div>
                {ventaDiariaDetails && (
                    <div className="mt-3 pt-2 border-t">
                        <h5 className="font-semibold text-gray-700">Cálculo de Venta Diaria</h5>
                        <div className="space-y-1 text-sm pl-2">
                            <div className="flex justify-between"><span className="text-gray-600">Fecha Inicial:</span><span className="font-mono">{formatDate(ventaDiariaDetails.fechaInicial)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Fecha Final:</span><span className="font-mono">{formatDate(ventaDiariaDetails.fechaFinal)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Unidades Vendidas:</span><span className="font-mono">{ventaDiariaDetails.unidadesVendidas}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Venta Diaria Promedio:</span><span className="font-mono">{ventaDiariaDetails.ventaDiariaCalculada}</span></div>
                        </div>
                    </div>
                )}
                {reposicionDetails && (
                     <div className="mt-3 pt-2 border-t">
                        <h5 className="font-semibold text-gray-700">Cálculo de Reposición</h5>
                        <div className="space-y-1 text-sm pl-2">
                            <div className="flex justify-between"><span className="text-gray-600">Stock Objetivo:</span><span className="font-mono">{reposicionDetails.stockObjetivo} un.</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Stock Proyectado:</span><span className="font-mono">{reposicionDetails.stockFinalProyectado} un.</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Días Disponibles:</span><span className="font-mono">{reposicionDetails.diasCoberturaLlegada} días</span></div>
                        </div>
                    </div>
                )}
            </div>
        )
    }
    
    if (title.includes("Decisión de Compra")) {
        const snapshot = details.analysisSnapshot;
        return (
             <div className="bg-white p-4 rounded-lg shadow-sm">
                <h4 className={`font-bold mb-2 ${details.approved ? 'text-green-600' : 'text-red-600'}`}>{details.approved ? "👍 Aprobación" : "👎 Rechazo"}</h4>
                {snapshot && (
                    <div className="text-sm space-y-1 mb-2">
                        <div className="flex justify-between"><span className="text-gray-600">Precio Venta Usado:</span><span className="font-mono">${parseInt(snapshot.sellingPrice).toLocaleString('es-CL')}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Ganancia Neta:</span><span className="font-mono">${Math.round(snapshot.gananciaNeta).toLocaleString('es-CL')}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Margen:</span><span className="font-mono">{snapshot.margen.toFixed(1)}%</span></div>
                    </div>
                )}
                <div className="border-t pt-2 mt-2 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-gray-600">Decisión:</span><span className="font-mono">{details.approved ? 'Aprobado' : 'Rechazado'}</span></div>
                    {!details.approved && <div className="flex justify-between"><span className="text-gray-600">Precio Objetivo:</span><span className="font-mono">${details.targetPurchasePrice} USD</span></div>}
                    <div className="flex justify-between"><span className="text-gray-600">Comentarios:</span><span className="font-mono">{details.comments}</span></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm">
            <h4 className="font-bold text-gray-800 mb-2">{title}</h4>
            <div className="space-y-1 text-sm">
                {Object.entries(details).map(([key, value]) => {
                    const isDate = ['estimatedDeliveryDate', 'completionDate', 'shippingDate', 'eta'].includes(key);
                    return (
                        <div key={key} className="flex justify-between">
                            <span className="text-gray-600">{detailFieldNames[key] || key}:</span>
                            <span className="font-mono text-right">{isDate ? formatDate(value) : (typeof value === 'boolean' ? (value ? 'Sí' : 'No') : value)}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    );
  };

  return (
    <>
      <ActionModal isOpen={modalState.isOpen} onClose={() => setModalState({ isOpen: false, product: null, status: null })} product={modalState.product} status={modalState.status}
        onSubmit={(sku, status, formData, overrideNextStatus) => {
            const nextStatus = overrideNextStatus || statusConfig[status]?.nextAction;
            handleStatusChange(sku, nextStatus, formData);
        }}
      />
      <div className="bg-gray-100 min-h-screen">
        <div className="sticky top-0 z-20 bg-gray-100/80 backdrop-blur-md shadow-sm p-4">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Dashboard de Gestión</h1>
                <div className="flex gap-2">
                    {user.role === 'admin' && (
                        <>
                            <Link href="/users"><button className="bg-purple-600 text-white px-3 py-2 rounded-md hover:bg-purple-700 text-sm flex items-center gap-2">👥 Usuarios</button></Link>
                            <Link href="/config"><button className="bg-gray-600 text-white px-3 py-2 rounded-md hover:bg-gray-700 text-sm flex items-center gap-2">⚙️ Configurar</button></Link>
                        </>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <input type="text" placeholder="Buscar por SKU..." value={skuFilter} onChange={e => setSkuFilter(e.target.value)} className="w-full border rounded-md p-2 text-sm" />
                <input type="text" placeholder="Buscar por Nombre..." value={nameFilter} onChange={e => setNameFilter(e.target.value)} className="w-full border rounded-md p-2 text-sm" />
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full border rounded-md p-2 text-sm bg-white">
                    <option value="">Todos los estados</option>
                    {Object.entries(statusConfig).map(([key, { text }]) => <option key={key} value={key}>{text}</option>)}
                </select>
                {/* Lógica de permisos para el botón Crear Producto */}
                {(user.role === 'chile' || user.role === 'admin') && (
                    <Link href="/create-sku" className="w-full"><button className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 text-sm w-full">+ Crear Producto</button></Link>
                )}
                {/* Espaciador para mantener el layout si el botón no se muestra */}
                {user.role === 'china' && <div />}
                <button onClick={() => alert('Funcionalidad no implementada en este sprint.')} className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 text-sm w-full">Exportar a Excel</button>
            </div>
        </div>

        <div className="p-4 space-y-4">
          {filteredProducts.map((product) => {
            const currentStatusInfo = statusConfig[product.status] || { text: 'Desconocido', color: 'bg-gray-400' };
            const currentStatusIndex = workflowOrder.indexOf(product.status);
            const isExpanded = expandedSku === product.sku;
            const diasDeStock = product.ventaDiaria > 0 ? ((product.stockActual + (product.enTransito || 0)) / product.ventaDiaria) : Infinity;

            const detailStages = [
                { title: "🗣️ Solicitud de Cotización", data: product.requestDetails, statusKey: 'NEEDS_REPLENISHMENT' },
                { title: "📝 Cotización", data: product.quoteDetails, statusKey: 'QUOTE_REQUESTED' },
                { title: "📈 Análisis", data: product.analysisDetails, statusKey: 'QUOTED' },
                { title: "⚖️ Decisión de Compra", data: product.approvalDetails, statusKey: 'ANALYZING' },
                { title: "✅ Compra Confirmada", data: product.purchaseDetails, statusKey: 'PURCHASE_APPROVED' },
                { title: "🏭 Fabricación", data: product.manufacturingDetails, statusKey: 'PURCHASE_CONFIRMED' },
                { title: "🚢 Embarque", data: product.shippingDetails, statusKey: 'MANUFACTURED' }
            ];

            return (
              <div key={product.sku} className="bg-white rounded-lg shadow-md">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-xl font-bold">{product.descripcion}</h2>
                      <p className="text-gray-600">SKU: {product.sku}</p>
                      <span className={`text-xs font-bold text-white px-2 py-1 rounded-full ${currentStatusInfo.color}`}>{currentStatusInfo.text}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <button onClick={() => toggleExpand(product.sku)} className="bg-gray-700 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-800">{isExpanded ? 'Ocultar' : 'Detalles'}</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-4 border-t pt-4">
                    {workflowOrder.slice(0, -1).map((statusKey, index) => {
                      const action = statusConfig[statusKey];
                      const isStepEnabled = (currentStatusIndex === index || (product.status === 'QUOTE_REJECTED' && statusKey === 'NEEDS_REPLENISHMENT'));
                      const userHasPermission = user.role === 'admin' || user.role === action.role;
                      const isEnabled = isStepEnabled && userHasPermission && (isUpdating !== product.sku);
                      
                      return (
                        <button key={statusKey} onClick={() => handleActionClick(product, statusKey)} disabled={!isEnabled}
                          className={`px-3 py-2 rounded text-xs font-semibold text-white text-center transition ${isEnabled ? (action.role === 'chile' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700') : 'bg-gray-300 cursor-not-allowed'}`}
                          title={isEnabled ? `Siguiente: ${action.buttonText}` : `Paso no disponible o sin permiso. Estado actual: ${currentStatusInfo.text}`}>
                          {action.buttonText}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid md:grid-cols-5 gap-4 text-center md:text-left">
                    <div><p className="text-xs text-gray-500 font-bold">STOCK ACTUAL</p><p className="text-2xl font-bold">{product.stockActual}</p></div>
                    <div><p className="text-xs text-gray-500 font-bold">EN TRÁNSITO</p><p className="text-2xl font-bold text-blue-600">{product.enTransito || 0}</p></div>
                    <div><p className="text-xs text-gray-500 font-bold">CANT. SUGERIDA</p><p className="text-2xl font-bold text-green-600">{product.cantidadSugerida}</p></div>
                    <div><p className="text-xs text-gray-500 font-bold">VENTA DIARIA</p><p className="text-lg font-bold">{product.ventaDiaria.toFixed(1)}</p></div>
                    <div><p className="text-xs text-gray-500 font-bold">DÍAS DE STOCK</p><p className={`text-lg font-bold ${diasDeStock < 30 ? 'text-red-600' : 'text-green-600'}`}>{diasDeStock === Infinity ? '∞' : diasDeStock.toFixed(0)}</p></div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t bg-gray-50 p-6">
                    <h3 className="text-xl font-bold mb-4">Historial y Detalles del Proceso</h3>
                    <div className="grid lg:grid-cols-2 gap-6">
                        {detailStages.map((stage, index) => {
                            const isPending = index > currentStatusIndex;
                            if (product.status === 'QUOTE_REJECTED' && stage.statusKey === 'ANALYZING') {
                                return renderDetailCard(stage.title, stage.data, product, false);
                            }
                            return renderDetailCard(stage.title, stage.data, product, isPending);
                        })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
