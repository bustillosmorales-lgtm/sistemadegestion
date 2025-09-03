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
    QUOTED_PRICE_MODIFIED: { text: 'Cotizado con Precio Modificado', color: 'bg-orange-500', nextAction: 'ANALYZING', buttonText: 'Re-Analizar', role: 'chile', hasForm: true },
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
    originalPrice: 'Precio Original', newPrice: 'Precio Nuevo', modificationNotes: 'Motivo Modificación',
    modifiedBy: 'Modificado Por', modifiedAt: 'Fecha Modificación', originalSku: 'SKU Original'
};

export default function Dashboard() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useUser();
  const { data, error } = useSWR('/api/analysis', fetcher);
  const { data: reminders } = useSWR('/api/reminders', fetcher);
  const [expandedSku, setExpandedSku] = useState(null);
  const [isUpdating, setIsUpdating] = useState(null);
  const [modalState, setModalState] = useState({ isOpen: false, product: null, status: null });
  
  const [skuFilter, setSkuFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showNoActionItems, setShowNoActionItems] = useState(false);
  
  // Estados para recordatorios
  const [reminderModal, setReminderModal] = useState({ isOpen: false, product: null });
  const [reminderDate, setReminderDate] = useState('');
  const [reminderNotes, setReminderNotes] = useState('');
  const [isCreatingReminder, setIsCreatingReminder] = useState(false);
  
  // Estados para modificación de precio
  const [priceModificationModal, setPriceModificationModal] = useState({ isOpen: false, product: null });
  const [newPrice, setNewPrice] = useState('');
  const [priceCurrency, setPriceCurrency] = useState('RMB');
  const [priceModificationNotes, setPriceModificationNotes] = useState('');
  const [isModifyingPrice, setIsModifyingPrice] = useState(false);
  
  // Estados para modal de recordatorios
  const [remindersModal, setRemindersModal] = useState(false);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user)) {
      router.push('/');
    }
  }, [isAuthenticated, user, isLoading, router]);

  const products = data?.results || [];
  const activeReminders = (Array.isArray(reminders) ? reminders.filter(r => r.is_active) : []);
  
  // Filtrar recordatorios por fecha
  const today = new Date().toISOString().split('T')[0];
  const overdueReminders = activeReminders.filter(r => r.reminder_date < today);
  const todayReminders = activeReminders.filter(r => r.reminder_date === today);
  const upcomingReminders = activeReminders.filter(r => r.reminder_date > today);

  const filteredProducts = useMemo(() => {
    let filtered = products.filter(p => {
        const skuMatch = (p.sku || '').toLowerCase().includes(skuFilter.toLowerCase());
        const nameMatch = (p.descripcion || p.description || '').toLowerCase().includes(nameFilter.toLowerCase());
        const statusMatch = statusFilter ? p.status === statusFilter : true;
        
        // Filtrar productos sin acción si no está habilitada la opción
        const statusesWithoutAction = ['NO_REPLENISHMENT_NEEDED', 'SHIPPED'];
        const hasNoAction = statusesWithoutAction.includes(p.status);
        const noActionFilter = showNoActionItems || !hasNoAction;
        
        return skuMatch && nameMatch && statusMatch && noActionFilter;
    });
    
    // Definir orden de prioridad de status (de más urgente a menos)
    const statusPriority = {
        'NEEDS_REPLENISHMENT': 1,
        'QUOTE_REQUESTED': 2, 
        'QUOTED': 3,
        'QUOTED_PRICE_MODIFIED': 4,
        'ANALYZING': 5,
        'PURCHASE_APPROVED': 6,
        'PURCHASE_CONFIRMED': 7,
        'MANUFACTURED': 8,
        'SHIPPED': 9,
        'NO_REPLENISHMENT_NEEDED': 10,
        'QUOTE_REJECTED': 11
    };
    
    // Ordenar por prioridad de status y luego por impacto de ventas
    filtered.sort((a, b) => {
        // Primer criterio: prioridad de status
        const statusPriorityA = statusPriority[a.status] || 999;
        const statusPriorityB = statusPriority[b.status] || 999;
        
        if (statusPriorityA !== statusPriorityB) {
            return statusPriorityA - statusPriorityB;
        }
        
        // Segundo criterio: impacto de ventas (cantidad sugerida * precio de venta)
        const getImpactValue = (product) => {
            const cantidadSugerida = product.cantidadSugerida || 0;
            const precioVenta = product.analysis_details?.sellingPrice || 0;
            return cantidadSugerida * precioVenta;
        };
        
        const impactA = getImpactValue(a);
        const impactB = getImpactValue(b);
        
        // Ordenar de mayor a menor impacto
        return impactB - impactA;
    });
    
    return filtered;
  }, [products, skuFilter, nameFilter, statusFilter, showNoActionItems]);

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

  // Funciones para recordatorios
  const handleReminderClick = (product) => {
    setReminderModal({ isOpen: true, product });
    setReminderDate('');
    setReminderNotes('');
  };

  const handleCreateReminder = async () => {
    if (!reminderDate) {
      alert('Por favor selecciona una fecha para el recordatorio');
      return;
    }

    setIsCreatingReminder(true);
    try {
      const response = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: reminderModal.product.sku,
          reminder_date: reminderDate,
          notes: reminderNotes
        }),
      });

      if (response.ok) {
        alert('✅ Recordatorio creado exitosamente');
        setReminderModal({ isOpen: false, product: null });
        setReminderDate('');
        setReminderNotes('');
        // Actualizar datos del dashboard
        await mutate('/api/analysis', undefined, { revalidate: true });
        await mutate('/api/reminders', undefined, { revalidate: true });
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error}`);
      }
    } catch (err) {
      console.error('❌ Error al crear recordatorio:', err);
      alert('Error de conexión al crear el recordatorio.');
    } finally {
      setIsCreatingReminder(false);
    }
  };

  const handleDeleteReminder = async (reminderId) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este recordatorio?')) {
      return;
    }

    try {
      const response = await fetch(`/api/reminders?id=${reminderId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('✅ Recordatorio eliminado exitosamente');
        // Actualizar datos
        await mutate('/api/reminders', undefined, { revalidate: true });
        // Si no quedan recordatorios, cerrar el modal
        if (activeReminders.length === 1) {
          setRemindersModal(false);
        }
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error}`);
      }
    } catch (err) {
      console.error('❌ Error al eliminar recordatorio:', err);
      alert('Error de conexión al eliminar el recordatorio.');
    }
  };

  // Funciones para modificación de precio
  const handlePriceModificationClick = (product) => {
    setPriceModificationModal({ isOpen: true, product });
    setNewPrice('');
    setPriceCurrency('RMB');
    setPriceModificationNotes('');
  };

  const handlePriceModification = async () => {
    if (!newPrice || isNaN(parseFloat(newPrice))) {
      alert('Por favor ingresa un precio válido');
      return;
    }

    if (!confirm('¿Estás seguro de modificar el precio? El producto pasará a status "Cotizado con Precio Modificado" para re-análisis.')) {
      return;
    }

    setIsModifyingPrice(true);
    try {
      const response = await fetch('/api/modify-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: priceModificationModal.product.sku,
          originalPrice: priceModificationModal.product.costo_fob_rmb,
          originalCurrency: 'RMB', // Asumiendo que el precio original está en RMB
          newPrice: parseFloat(newPrice),
          newCurrency: priceCurrency,
          notes: priceModificationNotes,
          modifiedBy: user.email || 'china-user'
        }),
      });

      if (response.ok) {
        alert('✅ Precio modificado exitosamente. El producto está listo para re-análisis.');
        setPriceModificationModal({ isOpen: false, product: null });
        setNewPrice('');
        setPriceModificationNotes('');
        // Actualizar datos del dashboard
        await mutate('/api/analysis', undefined, { revalidate: true });
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error}`);
      }
    } catch (err) {
      console.error('❌ Error al modificar precio:', err);
      alert('Error de conexión al modificar el precio.');
    } finally {
      setIsModifyingPrice(false);
    }
  };

  const toggleExpand = (sku) => {
    setExpandedSku(expandedSku === sku ? null : sku);
  };

  const exportPurchasesToExcel = async () => {
    try {
      const response = await fetch('/api/export-purchases');
      const result = await response.json();

      if (!response.ok || !result.success) {
        alert('Error al obtener datos de compras: ' + (result.error || 'Error desconocido'));
        return;
      }

      if (!result.data || result.data.length === 0) {
        alert('No hay datos de compras para exportar');
        return;
      }

      // Crear el libro de trabajo
      const wb = XLSX.utils.book_new();
      
      // Hoja de datos de compras
      const ws = XLSX.utils.json_to_sheet(result.data);
      
      // Configurar anchos de columnas
      const colWidths = [
        { wch: 12 }, // ID Compra
        { wch: 15 }, // SKU
        { wch: 40 }, // Descripción Producto
        { wch: 15 }, // Cantidad Comprada
        { wch: 15 }, // Fecha Compra
        { wch: 18 }, // Fecha Llegada Estimada
        { wch: 18 }, // Fecha Llegada Real
        { wch: 15 }, // Status Compra
        { wch: 15 }, // Costo FOB (RMB)
        { wch: 12 }, // CBM Unitario
        { wch: 12 }, // CBM Total
        { wch: 20 }, // Proveedor
        { wch: 15 }, // Número Orden
        { wch: 30 }, // Notas
        { wch: 20 }, // Creado
        { wch: 20 }  // Actualizado
      ];
      
      ws['!cols'] = colWidths;
      XLSX.utils.book_append_sheet(wb, ws, 'Compras');

      // Hoja de estadísticas
      if (result.stats) {
        const statsData = Object.entries(result.stats).map(([key, value]) => ({
          'Concepto': key,
          'Valor': value
        }));
        
        const statsWs = XLSX.utils.json_to_sheet(statsData);
        statsWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, statsWs, 'Estadísticas');
      }

      // Generar nombre del archivo
      const now = new Date();
      const timestamp = now.toISOString().split('T')[0] + '_' + 
                       now.toTimeString().split(':').slice(0,2).join('-');
      const filename = `Compras_BD_${timestamp}.xlsx`;

      // Descargar el archivo
      XLSX.writeFile(wb, filename);

    } catch (error) {
      console.error('Error exportando compras:', error);
      alert('Error al exportar datos de compras. Inténtalo de nuevo.');
    }
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

    if (title.includes("Modificación de Precio")) {
        const history = product.price_modification_history || [];
        return (
            <div className="bg-orange-50 p-4 rounded-lg shadow-sm border-l-4 border-orange-500 col-span-full lg:col-span-1">
                <h4 className="font-bold text-gray-800 mb-2">{title}</h4>
                <div className="space-y-2 text-sm">
                    <div className="bg-red-100 p-2 rounded">
                        <div className="flex justify-between"><span className="text-gray-600">Precio Anterior:</span><span className="font-mono font-bold">{details.previousPrice} {details.previousCurrency}</span></div>
                    </div>
                    <div className="bg-green-100 p-2 rounded">
                        <div className="flex justify-between"><span className="text-gray-600">Precio Actual:</span><span className="font-mono font-bold">{details.newPrice} {details.newCurrency}</span></div>
                        {details.newCurrency === 'USD' && details.conversionRate && (
                            <div className="flex justify-between"><span className="text-gray-600">Precio en RMB:</span><span className="font-mono">{details.newPriceInRMB?.toFixed(2)} RMB</span></div>
                        )}
                    </div>
                    <div className="flex justify-between"><span className="text-gray-600">Motivo:</span><span className="text-xs">{details.modificationNotes}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Modificado por:</span><span className="font-mono">{details.modifiedBy}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Fecha:</span><span className="font-mono">{formatDateTime(details.modifiedAt)}</span></div>
                    
                    {history.length > 1 && (
                        <div className="mt-3 pt-2 border-t border-orange-300">
                            <h5 className="font-semibold text-gray-700 mb-1">Historial de Modificaciones ({history.length})</h5>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {history.slice().reverse().map((mod, index) => (
                                    <div key={mod.modificationId} className="bg-white p-2 rounded text-xs">
                                        <div className="flex justify-between">
                                            <span className="font-semibold">#{history.length - index}</span>
                                            <span>{formatDateTime(mod.modifiedAt)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>{mod.previousPrice} → {mod.newPrice} {mod.newCurrency}</span>
                                            <span className="text-gray-500">{mod.modifiedBy}</span>
                                        </div>
                                        {mod.modificationNotes && (
                                            <div className="text-gray-600 mt-1">{mod.modificationNotes}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

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
      
      {/* Modal de Recordatorio */}
      {reminderModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">⏰ Programar Recordatorio</h2>
            <p className="text-gray-600 mb-4">
              <strong>SKU:</strong> {reminderModal.product?.sku}<br/>
              <strong>Producto:</strong> {reminderModal.product?.descripcion}
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Fecha del Recordatorio
              </label>
              <input
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📝 Notas (Opcional)
              </label>
              <textarea
                value={reminderNotes}
                onChange={(e) => setReminderNotes(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows="3"
                placeholder="Agregar notas sobre por qué programar este recordatorio..."
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setReminderModal({ isOpen: false, product: null })}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
              >
                ❌ Cancelar
              </button>
              <button
                onClick={handleCreateReminder}
                disabled={isCreatingReminder || !reminderDate}
                className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isCreatingReminder ? '⏳ Creando...' : '✅ Crear Recordatorio'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Modificación de Precio */}
      {priceModificationModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">💰 Modificar Precio de Costo</h2>
            <p className="text-gray-600 mb-4">
              <strong>SKU:</strong> {priceModificationModal.product?.sku}<br/>
              <strong>Producto:</strong> {priceModificationModal.product?.descripcion}<br/>
              <strong>Precio Actual:</strong> {priceModificationModal.product?.costo_fob_rmb} RMB
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💵 Nuevo Precio
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="flex-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="0.00"
                  required
                />
                <select
                  value={priceCurrency}
                  onChange={(e) => setPriceCurrency(e.target.value)}
                  className="p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="RMB">RMB</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📝 Motivo de la Modificación
              </label>
              <textarea
                value={priceModificationNotes}
                onChange={(e) => setPriceModificationNotes(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                rows="3"
                placeholder="Explica el motivo del cambio de precio..."
                required
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setPriceModificationModal({ isOpen: false, product: null })}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
              >
                ❌ Cancelar
              </button>
              <button
                onClick={handlePriceModification}
                disabled={isModifyingPrice || !newPrice || !priceModificationNotes}
                className="flex-1 bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isModifyingPrice ? '⏳ Modificando...' : '✅ Modificar Precio'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Recordatorios */}
      {remindersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">⏰ Recordatorios de Reposición ({activeReminders.length})</h2>
              <button 
                onClick={() => setRemindersModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ❌
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {activeReminders.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📅</div>
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No hay recordatorios activos</h3>
                  <p className="text-gray-500">Los recordatorios aparecerán aquí cuando se programen.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Recordatorios vencidos */}
                  {overdueReminders.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-red-600 mb-3 flex items-center gap-2">
                        🚨 Vencidos ({overdueReminders.length})
                      </h3>
                      <div className="grid gap-3">
                        {overdueReminders.map(reminder => (
                          <div key={reminder.id} className="bg-red-50 border border-red-200 rounded-lg p-4 flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-semibold text-gray-800">{reminder.sku}</div>
                              <div className="text-sm text-gray-600 mt-1">{reminder.product_description}</div>
                              <div className="text-sm text-red-600 mt-1">📅 Fecha: {formatDate(reminder.reminder_date)}</div>
                              {reminder.notes && (
                                <div className="text-xs text-gray-500 mt-2 bg-gray-100 p-2 rounded">{reminder.notes}</div>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteReminder(reminder.id)}
                              className="bg-red-500 text-white px-3 py-1.5 rounded text-sm hover:bg-red-600 ml-3"
                              title="Eliminar recordatorio"
                            >
                              🗑️ Eliminar
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Recordatorios de hoy */}
                  {todayReminders.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-orange-600 mb-3 flex items-center gap-2">
                        📅 Hoy ({todayReminders.length})
                      </h3>
                      <div className="grid gap-3">
                        {todayReminders.map(reminder => (
                          <div key={reminder.id} className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-semibold text-gray-800">{reminder.sku}</div>
                              <div className="text-sm text-gray-600 mt-1">{reminder.product_description}</div>
                              {reminder.notes && (
                                <div className="text-xs text-gray-500 mt-2 bg-gray-100 p-2 rounded">{reminder.notes}</div>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteReminder(reminder.id)}
                              className="bg-orange-500 text-white px-3 py-1.5 rounded text-sm hover:bg-orange-600 ml-3"
                              title="Eliminar recordatorio"
                            >
                              🗑️ Eliminar
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Recordatorios próximos */}
                  {upcomingReminders.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-blue-600 mb-3 flex items-center gap-2">
                        📋 Próximos ({upcomingReminders.length})
                      </h3>
                      <div className="grid gap-3">
                        {upcomingReminders.map(reminder => (
                          <div key={reminder.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-semibold text-gray-800">{reminder.sku}</div>
                              <div className="text-sm text-gray-600 mt-1">{reminder.product_description}</div>
                              <div className="text-sm text-blue-600 mt-1">📅 Fecha: {formatDate(reminder.reminder_date)}</div>
                              {reminder.notes && (
                                <div className="text-xs text-gray-500 mt-2 bg-gray-100 p-2 rounded">{reminder.notes}</div>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteReminder(reminder.id)}
                              className="bg-blue-500 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-600 ml-3"
                              title="Eliminar recordatorio"
                            >
                              🗑️ Eliminar
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setRemindersModal(false)}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-gray-100 min-h-screen">
        <div className="sticky top-0 z-20 bg-gray-100/80 backdrop-blur-md shadow-sm p-4">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-2xl font-bold">Dashboard de Gestión</h1>
                    <div className="flex items-center gap-4">
                        <p className="text-sm text-gray-600">Sesión: <span className="font-semibold">{user.name}</span> ({user.role}) - {filteredProducts.length} productos</p>
                        <button
                            onClick={() => setShowNoActionItems(!showNoActionItems)}
                            className={`text-xs px-3 py-1 rounded-full transition-colors ${
                                showNoActionItems 
                                    ? 'bg-gray-600 text-white hover:bg-gray-700' 
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                            title={showNoActionItems ? 'Ocultar productos sin acción' : 'Mostrar productos sin acción'}
                        >
                            {showNoActionItems ? '👁️ Ocultar Sin Acción' : '👁️‍🗨️ Mostrar Sin Acción'}
                        </button>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                    {user.role === 'admin' && (
                        <Link href="/users">
                            <button className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700" title="Usuarios">👥</button>
                        </Link>
                    )}
                    {(user.role === 'admin' || user.role === 'chile') && (
                        <>
                            <Link href="/config">
                                <button className="bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700" title="Configurar">⚙️</button>
                            </Link>
                            <Link href="/bulk-upload">
                                <button className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700" title="Cargar Datos">📤</button>
                            </Link>
                            <Link href="/skus-desconsiderados">
                                <button className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700" title="SKUs Desconsiderados">🚫</button>
                            </Link>
                            <button 
                                onClick={() => setRemindersModal(true)}
                                className="bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 relative"
                                title="Recordatorios"
                            >
                                ⏰
                                {activeReminders.length > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs w-4 h-4 flex items-center justify-center">{activeReminders.length}</span>
                                )}
                            </button>
                        </>
                    )}
                    {(user.role === 'admin' || user.role === 'china' || user.role === 'chile') && (
                        <Link href="/contenedores">
                            <button className="bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700" title="Contenedores">🚢</button>
                        </Link>
                    )}
                    <Link href="/account-settings">
                        <button className="bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600" title="Configuración de Cuenta">⚙️</button>
                    </Link>
                    <button 
                        onClick={() => {
                            logout();
                            router.push('/');
                        }}
                        className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                        title="Cerrar Sesión"
                    >
                        🚪
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
                <div className="flex gap-2">
                  <button onClick={exportToExcel} className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 text-sm flex-1">📊 Exportar Inventario</button>
                  {(user.role === 'admin' || user.role === 'chile') && (
                    <button onClick={exportPurchasesToExcel} className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 text-sm flex-1">📦 Exportar Compras</button>
                  )}
                </div>
            </div>
        </div>

        {/* Panel de totalizadores compacto */}
        <div className="sticky top-0 z-30 bg-gray-100/95 backdrop-blur-md shadow-sm">
          <div className="p-3">
            <div className="bg-white rounded-lg shadow-md p-4">
              <h2 className="text-md font-semibold mb-3 text-gray-800">📊 Totalizadores por Estado</h2>
              
              {/* Totalizador CBM compacto */}
              <div className="mb-3">
                <h3 className="text-sm font-medium mb-2 text-gray-700">📦 CBM</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  <div>
                    <p className="text-xs text-gray-500 font-bold">APROBADO</p>
                    <p className="text-lg font-bold text-green-600">{totals.cbm.PURCHASE_APPROVED?.toFixed(1) || '0.0'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-bold">CONFIRMADO</p>
                    <p className="text-lg font-bold text-green-700">{totals.cbm.PURCHASE_CONFIRMED?.toFixed(1) || '0.0'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-bold">FABRICADO</p>
                    <p className="text-lg font-bold text-indigo-600">{totals.cbm.MANUFACTURED?.toFixed(1) || '0.0'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-bold">ENVIADO</p>
                    <p className="text-lg font-bold text-gray-700">{totals.cbm.SHIPPED?.toFixed(1) || '0.0'}</p>
                  </div>
                  <div className="border-l-2 border-gray-200 pl-2">
                    <p className="text-xs text-gray-500 font-bold">TOTAL</p>
                    <p className="text-xl font-bold text-blue-600">{totals.cbm.TOTAL?.toFixed(1) || '0.0'}</p>
                  </div>
                </div>
              </div>

              {/* Totalizador USD compacto - Solo visible para admin y chile */}
              {(user.role === 'admin' || user.role === 'chile') && (
                <div className="border-t pt-3">
                  <h3 className="text-sm font-medium mb-2 text-gray-700">💰 Valor USD</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                    <div>
                      <p className="text-xs text-gray-500 font-bold">APROBADO</p>
                      <p className="text-lg font-bold text-green-600">${totals.usd.PURCHASE_APPROVED?.toFixed(0).toLocaleString() || '0'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-bold">CONFIRMADO</p>
                      <p className="text-lg font-bold text-green-700">${totals.usd.PURCHASE_CONFIRMED?.toFixed(0).toLocaleString() || '0'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-bold">FABRICADO</p>
                      <p className="text-lg font-bold text-indigo-600">${totals.usd.MANUFACTURED?.toFixed(0).toLocaleString() || '0'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-bold">ENVIADO</p>
                      <p className="text-lg font-bold text-gray-700">${totals.usd.SHIPPED?.toFixed(0).toLocaleString() || '0'}</p>
                    </div>
                    <div className="border-l-2 border-gray-200 pl-2">
                      <p className="text-xs text-gray-500 font-bold">TOTAL</p>
                      <p className="text-xl font-bold text-orange-600">${totals.usd.TOTAL?.toFixed(0).toLocaleString() || '0'}</p>
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
            
            // Calcular impacto de ventas para mostrar indicador
            const cantidadSugerida = product.cantidadSugerida || 0;
            const precioVenta = product.analysis_details?.sellingPrice || 0;
            const impactoVentas = cantidadSugerida * precioVenta;
            
            // Determinar prioridad visual
            const getPriorityIndicator = (status) => {
                const highPriority = ['NEEDS_REPLENISHMENT', 'QUOTE_REQUESTED'];
                const mediumPriority = ['QUOTED', 'QUOTED_PRICE_MODIFIED', 'ANALYZING'];
                const lowPriority = ['PURCHASE_APPROVED', 'PURCHASE_CONFIRMED', 'MANUFACTURED'];
                
                if (highPriority.includes(status)) return { icon: '🔥', color: 'text-red-600', label: 'Alta' };
                if (mediumPriority.includes(status)) return { icon: '⚡', color: 'text-orange-600', label: 'Media' };
                if (lowPriority.includes(status)) return { icon: '📋', color: 'text-blue-600', label: 'Baja' };
                return { icon: '✅', color: 'text-gray-600', label: 'Completado' };
            };
            
            const priority = getPriorityIndicator(product.status);

            const detailStages = [
                { title: "🗣️ Solicitud de Cotización", data: product.request_details, statusKey: 'NEEDS_REPLENISHMENT' },
                { title: "📝 Cotización", data: product.quote_details, statusKey: 'QUOTE_REQUESTED' },
                { title: "📈 Análisis", data: product.analysis_details, statusKey: 'QUOTED' },
                { title: "💰 Modificación de Precio", data: product.price_modification_details, statusKey: 'QUOTED_PRICE_MODIFIED' },
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
                      <div className="flex items-center gap-3 text-gray-600">
                        <span className="text-lg" title={`Prioridad ${priority.label}`}>{priority.icon}</span>
                        <span>SKU: {product.sku || 'Sin SKU'}</span>
                        {product.original_sku && (
                          <span className="text-sm text-gray-500">
                            (Original: {product.original_sku})
                          </span>
                        )}
                        {impactoVentas > 0 && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full" title="Impacto estimado de ventas">
                            💰 ${impactoVentas.toLocaleString('es-CL')}
                          </span>
                        )}
                      </div>
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
                      {(user.role === 'admin' || user.role === 'chile') && (
                        <button 
                          onClick={() => handleReminderClick(product)}
                          className="bg-purple-600 text-white px-3 py-1.5 rounded text-sm hover:bg-purple-700"
                          title="Programar recordatorio de reposición"
                        >
                          ⏰ Recuérdame
                        </button>
                      )}
                      {user.role === 'china' && ['PURCHASE_APPROVED', 'PURCHASE_CONFIRMED', 'MANUFACTURED', 'SHIPPED'].includes(product.status) && (
                        <button 
                          onClick={() => handlePriceModificationClick(product)}
                          className="bg-orange-600 text-white px-3 py-1.5 rounded text-sm hover:bg-orange-700"
                          title="Modificar precio de costo"
                        >
                          💰 Modificar Precio
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