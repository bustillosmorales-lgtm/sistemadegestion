// pages/config.js
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

const CostRow = ({ name, value, onChange, onRemove }) => (
    <div className="flex items-center gap-2">
        <input type="text" value={name} className="w-full border rounded-lg p-2 bg-gray-100" readOnly />
        <input type="number" value={value} onChange={onChange} className="w-full border rounded-lg p-2" />
        <button type="button" onClick={onRemove} className="bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600">-</button>
    </div>
);

const AddCostForm = ({ onAdd }) => {
    const [name, setName] = useState('');
    const [value, setValue] = useState(0);

    const handleAdd = () => {
        if (name.trim()) {
            onAdd(name.trim().replace(/\s+/g, '_'), value); // Reemplaza espacios con guiones bajos para usar como clave
            setName('');
            setValue(0);
        } else {
            alert('El nombre del costo no puede estar vacío.');
        }
    };

    return (
        <div className="flex items-center gap-2 border-t pt-4 mt-4">
            <input type="text" placeholder="Nombre del nuevo costo" value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg p-2" />
            <input type="number" placeholder="Valor" value={value} onChange={e => setValue(parseFloat(e.target.value) || 0)} className="w-full border rounded-lg p-2" />
            <button type="button" onClick={handleAdd} className="bg-green-500 text-white px-3 py-1 rounded-lg hover:bg-green-600">+</button>
        </div>
    );
};


export default function ConfigPage() {
  const router = useRouter();
  const [config, setConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const data = await response.json();
          setConfig(data.config);
        }
      } catch (error) {
        console.error('Error:', error);
        setMessage('Error al cargar la configuración');
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      if (response.ok) {
        setMessage('✅ Configuración guardada exitosamente. Redirigiendo...');
        setTimeout(() => router.push('/dashboard'), 2000);
      } else {
        setMessage('❌ Error al guardar configuración');
      }
    } catch (error) {
      setMessage('❌ Error de conexión al guardar');
    }
  };

  const handleChange = (category, field, value) => {
    setConfig(prev => ({ ...prev, [category]: { ...prev[category], [field]: value } }));
  };
  
  const handleSimpleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleAddCost = (category, name, value) => {
    if (config[category][name]) {
        alert('Ya existe un costo con ese nombre.');
        return;
    }
    handleChange(category, name, value);
  };

  const handleRemoveCost = (category, name) => {
    setConfig(prev => {
        const newCategory = { ...prev[category] };
        delete newCategory[name];
        return { ...prev, [category]: newCategory };
    });
  };

  if (isLoading || !config) return <div className="p-8 text-center">Cargando configuración...</div>;

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <button onClick={() => router.push('/dashboard')} className="text-blue-600 hover:text-blue-800 mb-4">← Volver al Dashboard</button>
          <h1 className="text-3xl font-bold">Configuración Detallada de Costos</h1>
        </div>
        {message && <div className={`mb-6 p-4 rounded-lg ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{message}</div>}
        <div className="bg-white rounded-lg shadow-md p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">📈 Inventario y Tipos de Cambio</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div><label className="block text-sm font-medium mb-2">Tiempo Entrega (días)</label><input type="number" value={config.tiempoEntrega} onChange={(e) => handleSimpleChange('tiempoEntrega', parseFloat(e.target.value) || 0)} className="w-full border rounded-lg p-3" /></div>
                <div><label className="block text-sm font-medium mb-2">Tiempo Fabricación (días)</label><input type="number" value={config.tiempoPromedioFabricacion || 30} onChange={(e) => handleSimpleChange('tiempoPromedioFabricacion', parseFloat(e.target.value) || 30)} className="w-full border rounded-lg p-3" /></div>
                <div><label className="block text-sm font-medium mb-2">CBM Contenedor Estándar</label><input type="number" step="0.1" value={config.cbmContenedorEstandar || 68} onChange={(e) => handleSimpleChange('cbmContenedorEstandar', parseFloat(e.target.value) || 68)} className="w-full border rounded-lg p-3" /></div>
                <div><label className="block text-sm font-medium mb-2">Umbral Nueva Reposición (días)</label><input type="number" value={config.diasUmbralNuevaReposicion || 30} onChange={(e) => handleSimpleChange('diasUmbralNuevaReposicion', parseFloat(e.target.value) || 30)} className="w-full border rounded-lg p-3" /></div>
                <div><label className="block text-sm font-medium mb-2">Stock Saludable Mín (días)</label><input type="number" value={config.stockSaludableMinDias} onChange={(e) => handleSimpleChange('stockSaludableMinDias', parseFloat(e.target.value) || 0)} className="w-full border rounded-lg p-3" /></div>
                <div><label className="block text-sm font-medium mb-2">Stock Saludable Máx (días)</label><input type="number" value={config.stockSaludableMaxDias} onChange={(e) => handleSimpleChange('stockSaludableMaxDias', parseFloat(e.target.value) || 0)} className="w-full border rounded-lg p-3" /></div>
                <div><label className="block text-sm font-medium mb-2">RMB a USD</label><input type="number" step="0.01" value={config.rmbToUsd} onChange={(e) => handleSimpleChange('rmbToUsd', parseFloat(e.target.value) || 0)} className="w-full border rounded-lg p-3" /></div>
                <div><label className="block text-sm font-medium mb-2">USD a CLP</label><input type="number" value={config.usdToClp} onChange={(e) => handleSimpleChange('usdToClp', parseFloat(e.target.value) || 0)} className="w-full border rounded-lg p-3" /></div>
              </div>
            </div>
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">💵 Costos Fijos (USD)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(config.costosFijosUSD).map(([key, value]) => (
                  <CostRow key={key} name={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} value={value} onChange={(e) => handleChange('costosFijosUSD', key, parseFloat(e.target.value) || 0)} onRemove={() => handleRemoveCost('costosFijosUSD', key)} />
                ))}
              </div>
              <AddCostForm onAdd={(name, value) => handleAddCost('costosFijosUSD', name, value)} />
            </div>
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">🇨🇱 Costos Fijos (CLP)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(config.costosFijosCLP).map(([key, value]) => (
                  <CostRow key={key} name={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} value={value} onChange={(e) => handleChange('costosFijosCLP', key, parseFloat(e.target.value) || 0)} onRemove={() => handleRemoveCost('costosFijosCLP', key)} />
                ))}
              </div>
              <AddCostForm onAdd={(name, value) => handleAddCost('costosFijosCLP', name, value)} />
            </div>
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">📊 Costos Variables (%)</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {Object.keys(config.costosVariablesPct).map(key => (
                  <div key={key}>
                    <label className="block text-sm font-medium mb-2">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</label>
                    <input type="number" step="0.01" value={(config.costosVariablesPct[key] * 100).toFixed(2)} onChange={(e) => handleChange('costosVariablesPct', key, parseFloat(e.target.value) / 100 || 0)} className="w-full border rounded-lg p-3" />
                  </div>
                ))}
              </div>
            </div>
             <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">🛒 MercadoLibre</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div><label className="block text-sm font-medium mb-2">Comisión (%)</label><input type="number" step="0.01" value={(config.mercadoLibre.comisionPct * 100).toFixed(2)} onChange={(e) => handleChange('mercadoLibre', 'comisionPct', parseFloat(e.target.value) / 100 || 0)} className="w-full border rounded-lg p-3" /></div>
                 <div><label className="block text-sm font-medium mb-2">Costo Envío (≥ ${config.mercadoLibre.envioUmbral.toLocaleString('es-CL')})</label><input type="number" value={config.mercadoLibre.costoEnvio} onChange={(e) => handleChange('mercadoLibre', 'costoEnvio', parseFloat(e.target.value) || 0)} className="w-full border rounded-lg p-3" /></div>
                <div><label className="block text-sm font-medium mb-2">Cargo Fijo Medio (≥ ${config.mercadoLibre.cargoFijoMedioUmbral.toLocaleString('es-CL')})</label><input type="number" value={config.mercadoLibre.cargoFijoMedio} onChange={(e) => handleChange('mercadoLibre', 'cargoFijoMedio', parseFloat(e.target.value) || 0)} className="w-full border rounded-lg p-3" /></div>
                <div><label className="block text-sm font-medium mb-2">Cargo Fijo Bajo</label><input type="number" value={config.mercadoLibre.cargoFijoBajo} onChange={(e) => handleChange('mercadoLibre', 'cargoFijoBajo', parseFloat(e.target.value) || 0)} className="w-full border rounded-lg p-3" /></div>
              </div>
            </div>
            
            <div className="flex justify-end gap-4">
              <button type="button" onClick={() => router.push('/dashboard')} className="px-6 py-3 border rounded-lg hover:bg-gray-50" disabled={isSaving}>Cancelar</button>
              <button type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar Configuración'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
