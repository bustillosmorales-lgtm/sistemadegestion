// pages/clear-test-data.js
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useUser } from '../components/UserContext';

export default function ClearTestDataPage() {
    const router = useRouter();
    const { user } = useUser();
    const [isClearing, setIsClearing] = useState(false);
    const [confirmCode, setConfirmCode] = useState('');
    const [results, setResults] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);

    // Solo permitir acceso a administradores
    if (!user || user.role !== 'admin') {
        return (
            <div className="p-8 text-center">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    ❌ Acceso denegado. Solo administradores pueden acceder a esta función.
                </div>
                <button 
                    onClick={() => router.push('/dashboard')} 
                    className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                    Volver al Dashboard
                </button>
            </div>
        );
    }

    const handleClearData = async () => {
        if (confirmCode !== 'CLEAR_ALL_TEST_DATA') {
            alert('❌ Código de confirmación incorrecto');
            return;
        }

        setIsClearing(true);
        try {
            const response = await fetch('/api/clear-test-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmCode }),
            });

            const data = await response.json();

            if (response.ok) {
                setResults(data.results);
                alert('✅ Datos de prueba eliminados exitosamente');
                setConfirmCode('');
                setShowConfirm(false);
            } else {
                alert(`❌ Error: ${data.error}`);
            }
        } catch (error) {
            alert(`❌ Error de conexión: ${error.message}`);
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <div className="p-8 bg-gray-100 min-h-screen">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <button 
                        onClick={() => router.push('/dashboard')} 
                        className="text-blue-600 hover:text-blue-800 mb-4"
                    >
                        ← Volver al Dashboard
                    </button>
                    <h1 className="text-3xl font-bold text-red-600">⚠️ Limpiar Datos de Prueba</h1>
                    <p className="text-gray-600 mt-2">
                        Esta función eliminará TODOS los registros de las tablas de productos, ventas, compras y contenedores.
                    </p>
                </div>

                <div className="bg-white rounded-lg shadow-md p-8">
                    <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                        <div className="flex">
                            <div className="ml-3">
                                <h3 className="text-lg font-medium text-red-800">
                                    ⚠️ ADVERTENCIA: Esta acción es irreversible
                                </h3>
                                <div className="mt-2 text-sm text-red-700">
                                    <p>Esta función eliminará TODOS los datos de:</p>
                                    <ul className="list-disc list-inside mt-2">
                                        <li>Productos (products)</li>
                                        <li>Ventas (ventas)</li>
                                        <li>Compras (compras)</li>
                                        <li>Contenedores (containers)</li>
                                    </ul>
                                    <p className="mt-2 font-bold">
                                        Los usuarios y la configuración NO se verán afectados.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {!showConfirm ? (
                        <div className="text-center">
                            <button
                                onClick={() => setShowConfirm(true)}
                                className="bg-red-600 text-white px-8 py-4 rounded-lg hover:bg-red-700 font-bold text-lg"
                            >
                                🗑️ Proceder con la Limpieza
                            </button>
                        </div>
                    ) : (
                        <div>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Para confirmar, escribe exactamente: <code className="bg-gray-100 px-2 py-1 rounded">CLEAR_ALL_TEST_DATA</code>
                                </label>
                                <input
                                    type="text"
                                    value={confirmCode}
                                    onChange={(e) => setConfirmCode(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                    placeholder="Escribe el código de confirmación..."
                                />
                            </div>

                            <div className="flex gap-4 justify-center">
                                <button
                                    onClick={() => {setShowConfirm(false); setConfirmCode('');}}
                                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                    disabled={isClearing}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleClearData}
                                    disabled={isClearing || confirmCode !== 'CLEAR_ALL_TEST_DATA'}
                                    className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isClearing ? '🔄 Eliminando...' : '🗑️ Confirmar Eliminación'}
                                </button>
                            </div>
                        </div>
                    )}

                    {results && (
                        <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-4">
                            <h3 className="text-lg font-medium text-green-800 mb-3">✅ Resultados de la Limpieza</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div className="bg-white p-3 rounded border">
                                    <div className="font-medium text-gray-700">Productos</div>
                                    <div className="text-2xl font-bold text-blue-600">{results.products || 'Todos'}</div>
                                </div>
                                <div className="bg-white p-3 rounded border">
                                    <div className="font-medium text-gray-700">Ventas</div>
                                    <div className="text-2xl font-bold text-green-600">{results.ventas || 'Todas'}</div>
                                </div>
                                <div className="bg-white p-3 rounded border">
                                    <div className="font-medium text-gray-700">Compras</div>
                                    <div className="text-2xl font-bold text-orange-600">{results.compras || 'Todas'}</div>
                                </div>
                                <div className="bg-white p-3 rounded border">
                                    <div className="font-medium text-gray-700">Contenedores</div>
                                    <div className="text-2xl font-bold text-purple-600">{results.containers || 'Todos'}</div>
                                </div>
                            </div>
                            
                            {results.errors && results.errors.length > 0 && (
                                <div className="mt-4">
                                    <h4 className="font-medium text-red-800">Errores encontrados:</h4>
                                    <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                                        {results.errors.map((error, index) => (
                                            <li key={index}>{error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-blue-800 mb-2">📝 Preparación para Datos Reales</h3>
                    <p className="text-sm text-blue-700">
                        Una vez limpiados los datos de prueba, el sistema estará listo para recibir los archivos Excel 
                        con la data real de productos, ventas, compras y contenedores.
                    </p>
                </div>
            </div>
        </div>
    );
}