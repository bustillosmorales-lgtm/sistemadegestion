// pages/bulk-upload.js
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { useUser } from '../components/UserContext';

export default function BulkUploadPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useUser();
    
    const [selectedTable, setSelectedTable] = useState('ventas');
    const [uploadData, setUploadData] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [error, setError] = useState('');

    // Control de acceso
    useEffect(() => {
        if (!isLoading && (!isAuthenticated || !user || (user.role !== 'admin' && user.role !== 'chile'))) {
            router.push('/dashboard');
        }
    }, [isAuthenticated, user, isLoading, router]);

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Verificar que sea CSV o Excel
        const allowedTypes = [
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];

        if (!allowedTypes.includes(file.type)) {
            setError('Solo se permiten archivos CSV o Excel (.xls, .xlsx)');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                // Por simplicidad, asumimos CSV por ahora
                if (file.type === 'text/csv') {
                    const csvData = e.target.result;
                    const parsed = parseCSV(csvData);
                    setUploadData(parsed);
                    setError('');
                } else {
                    setError('Excel aún no soportado. Use CSV por favor.');
                }
            } catch (err) {
                setError('Error procesando archivo: ' + err.message);
            }
        };
        
        if (file.type === 'text/csv') {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file);
        }
    };

    const parseCSV = (csvData) => {
        const lines = csvData.split('\n').filter(line => line.trim());
        if (lines.length < 2) throw new Error('Archivo debe tener al menos encabezados y una fila de datos');
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            data.push(row);
        }
        
        return data;
    };

    const handleUpload = async () => {
        if (!uploadData || uploadData.length === 0) {
            setError('No hay datos para cargar');
            return;
        }

        setIsUploading(true);
        setError('');

        try {
            const response = await fetch('/api/bulk-upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tableType: selectedTable,
                    data: uploadData,
                    user: user
                })
            });

            const result = await response.json();
            
            if (response.ok) {
                setUploadResult(result);
                setUploadData(null);
            } else {
                setError(result.error || 'Error en la carga');
            }
        } catch (err) {
            setError('Error de conexión: ' + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const downloadTemplate = () => {
        const templates = {
            ventas: 'numero_venta,sku,cantidad,fecha_venta,precio_venta_clp,descripcion_producto\nV001,SKU001,10,2024-01-15,15000,Producto Ejemplo',
            compras: 'numero_compra,sku,cantidad,fecha_compra,fecha_llegada_estimada,status_compra,container_number,proveedor,precio_compra,descripcion_producto\nC001,SKU001,100,2024-01-10,2024-02-15,en_transito,CONT001,Proveedor A,5.50,Producto Ejemplo',
            containers: 'container_number,container_type,max_cbm,departure_port,arrival_port,estimated_departure,estimated_arrival,shipping_company,notes\nCONT001,STD,68,Shanghai,Valparaiso,2024-01-15,2024-02-15,COSCO,Contenedor ejemplo'
        };

        const csvContent = templates[selectedTable];
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `template_${selectedTable}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
    };

    if (!user || (user.role !== 'admin' && user.role !== 'chile')) {
        return <div className="p-8 text-center">Acceso denegado</div>;
    }

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm border-b'>
                <div className='max-w-6xl mx-auto px-4 py-4'>
                    <button 
                        onClick={() => router.push('/dashboard')} 
                        className='text-blue-600 hover:text-blue-800 flex items-center font-medium mb-2'
                    >
                        ← Volver al Dashboard
                    </button>
                    <h1 className='text-2xl font-bold text-gray-900'>📤 Carga Masiva de Datos</h1>
                    <p className='text-gray-600'>Cargar información base para alimentar el sistema de análisis</p>
                </div>
            </header>

            <main className='max-w-4xl mx-auto px-4 py-8'>
                {error && (
                    <div className="mb-6 p-4 bg-red-100 border border-red-200 text-red-700 rounded-lg">
                        ❌ {error}
                    </div>
                )}

                {uploadResult && (
                    <div className="mb-6 p-4 bg-green-100 border border-green-200 text-green-700 rounded-lg">
                        <h3 className="font-bold mb-2">✅ {uploadResult.mensaje}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>📊 Nuevos: <strong>{uploadResult.resumen.nuevos}</strong></div>
                            <div>🔄 Duplicados: <strong>{uploadResult.resumen.duplicados}</strong></div>
                            <div>❌ Errores: <strong>{uploadResult.resumen.errores}</strong></div>
                            <div>📦 Productos Nuevos: <strong>{uploadResult.resumen.productosNuevos}</strong></div>
                        </div>
                        
                        {uploadResult.detalles.errores.length > 0 && (
                            <details className="mt-3">
                                <summary className="cursor-pointer text-red-600">Ver errores ({uploadResult.detalles.errores.length})</summary>
                                <div className="mt-2 max-h-40 overflow-y-auto">
                                    {uploadResult.detalles.errores.map((error, index) => (
                                        <div key={index} className="text-xs bg-red-50 p-2 rounded mb-1">
                                            <strong>Registro:</strong> {JSON.stringify(error.registro)}
                                            <br />
                                            <strong>Error:</strong> {error.error}
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                🗃️ Tipo de Datos a Cargar
                            </label>
                            <select 
                                value={selectedTable}
                                onChange={(e) => setSelectedTable(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="ventas">📈 Ventas</option>
                                <option value="compras">🛒 Compras</option>
                                <option value="containers">🚢 Contenedores</option>
                            </select>
                        </div>

                        <div className="flex gap-4">
                            <button 
                                onClick={downloadTemplate}
                                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium"
                            >
                                📄 Descargar Template
                            </button>
                            
                            <div className="text-sm text-gray-600 self-center">
                                Descarga el template para ver el formato requerido
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                📂 Seleccionar Archivo (CSV)
                            </label>
                            <input 
                                type="file"
                                accept=".csv,.xls,.xlsx"
                                onChange={handleFileUpload}
                                className="w-full p-3 border border-gray-300 rounded-lg"
                            />
                        </div>

                        {uploadData && (
                            <div>
                                <h3 className="font-medium text-gray-700 mb-2">
                                    📊 Vista Previa ({uploadData.length} registros)
                                </h3>
                                <div className="max-h-60 overflow-auto border rounded-lg">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                {Object.keys(uploadData[0] || {}).map(header => (
                                                    <th key={header} className="p-2 text-left border-b">{header}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {uploadData.slice(0, 5).map((row, index) => (
                                                <tr key={index} className="border-b">
                                                    {Object.values(row).map((value, i) => (
                                                        <td key={i} className="p-2">{value}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {uploadData.length > 5 && (
                                        <div className="p-2 text-center text-gray-500 bg-gray-50">
                                            ... y {uploadData.length - 5} registros más
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end pt-4">
                            <button 
                                onClick={handleUpload}
                                disabled={!uploadData || isUploading}
                                className="px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUploading ? '⚙️ Procesando...' : '📤 Cargar Datos'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-800 mb-2">ℹ️ Información Importante</h3>
                    <ul className="text-blue-700 text-sm space-y-1">
                        <li>• Los datos se agregan de forma incremental (no reemplazan datos existentes)</li>
                        <li>• Los registros duplicados (por número de venta/compra/contenedor) se ignoran automáticamente</li>
                        <li>• Si aparece un SKU en ventas que no existe en productos, se crea automáticamente</li>
                        <li>• Se recomienda usar el template para asegurar el formato correcto</li>
                        <li>• Solo usuarios Admin y Chile pueden realizar carga masiva</li>
                    </ul>
                </div>
            </main>
        </div>
    );
}