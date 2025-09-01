import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useMemo, useEffect } from 'react';
import { useUser } from '../components/UserContext';
import { supabase } from '../lib/supabaseClient';

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

export default function Contenedores() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useUser();
  const { data: containers, error: containersError } = useSWR('/api/containers', fetcher);
  const { data: productsData, error: productsError } = useSWR('/api/analysis', fetcher);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingContainer, setEditingContainer] = useState(null);
  const [newContainer, setNewContainer] = useState({
    container_number: '',
    container_type: 'STD',
    max_cbm: 68,
    departure_port: '',
    arrival_port: '',
    estimated_departure: '',
    estimated_arrival: '',
    shipping_company: '',
    notes: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isProcessingArrival, setIsProcessingArrival] = useState(null);
  
  const [containerFilter, setContainerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user)) {
      router.push('/');
    }
  }, [isAuthenticated, user, isLoading, router]);

  const products = productsData?.results || [];
  
  // Enriquecer contenedores con información de productos
  const enrichedContainers = useMemo(() => {
    if (!containers) return [];
    
    return containers.map(container => {
      // Encontrar productos asignados a este contenedor
      const assignedProducts = products.filter(product => 
        product.shipping_details?.containerNumber === container.container_number
      );
      
      // Calcular totales
      const totalProducts = assignedProducts.length;
      const totalCBM = assignedProducts.reduce((sum, product) => sum + (product.cbm || 0), 0);
      const utilizationPercent = container.max_cbm > 0 ? (totalCBM / container.max_cbm) * 100 : 0;
      
      return {
        ...container,
        assigned_products: assignedProducts,
        total_products: totalProducts,
        total_cbm_used: totalCBM,
        utilization_percent: utilizationPercent,
        remaining_cbm: container.max_cbm - totalCBM
      };
    });
  }, [containers, products]);

  const filteredContainers = useMemo(() => {
    return enrichedContainers.filter(container => {
        const containerMatch = container.container_number.toLowerCase().includes(containerFilter.toLowerCase());
        const statusMatch = statusFilter ? container.status === statusFilter : true;
        return containerMatch && statusMatch;
    });
  }, [enrichedContainers, containerFilter, statusFilter]);

  const handleCreateContainer = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    
    try {
      const res = await fetch('/api/containers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContainer),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        alert(`Error: ${errorData.error}`);
      } else {
        await mutate('/api/containers');
        setShowCreateModal(false);
        setNewContainer({
          container_number: '',
          container_type: 'STD',
          max_cbm: 68,
          departure_port: '',
          arrival_port: '',
          estimated_departure: '',
          estimated_arrival: '',
          shipping_company: '',
          notes: ''
        });
      }
    } catch (err) {
      console.error('Error creando contenedor:', err);
      alert('Error de conexión al crear el contenedor.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditContainer = (container) => {
    setEditingContainer({
      ...container,
      estimated_departure: container.estimated_departure ? container.estimated_departure.split('T')[0] : '',
      estimated_arrival: container.estimated_arrival ? container.estimated_arrival.split('T')[0] : '',
      actual_arrival_date: container.actual_arrival_date ? container.actual_arrival_date.split('T')[0] : ''
    });
    setShowEditModal(true);
  };

  const handleUpdateContainer = async (e) => {
    e.preventDefault();
    setIsEditing(true);
    
    try {
      const updateData = { ...editingContainer };
      delete updateData.id;
      delete updateData.created_at;
      delete updateData.updated_at;
      delete updateData.assigned_products;
      delete updateData.total_products;
      delete updateData.total_cbm_used;
      delete updateData.utilization_percent;
      delete updateData.remaining_cbm;
      
      const res = await fetch(`/api/containers?id=${editingContainer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        alert(`Error: ${errorData.error}`);
      } else {
        await mutate('/api/containers');
        if (updateData.actual_arrival_date) {
          await mutate('/api/analysis'); // Actualizar análisis si se agregó fecha real
        }
        setShowEditModal(false);
        setEditingContainer(null);
        alert('Contenedor actualizado exitosamente.');
      }
    } catch (err) {
      console.error('Error actualizando contenedor:', err);
      alert('Error de conexión al actualizar el contenedor.');
    } finally {
      setIsEditing(false);
    }
  };

  const handleRegisterArrival = async (containerNumber) => {
    const actualDate = prompt('Ingrese la fecha efectiva de llegada (YYYY-MM-DD):');
    if (!actualDate) return;
    
    setIsProcessingArrival(containerNumber);
    
    try {
      const res = await fetch(`/api/containers?container_number=${containerNumber}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          actual_arrival_date: actualDate,
          status: 'DELIVERED'
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        alert(`Error: ${errorData.error}`);
      } else {
        await mutate('/api/containers');
        await mutate('/api/analysis'); // Actualizar análisis también
        alert('Llegada registrada exitosamente. Los productos han sido agregados al stock y reiniciaron su flujo.');
      }
    } catch (err) {
      console.error('Error registrando llegada:', err);
      alert('Error de conexión al registrar la llegada.');
    } finally {
      setIsProcessingArrival(null);
    }
  };

  if (isLoading) return <div className="p-8 text-center">Cargando...</div>;
  if (!isAuthenticated || !user) return <div className="p-8 text-center">No autorizado</div>;

  // Solo admin y china pueden gestionar contenedores
  if (user.role !== 'admin' && user.role !== 'china') {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Acceso Denegado</h1>
        <p className="text-gray-600 mb-4">No tienes permisos para ver esta página.</p>
        <Link href="/dashboard"><button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Volver al Dashboard</button></Link>
      </div>
    );
  }

  const statusConfig = {
    'CREATED': { text: 'Creado', color: 'bg-blue-500' },
    'IN_USE': { text: 'En Uso', color: 'bg-yellow-500' },
    'SHIPPED': { text: 'Enviado', color: 'bg-green-500' },
    'DELIVERED': { text: 'Entregado', color: 'bg-gray-500' }
  };

  return (
    <>
      {/* Modal de Editar Contenedor */}
      {showEditModal && editingContainer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Editar Contenedor: {editingContainer.container_number}</h2>
            <form onSubmit={handleUpdateContainer} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select 
                    value={editingContainer.status}
                    onChange={(e) => setEditingContainer({...editingContainer, status: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="CREATED">Creado</option>
                    <option value="IN_USE">En Uso</option>
                    <option value="SHIPPED">Enviado</option>
                    <option value="DELIVERED">Entregado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select 
                    value={editingContainer.container_type}
                    onChange={(e) => setEditingContainer({...editingContainer, container_type: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="STD">Estándar (20')</option>
                    <option value="HC">High Cube (40')</option>
                    <option value="RF">Refrigerado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CBM Máximo</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={editingContainer.max_cbm}
                    onChange={(e) => setEditingContainer({...editingContainer, max_cbm: parseFloat(e.target.value)})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Naviera</label>
                  <input 
                    type="text" 
                    value={editingContainer.shipping_company || ''}
                    onChange={(e) => setEditingContainer({...editingContainer, shipping_company: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Puerto Salida</label>
                  <input 
                    type="text" 
                    value={editingContainer.departure_port || ''}
                    onChange={(e) => setEditingContainer({...editingContainer, departure_port: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Puerto Llegada</label>
                  <input 
                    type="text" 
                    value={editingContainer.arrival_port || ''}
                    onChange={(e) => setEditingContainer({...editingContainer, arrival_port: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Salida Estimada</label>
                  <input 
                    type="date" 
                    value={editingContainer.estimated_departure || ''}
                    onChange={(e) => setEditingContainer({...editingContainer, estimated_departure: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Llegada Estimada</label>
                  <input 
                    type="date" 
                    value={editingContainer.estimated_arrival || ''}
                    onChange={(e) => setEditingContainer({...editingContainer, estimated_arrival: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="text-red-600">📅 Fecha Real de Llegada</span>
                    <span className="text-xs text-gray-500 ml-2">(Completar cuando llegue realmente)</span>
                  </label>
                  <input 
                    type="date" 
                    value={editingContainer.actual_arrival_date || ''}
                    onChange={(e) => setEditingContainer({...editingContainer, actual_arrival_date: e.target.value})}
                    className="w-full p-2 border border-red-300 rounded-md bg-red-50"
                  />
                  {editingContainer.actual_arrival_date && (
                    <p className="text-xs text-red-600 mt-1">
                      ⚠️ Al guardar, se procesarán los productos y desaparecerán del dashboard
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea 
                  value={editingContainer.notes || ''}
                  onChange={(e) => setEditingContainer({...editingContainer, notes: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  rows="3"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => {setShowEditModal(false); setEditingContainer(null);}} 
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isEditing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isEditing ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Crear Contenedor */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
            <h2 className="text-xl font-bold mb-4">Crear Nuevo Contenedor</h2>
            <form onSubmit={handleCreateContainer} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de Contenedor</label>
                  <input 
                    type="text" 
                    required 
                    value={newContainer.container_number}
                    onChange={(e) => setNewContainer({...newContainer, container_number: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="Ej: TCLU1234567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select 
                    value={newContainer.container_type}
                    onChange={(e) => setNewContainer({...newContainer, container_type: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="STD">Estándar (20')</option>
                    <option value="HC">High Cube (40')</option>
                    <option value="RF">Refrigerado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CBM Máximo</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={newContainer.max_cbm}
                    onChange={(e) => setNewContainer({...newContainer, max_cbm: parseFloat(e.target.value)})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Naviera</label>
                  <input 
                    type="text" 
                    value={newContainer.shipping_company}
                    onChange={(e) => setNewContainer({...newContainer, shipping_company: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="Ej: COSCO, MSC, CMA CGM"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Puerto Salida</label>
                  <input 
                    type="text" 
                    value={newContainer.departure_port}
                    onChange={(e) => setNewContainer({...newContainer, departure_port: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="Ej: Shanghai, Ningbo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Puerto Llegada</label>
                  <input 
                    type="text" 
                    value={newContainer.arrival_port}
                    onChange={(e) => setNewContainer({...newContainer, arrival_port: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="Ej: Valparaíso, San Antonio"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Salida Estimada</label>
                  <input 
                    type="date" 
                    value={newContainer.estimated_departure}
                    onChange={(e) => setNewContainer({...newContainer, estimated_departure: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Llegada Estimada</label>
                  <input 
                    type="date" 
                    value={newContainer.estimated_arrival}
                    onChange={(e) => setNewContainer({...newContainer, estimated_arrival: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea 
                  value={newContainer.notes}
                  onChange={(e) => setNewContainer({...newContainer, notes: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  rows="3"
                  placeholder="Notas adicionales..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)} 
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isCreating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isCreating ? 'Creando...' : 'Crear Contenedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-gray-100 min-h-screen">
        <div className="sticky top-0 z-20 bg-gray-100/80 backdrop-blur-md shadow-sm p-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold">Gestión de Contenedores</h1>
              <p className="text-sm text-gray-600">Contenedores y su utilización ({filteredContainers.length} total)</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowCreateModal(true)}
                className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 text-sm"
              >
                + Crear Contenedor
              </button>
              <Link href="/dashboard"><button className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 text-sm">← Volver al Dashboard</button></Link>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
            <input 
              type="text" 
              placeholder="Buscar por número de contenedor..." 
              value={containerFilter} 
              onChange={e => setContainerFilter(e.target.value)} 
              className="w-full border rounded-md p-2 text-sm" 
            />
            <select 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)} 
              className="w-full border rounded-md p-2 text-sm bg-white"
            >
              <option value="">Todos los estados</option>
              {Object.entries(statusConfig).map(([key, { text }]) => 
                <option key={key} value={key}>{text}</option>
              )}
            </select>
          </div>
        </div>

        <div className="p-4">
          {containersError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600">Error cargando contenedores.</p>
            </div>
          ) : !containers ? (
            <div className="text-center py-8">Cargando contenedores...</div>
          ) : filteredContainers.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <h2 className="text-xl font-bold text-gray-800 mb-2">No hay contenedores</h2>
              <p className="text-gray-600 mb-4">Crea tu primer contenedor para comenzar.</p>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                + Crear Primer Contenedor
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredContainers.map((container) => {
                const statusInfo = statusConfig[container.status] || { text: 'Desconocido', color: 'bg-gray-400' };
                
                return (
                  <div key={container.id} className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h2 className="text-xl font-bold">{container.container_number}</h2>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                          <span>Tipo: {container.container_type}</span>
                          <span>Capacidad: {container.max_cbm} CBM</span>
                          <span>Naviera: {container.shipping_company || 'N/A'}</span>
                        </div>
                        <span className={`text-xs font-bold text-white px-2 py-1 rounded-full ${statusInfo.color} mt-2 inline-block`}>
                          {statusInfo.text}
                        </span>
                      </div>
                      <div className="text-right space-y-2">
                        <div>
                          <div className="text-2xl font-bold text-blue-600">{container.utilization_percent.toFixed(1)}%</div>
                          <div className="text-xs text-gray-500">Utilización</div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleEditContainer(container)}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                          >
                            ✏️ Editar
                          </button>
                          {container.status === 'SHIPPED' && (
                            <button
                              onClick={() => handleRegisterArrival(container.container_number)}
                              disabled={isProcessingArrival === container.container_number}
                              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                            >
                              {isProcessingArrival === container.container_number ? 'Procesando...' : '📅 Registrar Llegada'}
                            </button>
                          )}
                        </div>
                        {container.status === 'DELIVERED' && (
                          <div className="text-xs text-green-600 font-medium">
                            ✅ Entregado {container.actual_arrival_date && `el ${formatDate(container.actual_arrival_date)}`}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Barra de progreso de utilización */}
                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Uso CBM: {container.total_cbm_used.toFixed(2)} / {container.max_cbm}</span>
                        <span>Disponible: {container.remaining_cbm.toFixed(2)} CBM</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full ${container.utilization_percent > 90 ? 'bg-red-500' : container.utilization_percent > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(container.utilization_percent, 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Estadísticas rápidas */}
                    <div className="grid md:grid-cols-4 gap-4 text-center mb-4">
                      <div>
                        <div className="text-lg font-bold text-blue-600">{container.total_products}</div>
                        <div className="text-xs text-gray-500">Productos</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-green-600">{container.total_cbm_used.toFixed(2)}</div>
                        <div className="text-xs text-gray-500">CBM Usados</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-600">{formatDate(container.estimated_departure)}</div>
                        <div className="text-xs text-gray-500">Salida Est.</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-purple-600">{formatDate(container.estimated_arrival)}</div>
                        <div className="text-xs text-gray-500">Llegada Est.</div>
                      </div>
                    </div>

                    {/* Lista de productos asignados */}
                    {container.assigned_products.length > 0 && (
                      <div className="border-t pt-4">
                        <h4 className="font-semibold text-gray-800 mb-2">Productos Asignados:</h4>
                        <div className="grid md:grid-cols-2 gap-2 text-sm">
                          {container.assigned_products.map((product, index) => (
                            <div key={index} className="flex justify-between bg-gray-50 p-2 rounded">
                              <span>{product.sku}</span>
                              <span className="font-mono">{product.cbm} CBM</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Información adicional */}
                    {(container.departure_port || container.arrival_port) && (
                      <div className="border-t pt-4 mt-4 text-sm text-gray-600">
                        <div className="grid md:grid-cols-2 gap-4">
                          {container.departure_port && <div><strong>Puerto Salida:</strong> {container.departure_port}</div>}
                          {container.arrival_port && <div><strong>Puerto Llegada:</strong> {container.arrival_port}</div>}
                        </div>
                        {container.notes && (
                          <div className="mt-2"><strong>Notas:</strong> {container.notes}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}