// pages/dashboard.js
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useMemo, useEffect } from 'react';
import ActionModal from '../components/ActionModal';
import { useUser } from '../components/UserContext';
import * as XLSX from 'xlsx';

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

const formatDateTime = (isoDate) => {
    if (!isoDate || typeof isoDate !== 'string' || !isoDate.includes('-')) return isoDate;
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return isoDate;
    return date.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const statusConfig = {
    NO_REPLENISHMENT_NEEDED: { text: 'Sin Reposición Programada', color: 'bg-gray-400', nextAction: null, buttonText: 'Sin Acción Requerida', role: null, hasForm: false },
    NEEDS_REPLENISHMENT: { text: 'Necesita Reposición', color: 'bg-yellow-500', nextAction: 'QUOTE_REQUESTED', buttonText: 'Pedir Cotización', role: 'chile', hasForm: true },
    QUOTE_REQUESTED: { text: 'Cotización Solicitada', color: 'bg-blue-500', nextAction: 'QUOTED', buttonText: 'Cotizar', role: 'china', hasForm: true },
    QUOTED: { text: 'Cotizado', color: 'bg-cyan-500', nextAction: 'ANALYZING', buttonText: 'Analizar', role: 'chile', hasForm: true },
    ANALYZING: { text: 'En Análisis', color: 'bg-purple-500', nextAction: 'PURCHASE_APPROVED', buttonText: 'Aprobar Compra', role: 'chile', hasForm: true },
    PURCHASE_APPROVED: { text: 'Compra Aprobada', color: 'bg-green-500', nextAction: 'PURCHASE_CONFIRMED', buttonText: 'Confirmar Compra', role: 'china', hasForm: true },
    PURCHASE_CONFIRMED: { text: 'Compra Confirmada', color: 'bg-green-600', nextAction: 'MANUFACTURED', buttonText: 'Confirmar Fabricación', role: 'china', hasForm: true },
    MANUFACTURED: { text: 'Fabricado', color: 'bg-indigo-500', nextAction: 'SHIPPED', buttonText: 'Confirmar Carga', role: 'china', hasForm: true },
    SHIPPED: { text: 'Enviado', color: 'bg-gray-700', nextAction: null, buttonText: 'Proceso Finalizado', role: null, hasForm: false },
    QUOTE_REJECTED: { text: 'Cotización Rechazada', color: 'bg-red-700', nextAction: 'QUOTED', buttonText: 'Re-cotizar', role: 'china', hasForm: true },
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
  const { user, isAuthenticated, isLoading, logout } = useUser();
  const { data, error } = useSWR('/api/analysis', fetcher);
  const [expandedSku, setExpandedSku] = useState(null);
  const [isUpdating, setIsUpdating] = useState(null);
  const [modalState, setModalState] = useState({ isOpen: false, product: null, status: null });
  
  const [skuFilter, setSkuFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user)) {
      router.push('/');
    }
  }, [isAuthenticated, user, isLoading, router]);

  const products = data?.results || [];

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
        const skuMatch = (p.sku || '').toLowerCase().includes(skuFilter.toLowerCase());
        const nameMatch = (p.descripcion || p.description || '').toLowerCase().includes(nameFilter.toLowerCase());
        const statusMatch = statusFilter ? p.status === statusFilter : true;
        return skuMatch && nameMatch && statusMatch;
    });
  }, [products, skuFilter, nameFilter, statusFilter]);

  // Calcular totales de CBM y USD por status
  const totals = useMemo(() => {
    const statusesToTrack = ['PURCHASE_APPROVED', 'PURCHASE_CONFIRMED', 'MANUFACTURED', 'SHIPPED'];
    const cbmTotals = {};
    const usdTotals = {};
    
    statusesToTrack.forEach(status => {
      const statusProducts = products.filter(p => p.status === status);
      
      cbmTotals[status] = statusProducts.reduce((sum, p) => sum + (p.cbm || 0), 0);
      
      // Calcular totales USD basado en costoFinalBodega convertido a USD
      usdTotals[status] = statusProducts.reduce((sum, p) => {
        const costoFinalBodegaCLP = p.costoFinalBodega || 0;
        const cantidadComprada = p.approval_details?.purchaseQuantity || 0;
        const costoTotalCLP = costoFinalBodegaCLP * cantidadComprada;
        const usdToClp = data?.configActual?.usdToClp || 1000;
        const costoTotalUSD = costoTotalCLP / usdToClp;
        return sum + costoTotalUSD;
      }, 0);
    });
    
    // Totales generales
    cbmTotals.TOTAL = Object.values(cbmTotals).reduce((sum, val) => sum + val, 0);
    usdTotals.TOTAL = Object.values(usdTotals).reduce((sum, val) => sum + val, 0);
    
    return { cbm: cbmTotals, usd: usdTotals };
  }, [products, data?.configActual]);

  if (isLoading || !isAuthenticated || !user) return <div className="p-8 text-center">Cargando...</div>;
  if (error) return <div className="p-8 text-red-500 font-bold">Error al cargar datos</div>;
  if (!data) return <div className="p-8 text-center">Cargando datos...</div>;

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
    console.log('🔄 handleStatusChange llamado:', { sku, nextStatus, payload });
    setIsUpdating(sku);
    try {
        const res = await fetch('/api/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sku, nextStatus, payload }),
        });
        console.log('📡 Respuesta de API:', res.status, res.statusText);
        
        const responseData = await res.json();
        console.log('📋 Datos de respuesta:', responseData);
        
        if (!res.ok) {
            alert(`Error: ${responseData.error}`);
        } else {
            console.log('✅ Status actualizado exitosamente');
            // No mostrar alert para no interferir con el flujo
        }
        console.log('🔄 Ejecutando mutate para refrescar datos...');
        await mutate('/api/analysis', undefined, { revalidate: true });
        console.log('✅ Datos actualizados desde el servidor');
    } catch (err) {
        console.error('❌ Error en handleStatusChange:', err);
        alert('Error de conexión al actualizar el estado.');
    } finally {
        setIsUpdating(null);
        setModalState({ isOpen: false, product: null, status: null });
    }
  };

  const handleToggleDesconsiderado = async (sku, currentState) => {
    const newState = !currentState;
    setIsUpdating(sku);
    
    try {
      const res = await fetch(`/api/products?sku=${sku}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desconsiderado: newState }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        alert(`Error: ${errorData.error}`);
      } else {
        await mutate('/api/analysis', undefined, { revalidate: true });
      }
    } catch (err) {
      console.error('❌ Error al cambiar estado desconsiderado:', err);
      alert('Error de conexión al actualizar el producto.');
    } finally {
      setIsUpdating(null);
    }
  };


  const toggleExpand = (sku) => {
    setExpandedSku(expandedSku === sku ? null : sku);
  };

  const exportToExcel = () => {
    if (!filteredProducts || filteredProducts.length === 0) {
      alert('No hay productos para exportar');
      return;
    }

    // Preparar los datos para la exportación
    const exportData = filteredProducts.map(product => {
      const currentStatusInfo = statusConfig[product.status] || { text: 'Estado Desconocido' };
      const diasDeStock = (product.venta_diaria || product.ventaDiaria || 0) > 0 ? 
        ((product.stock_actual || product.stockActual || 0) + (product.enTransito || 0)) / (product.venta_diaria || product.ventaDiaria || 1) : 
        'Infinito';

      return {
        'SKU': product.sku || '',
        'Descripción': product.descripcion || product.description || '',
        'Status': currentStatusInfo.text,
        'Stock Actual': product.stock_actual || product.stockActual || 0,
        'En Tránsito': product.enTransito || 0,
        'Venta Diaria': (product.venta_diaria || product.ventaDiaria || 0).toFixed(1),
        'Días de Stock': diasDeStock === 'Infinito' ? diasDeStock : Math.round(diasDeStock),
        'Cantidad Sugerida': product.cantidadSugerida || 0,
        'Costo FOB (RMB)': product.costo_fob_rmb || 0,
        'CBM': product.cbm || 0,
        'Costo Final Bodega': product.costoFinalBodega ? Math.round(product.costoFinalBodega) : 0,
        'Ganancia Neta': product.gananciaNeta ? Math.round(product.gananciaNeta) : 0,
        'Margen %': product.margen ? product.margen.toFixed(1) : '0.0',
        'Fecha Actualización': product.updated_at ? formatDateTime(product.updated_at) : '',
        
        // Detalles específicos por status (solo para admin y chile)
        ...(user.role === 'admin' || user.role === 'chile' ? {
          'Comentarios Solicitud': product.request_details?.comments || '',
          'Cantidad Cotizada': product.quote_details?.quantityToQuote || '',
          'Precio Unitario': product.quote_details?.unitPrice || '',
          'Moneda': product.quote_details?.currency || '',
          'Días Producción': product.quote_details?.productionDays || '',
          'Precio Venta Análisis': product.analysis_details?.sellingPrice || '',
          'Aprobado': product.approval_details?.approved ? 'Sí' : (product.approval_details?.approved === false ? 'No' : ''),
          'Precio Objetivo': product.approval_details?.targetPurchasePrice || '',
          'Fecha Entrega Estimada': product.purchase_details?.estimatedDeliveryDate ? formatDate(product.purchase_details.estimatedDeliveryDate) : '',
          'Fecha Fabricación': product.manufacturing_details?.completionDate ? formatDate(product.manufacturing_details.completionDate) : '',
          'Número Contenedor': product.shipping_details?.containerNumber || '',
          'Fecha Embarque': product.shipping_details?.shippingDate ? formatDate(product.shipping_details.shippingDate) : '',
          'ETA': product.shipping_details?.eta ? formatDate(product.shipping_details.eta) : ''
        } : {})
      };
    });

    // Crear el libro de trabajo
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Configurar el ancho de las columnas
    const colWidths = [
      { wch: 15 }, // SKU
      { wch: 30 }, // Descripción
      { wch: 20 }, // Status
      { wch: 12 }, // Stock Actual
      { wch: 12 }, // En Tránsito
      { wch: 12 }, // Venta Diaria
      { wch: 15 }, // Días de Stock
      { wch: 15 }, // Cantidad Sugerida
      { wch: 15 }, // Costo FOB
      { wch: 10 }, // CBM
      { wch: 18 }, // Costo Final Bodega
      { wch: 15 }, // Ganancia Neta
      { wch: 10 }, // Margen %
      { wch: 20 }, // Fecha Actualización
    ];

    // Agregar anchos adicionales si el usuario puede ver detalles
    if (user.role === 'admin' || user.role === 'chile') {
      colWidths.push(
        { wch: 20 }, // Comentarios Solicitud
        { wch: 15 }, // Cantidad Cotizada
        { wch: 15 }, // Precio Unitario
        { wch: 10 }, // Moneda
        { wch: 15 }, // Días Producción
        { wch: 18 }, // Precio Venta Análisis
        { wch: 10 }, // Aprobado
        { wch: 15 }, // Precio Objetivo
        { wch: 18 }, // Fecha Entrega Estimada
        { wch: 18 }, // Fecha Fabricación
        { wch: 18 }, // Número Contenedor
        { wch: 15 }, // Fecha Embarque
        { wch: 15 }  // ETA
      );
    }

    ws['!cols'] = colWidths;

    // Agregar la hoja al libro
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');

    // Generar nombre del archivo con fecha y hora
    const now = new Date();
    const timestamp = now.toISOString().split('T')[0] + '_' + 
                     now.toTimeString().split(':').slice(0,2).join('-');
    const filename = `Inventario_${timestamp}.xlsx`;

    // Descargar el archivo
    XLSX.writeFile(wb, filename);
  };
  
  const renderDetailCard = (title, details, product, isPending = false, allowedRoles = ['admin', 'chile']) => {
    // Control de visibilidad por roles - usuario2 (china) no puede ver detalles internos
    if (!allowedRoles.includes(user.role)) {
        if (isPending) {
            return (
                <div className="bg-gray-100 p-4 rounded-lg border border-dashed">
                    <h4 className="font-bold text-gray-400 mb-2">{title}</h4>
                    <p className="text-sm text-gray-400">Pendiente</p>
                </div>
            );
        }
        return (
            <div className="bg-gray-200 p-4 rounded-lg border">
                <h4 className="font-bold text-gray-600 mb-2">{title}</h4>
                <p className="text-sm text-gray-600">✅ Completado</p>
            </div>
        );
    }
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
                    <div className="flex justify-between"><span className="text-gray-600">Cantidad Solicitada:</span><span className="font-mono">{details.quantityToQuote || '-'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Comentarios:</span><span className="font-mono">{details.comments || '-'}</span></div>
                </div>
                {ventaDiariaDetails && (
                    <div className="mt-3 pt-2 border-t">
                        <h5 className="font-semibold text-gray-700">Cálculo de Venta Diaria</h5>
                        <div className="space-y-1 text-sm pl-2">
                            <div className="flex justify-between"><span className="text-gray-600">Fecha Inicial:</span><span className="font-mono">{formatDate(ventaDiariaDetails.fechaInicial)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Fecha Final:</span><span className="font-mono">{formatDate(ventaDiariaDetails.fechaFinal)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Unidades Vendidas:</span><span className="font-mono">{ventaDiariaDetails.unidadesVendidas || 0}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Venta Diaria Promedio:</span><span className="font-mono">{ventaDiariaDetails.ventaDiariaCalculada || '0.00'}</span></div>
                        </div>
                    </div>
                )}
                {reposicionDetails && (
                     <div className="mt-3 pt-2 border-t">
                        <h5 className="font-semibold text-gray-700">Cálculo de Reposición</h5>
                        <div className="space-y-1 text-sm pl-2">
                            <div className="flex justify-between"><span className="text-gray-600">Stock Objetivo:</span><span className="font-mono">{reposicionDetails.stockObjetivo || 0} un.</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Stock Proyectado:</span><span className="font-mono">{reposicionDetails.stockFinalProyectado || 0} un.</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Días Disponibles:</span><span className="font-mono">{reposicionDetails.diasCoberturaLlegada || 0} días</span></div>
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
                        <div className="flex justify-between"><span className="text-gray-600">Precio Venta Usado:</span><span className="font-mono">${parseInt(snapshot.sellingPrice || 0).toLocaleString('es-CL')}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Ganancia Neta:</span><span className="font-mono">${Math.round(snapshot.gananciaNeta || 0).toLocaleString('es-CL')}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Margen:</span><span className="font-mono">{(snapshot.margen || 0).toFixed(1)}%</span></div>
                    </div>
                )}
                <div className="border-t pt-2 mt-2 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-gray-600">Decisión:</span><span className="font-mono">{details.approved ? 'Aprobado' : 'Rechazado'}</span></div>
                    {!details.approved && <div className="flex justify-between"><span className="text-gray-600">Precio Objetivo:</span><span className="font-mono">${details.targetPurchasePrice || 0} USD</span></div>}
                    <div className="flex justify-between"><span className="text-gray-600">Comentarios:</span><span className="font-mono">{details.comments || '-'}</span></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex justify-between items-start mb-3">
                <h4 className="font-bold text-gray-800">{title}</h4>
                {details.timestamp && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {formatDateTime(details.timestamp)}
                    </span>
                )}
            </div>
            
            <div className="space-y-2 text-sm">
                {Object.entries(details).map(([key, value]) => {
                    // Filtrar campos internos/técnicos
                    if (['timestamp', 'previousStatus', 'nextStatus', 'configSnapshot', 'analysisSnapshot', 'sku', 'descripcion'].includes(key)) {
                        return null;
                    }
                    
                    const isDate = ['estimatedDeliveryDate', 'completionDate', 'shippingDate', 'eta'].includes(key);
                    const fieldName = detailFieldNames[key] || key;
                    
                    if (value === null || value === undefined || value === '') return null;
                    
                    let displayValue = value;
                    if (isDate) {
                        displayValue = formatDate(value);
                    } else if (typeof value === 'boolean') {
                        displayValue = value ? 'Sí' : 'No';
                    } else if (typeof value === 'object') {
                        // Manejar objetos anidados de manera simple
                        displayValue = JSON.stringify(value);
                    } else {
                        displayValue = value.toString();
                    }
                    
                    return (
                        <div key={key} className="flex justify-between">
                            <span className="text-gray-600">{fieldName}:</span>
                            <span className="font-mono text-right max-w-xs truncate" title={displayValue}>
                                {displayValue || '-'}
                            </span>
                        </div>
                    );
                })}
            </div>
            
            {/* Información adicional de contexto */}
            {(details.previousStatus && details.nextStatus) && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-500 space-y-1">
                        <div className="flex justify-between">
                            <span>Transición:</span>
                            <span className="font-mono text-xs">
                                {statusConfig[details.previousStatus]?.text || details.previousStatus} → {statusConfig[details.nextStatus]?.text || details.nextStatus}
                            </span>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Información de configuración para cotizaciones */}
            {details.configSnapshot && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-500">
                        <div className="font-semibold mb-1">Tasas usadas:</div>
                        <div className="space-y-1 pl-2">
                            {details.configSnapshot.rmbToUsd && (
                                <div className="flex justify-between">
                                    <span>RMB → USD:</span>
                                    <span className="font-mono">{details.configSnapshot.rmbToUsd}</span>
                                </div>
                            )}
                            {details.configSnapshot.usdToClp && (
                                <div className="flex justify-between">
                                    <span>USD → CLP:</span>
                                    <span className="font-mono">{details.configSnapshot.usdToClp}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
  };

  return (
    <>
      <ActionModal isOpen={modalState.isOpen} onClose={() => setModalState({ isOpen: false, product: null, status: null })} product={modalState.product} status={modalState.status} config={data?.configActual}
        onSubmit={(sku, status, formData, overrideNextStatus) => {
            console.log('🚀 onSubmit del dashboard ejecutado');
            console.log('📦 SKU:', sku);
            console.log('🏷️ Status:', status);  
            console.log('📝 FormData:', formData);
            console.log('⚡ Override status:', overrideNextStatus);
            
            const nextStatus = overrideNextStatus || statusConfig[status]?.nextAction;
            console.log('🎯 Next status calculado:', nextStatus);
            
            handleStatusChange(sku, nextStatus, formData);
        }}
      />
      <div className="bg-gray-100 min-h-screen">
        <div className="sticky top-0 z-20 bg-gray-100/80 backdrop-blur-md shadow-sm p-4">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-2xl font-bold">Dashboard de Gestión</h1>
                    <p className="text-sm text-gray-600">Sesión: <span className="font-semibold">{user.name}</span> ({user.role})</p>
                </div>
                <div className="flex gap-2">
                    {user.role === 'admin' && (
                        <Link href="/users"><button className="bg-purple-600 text-white px-3 py-2 rounded-md hover:bg-purple-700 text-sm flex items-center gap-2">👥 Usuarios</button></Link>
                    )}
                    {(user.role === 'admin' || user.role === 'chile') && (
                        <Link href="/config"><button className="bg-gray-600 text-white px-3 py-2 rounded-md hover:bg-gray-700 text-sm flex items-center gap-2">⚙️ Configurar</button></Link>
                    )}
                    {(user.role === 'admin' || user.role === 'chile') && (
                        <Link href="/bulk-upload"><button className="bg-orange-600 text-white px-3 py-2 rounded-md hover:bg-orange-700 text-sm flex items-center gap-2">📤 Cargar Datos</button></Link>
                    )}
                    {(user.role === 'admin' || user.role === 'china' || user.role === 'chile') && (
                        <Link href="/contenedores"><button className="bg-indigo-600 text-white px-3 py-2 rounded-md hover:bg-indigo-700 text-sm flex items-center gap-2">🚢 Contenedores</button></Link>
                    )}
                    {(user.role === 'admin' || user.role === 'chile') && (
                        <Link href="/skus-desconsiderados"><button className="bg-orange-600 text-white px-3 py-2 rounded-md hover:bg-orange-700 text-sm flex items-center gap-2">🚫 SKUs Desconsiderados</button></Link>
                    )}
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
                <button onClick={exportToExcel} className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 text-sm w-full">📊 Exportar a Excel</button>
            </div>
        </div>

        {/* Panel de totalizadores fijos */}
        <div className="sticky top-0 z-30 bg-gray-100/95 backdrop-blur-md shadow-sm">
          <div className="p-4">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold mb-4 text-gray-800">📊 Totalizadores por Estado</h2>
              
              {/* Totalizador CBM */}
              <div className="mb-4">
                <h3 className="text-md font-semibold mb-2 text-gray-700">📦 CBM</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 font-bold mb-1">APROBADO</p>
                    <p className="text-2xl font-bold text-green-600">{totals.cbm.PURCHASE_APPROVED?.toFixed(2) || '0.00'}</p>
                    <p className="text-xs text-gray-400">CBM</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 font-bold mb-1">CONFIRMADO</p>
                    <p className="text-2xl font-bold text-green-700">{totals.cbm.PURCHASE_CONFIRMED?.toFixed(2) || '0.00'}</p>
                    <p className="text-xs text-gray-400">CBM</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 font-bold mb-1">FABRICADO</p>
                    <p className="text-2xl font-bold text-indigo-600">{totals.cbm.MANUFACTURED?.toFixed(2) || '0.00'}</p>
                    <p className="text-xs text-gray-400">CBM</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 font-bold mb-1">ENVIADO</p>
                    <p className="text-2xl font-bold text-gray-700">{totals.cbm.SHIPPED?.toFixed(2) || '0.00'}</p>
                    <p className="text-xs text-gray-400">CBM</p>
                  </div>
                  <div className="text-center border-l-2 border-gray-200 pl-4">
                    <p className="text-xs text-gray-500 font-bold mb-1">TOTAL</p>
                    <p className="text-3xl font-bold text-blue-600">{totals.cbm.TOTAL?.toFixed(2) || '0.00'}</p>
                    <p className="text-xs text-gray-400">CBM</p>
                  </div>
                </div>
              </div>

              {/* Totalizador USD - Solo visible para admin y chile */}
              {(user.role === 'admin' || user.role === 'chile') && (
                <div className="border-t pt-4">
                  <h3 className="text-md font-semibold mb-2 text-gray-700">💰 Valor USD</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 font-bold mb-1">APROBADO</p>
                      <p className="text-2xl font-bold text-green-600">${totals.usd.PURCHASE_APPROVED?.toFixed(0).toLocaleString() || '0'}</p>
                      <p className="text-xs text-gray-400">USD</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 font-bold mb-1">CONFIRMADO</p>
                      <p className="text-2xl font-bold text-green-700">${totals.usd.PURCHASE_CONFIRMED?.toFixed(0).toLocaleString() || '0'}</p>
                      <p className="text-xs text-gray-400">USD</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 font-bold mb-1">FABRICADO</p>
                      <p className="text-2xl font-bold text-indigo-600">${totals.usd.MANUFACTURED?.toFixed(0).toLocaleString() || '0'}</p>
                      <p className="text-xs text-gray-400">USD</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 font-bold mb-1">ENVIADO</p>
                      <p className="text-2xl font-bold text-gray-700">${totals.usd.SHIPPED?.toFixed(0).toLocaleString() || '0'}</p>
                      <p className="text-xs text-gray-400">USD</p>
                    </div>
                    <div className="text-center border-l-2 border-gray-200 pl-4">
                      <p className="text-xs text-gray-500 font-bold mb-1">TOTAL</p>
                      <p className="text-3xl font-bold text-orange-600">${totals.usd.TOTAL?.toFixed(0).toLocaleString() || '0'}</p>
                      <p className="text-xs text-gray-400">USD</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {filteredProducts.map((product) => {
            const currentStatusInfo = statusConfig[product.status] || { text: 'Desconocido', color: 'bg-gray-400' };
            const currentStatusIndex = workflowOrder.indexOf(product.status);
            const isExpanded = expandedSku === product.sku;
            const diasDeStock = (product.venta_diaria || product.ventaDiaria || 0) > 0 ? ((product.stock_actual || product.stockActual || 0) + (product.enTransito || 0)) / (product.venta_diaria || product.ventaDiaria || 1) : Infinity;

            const detailStages = [
                { title: "🗣️ Solicitud de Cotización", data: product.request_details, statusKey: 'NEEDS_REPLENISHMENT' },
                { title: "📝 Cotización", data: product.quote_details, statusKey: 'QUOTE_REQUESTED' },
                { title: "📈 Análisis", data: product.analysis_details, statusKey: 'QUOTED' },
                { title: "⚖️ Decisión de Compra", data: product.approval_details, statusKey: 'ANALYZING' },
                { title: "✅ Compra Confirmada", data: product.purchase_details, statusKey: 'PURCHASE_APPROVED' },
                { title: "🏭 Fabricación", data: product.manufacturing_details, statusKey: 'PURCHASE_CONFIRMED' },
                { title: "🚢 Embarque", data: product.shipping_details, statusKey: 'MANUFACTURED' }
            ];

            return (
              <div key={product.sku} className="bg-white rounded-lg shadow-md">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-xl font-bold">
                        {product.descripcion || product.description || product.name || 'Sin descripción'}
                        {product.is_additional_replenishment && (
                          <span className="ml-2 text-sm bg-orange-100 text-orange-800 px-2 py-1 rounded-full font-normal">
                            📦 Reposición Adicional
                          </span>
                        )}
                        {product.isNewReplenishment && (
                          <span className="ml-2 text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full font-normal animate-pulse">
                            ✨ Nueva Reposición
                          </span>
                        )}
                      </h2>
                      <p className="text-gray-600">
                        SKU: {product.sku || 'Sin SKU'}
                        {product.original_sku && (
                          <span className="ml-2 text-sm text-gray-500">
                            (Original: {product.original_sku})
                          </span>
                        )}
                      </p>
                      <span className={`text-xs font-bold text-white px-2 py-1 rounded-full ${currentStatusInfo.color}`}>{currentStatusInfo.text}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {(user.role === 'admin' || user.role === 'chile') && (
                        <button 
                          onClick={() => handleToggleDesconsiderado(product.sku, product.desconsiderado || false)}
                          disabled={isUpdating === product.sku}
                          className={`px-3 py-1.5 rounded text-sm font-medium ${
                            product.desconsiderado 
                              ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                              : 'bg-gray-500 hover:bg-gray-600 text-white'
                          } ${isUpdating === product.sku ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={product.desconsiderado ? 'Reactivar SKU en análisis' : 'Desactivar SKU del análisis'}
                        >
                          {product.desconsiderado ? '🔄 Reactivar' : '❌ Desconsiderar'}
                        </button>
                      )}
                      <button onClick={() => toggleExpand(product.sku)} className="bg-gray-700 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-800">{isExpanded ? 'Ocultar' : 'Detalles'}</button>
                    </div>
                  </div>

                  <div className="overflow-x-auto mb-4 border-t pt-4">
                    <div className="flex gap-1 min-w-max">
                    {workflowOrder.slice(0, -1).map((statusKey, index) => {
                      const action = statusConfig[statusKey];
                      // Habilitar el botón si el producto está en este status exactamente
                      // Si está rechazado, habilitar el botón de cotizar para re-cotizar
                      const isStepEnabled = (product.status === statusKey || (product.status === 'QUOTE_REJECTED' && statusKey === 'QUOTE_REQUESTED'));
                      const userHasPermission = user.role === 'admin' || user.role === action.role;
                      const isEnabled = isStepEnabled && userHasPermission && (isUpdating !== product.sku);
                      
                      // Textos más cortos para los botones
                      const shortButtonTexts = {
                        'NO_REPLENISHMENT_NEEDED': 'Sin Acción',
                        'NEEDS_REPLENISHMENT': 'Pedir Cot.',
                        'QUOTE_REQUESTED': 'Cotizar',
                        'QUOTED': 'Analizar',
                        'ANALYZING': 'Aprobar',
                        'PURCHASE_APPROVED': 'Confirmar',
                        'PURCHASE_CONFIRMED': 'Fabricar',
                        'MANUFACTURED': 'Cargar'
                      };
                      
                      return (
                        <button key={statusKey} onClick={() => handleActionClick(product, statusKey)} disabled={!isEnabled}
                          className={`px-2 py-1.5 rounded text-xs font-semibold text-white text-center transition whitespace-nowrap min-w-[80px] ${isEnabled ? (action.role === 'chile' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700') : 'bg-gray-300 cursor-not-allowed'}`}
                          title={isEnabled ? `Siguiente: ${action.buttonText}` : `Paso no disponible o sin permiso. Estado actual: ${currentStatusInfo.text}`}>
                          {shortButtonTexts[statusKey] || action.buttonText}
                        </button>
                      );
                    })}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-6 gap-4 text-center md:text-left">
                    <div><p className="text-xs text-gray-500 font-bold">STOCK ACTUAL</p><p className="text-2xl font-bold">{product.stock_actual || product.stockActual || 0}</p></div>
                    <div><p className="text-xs text-gray-500 font-bold">EN TRÁNSITO</p><p className="text-2xl font-bold text-blue-600">{product.enTransito || 0}</p></div>
                    <div><p className="text-xs text-gray-500 font-bold">CANT. SUGERIDA</p><p className="text-2xl font-bold text-green-600">{product.cantidadSugerida || 0}</p></div>
                    <div><p className="text-xs text-gray-500 font-bold">CANT. COMPRADA</p><p className="text-2xl font-bold text-purple-600">{product.approval_details?.purchaseQuantity || 0}</p></div>
                    <div><p className="text-xs text-gray-500 font-bold">VENTA DIARIA</p><p className="text-lg font-bold">{(product.venta_diaria || product.ventaDiaria || 0).toFixed(1)}</p></div>
                    <div><p className="text-xs text-gray-500 font-bold">DÍAS DE STOCK</p><p className={`text-lg font-bold ${diasDeStock < 30 ? 'text-red-600' : 'text-green-600'}`}>{diasDeStock === Infinity ? '∞' : diasDeStock.toFixed(0)}</p></div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t bg-gray-50 p-6">
                    <h3 className="text-xl font-bold mb-4">Historial y Detalles del Proceso</h3>
                    <div className="grid lg:grid-cols-2 gap-6">
                        {detailStages.map((stage, index) => {
                            const isPending = index > currentStatusIndex;
                            
                            // Definir qué roles pueden ver cada tipo de detalle
                            let allowedRoles = ['admin', 'chile']; // Por defecto solo admin y usuario1
                            
                            // Usuario2 (china) puede ver solo sus propios detalles de cotización
                            if (stage.statusKey === 'QUOTE_REQUESTED') {
                                allowedRoles = ['admin', 'chile', 'china']; // Todos pueden ver cotización
                            }
                            
                            if (product.status === 'QUOTE_REJECTED' && stage.statusKey === 'ANALYZING') {
                                return renderDetailCard(stage.title, stage.data, product, false, allowedRoles);
                            }
                            return renderDetailCard(stage.title, stage.data, product, isPending, allowedRoles);
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