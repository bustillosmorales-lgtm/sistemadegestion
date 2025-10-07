// pages/bulk-upload.js
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { useUser } from '../components/UserContext';
import IntelligentFileParser from '../lib/intelligentFileParser';

export default function BulkUploadPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading } = useUser();
    
    const [selectedTable, setSelectedTable] = useState('ventas');
    const [uploadData, setUploadData] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [parsedFileData, setParsedFileData] = useState(null);
    const [columnMapping, setColumnMapping] = useState({});
    const [validationResult, setValidationResult] = useState(null);
    const [fileInfo, setFileInfo] = useState(null);
    const [showPurgeOption, setShowPurgeOption] = useState(false);
    const [purgeConfirmed, setPurgeConfirmed] = useState(false);

    // Control de acceso
    useEffect(() => {
        if (!isLoading && (!isAuthenticated || !user || (user.role !== 'admin' && user.role !== 'chile'))) {
            router.push('/dashboard');
        }
    }, [isAuthenticated, user, isLoading, router]);

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) {
            console.log('⚠️ No se seleccionó ningún archivo');
            return;
        }

        console.log('📁 Archivo seleccionado:', {
            name: file.name,
            size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
            type: file.type,
            lastModified: new Date(file.lastModified).toLocaleString()
        });

        setIsProcessing(true);
        setError('');
        setParsedFileData(null);
        setUploadData(null);
        setValidationResult(null);

        try {
            // Información básica del archivo
            const fileInfo = {
                name: file.name,
                size: (file.size / 1024).toFixed(1) + ' KB',
                type: file.type || 'Desconocido',
                lastModified: new Date(file.lastModified).toLocaleDateString()
            };
            setFileInfo(fileInfo);
            console.log('📋 Información del archivo:', fileInfo);

            console.log('🔍 Iniciando procesamiento de archivo:', file.name, 'Tamaño:', (file.size / 1024 / 1024).toFixed(2) + ' MB');

            // Usar el parser inteligente
            const parser = new IntelligentFileParser();
            console.log('📊 Parsing archivo Excel...');
            const parsedData = await parser.parseFile(file);
            console.log('✅ Archivo parseado exitosamente:', {
                filas: parsedData?.data?.length || 0,
                columnas: parsedData?.headers?.length || 0,
                tipoDetectado: parsedData?.detectedFormat?.probableType || 'desconocido'
            });
            
            // Validar datos
            console.log('🔍 Validando datos para tabla:', selectedTable);
            const validation = parser.validateData(parsedData, selectedTable);
            console.log('✅ Validación completada:', {
                esValido: validation.isValid,
                errores: validation.errors?.length || 0,
                advertencias: validation.warnings?.length || 0
            });

            // Auto-detectar tipo de datos si no coincide con selección
            if (parsedData.detectedFormat.probableType !== 'unknown' &&
                parsedData.detectedFormat.probableType !== selectedTable) {

                console.log(`⚠️ Tipo detectado (${parsedData.detectedFormat.probableType}) difiere del seleccionado (${selectedTable})`);

                const shouldChange = confirm(
                    `El archivo parece contener datos de "${parsedData.detectedFormat.probableType}" ` +
                    `pero seleccionaste "${selectedTable}". ¿Cambiar automáticamente?`
                );

                if (shouldChange) {
                    console.log('✅ Usuario cambió tipo a:', parsedData.detectedFormat.probableType);
                    setSelectedTable(parsedData.detectedFormat.probableType);
                }
            }

            setParsedFileData(parsedData);
            setColumnMapping(parsedData.columnMapping);
            setValidationResult(validation);

            // Preparar datos para el formato anterior (compatibilidad)
            setUploadData(parsedData.data);
            console.log('✅ Datos listos para cargar:', parsedData.data.length, 'registros');

        } catch (err) {
            console.error('❌ Error completo procesando archivo:', err);
            console.error('Stack trace:', err.stack);
            setError(`Error procesando archivo: ${err.message}\n\nRevisa la consola (F12) para más detalles.`);
        } finally {
            setIsProcessing(false);
        }
    };

    // Función parseCSV removida - ahora usa IntelligentFileParser

    const handlePurgeDatabase = async () => {
        if (!purgeConfirmed) {
            setError('⚠️ Debes confirmar la depuración antes de continuar');
            return;
        }

        const confirmMessage = `🚨 ADVERTENCIA: Estás a punto de ELIMINAR TODOS los datos de ${selectedTable}.\n\n` +
                              `Esta acción NO se puede deshacer.\n\n` +
                              `¿Estás ABSOLUTAMENTE SEGURO de continuar?`;

        if (!confirm(confirmMessage)) {
            setPurgeConfirmed(false);
            return;
        }

        setIsUploading(true);
        setError('⚙️ Depurando base de datos...');

        console.log('🗑️ Iniciando depuración:', { tabla: selectedTable, usuario: user?.username });

        try {
            const response = await fetch('/api/purge-database', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tableType: selectedTable,
                    user: user
                })
            });

            console.log('📡 Respuesta de purge-database:', { status: response.status, ok: response.ok });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Error del servidor:', errorData);
                throw new Error(errorData.details || errorData.error || 'Error al depurar base de datos');
            }

            const result = await response.json();
            console.log('✅ Depuración exitosa:', result);
            alert(`✅ Base de datos depurada exitosamente.\n\nRegistros eliminados: ${result.deletedCount}\nTabla: ${result.tableName}`);
            setPurgeConfirmed(false);
            setShowPurgeOption(false);
            setError('');
        } catch (err) {
            console.error('❌ Error completo depurando base de datos:', err);
            console.error('Stack trace:', err.stack);
            setError('Error al depurar: ' + err.message + '\n\nRevisa la consola (F12) para más detalles.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleUpload = async () => {
        if (!uploadData || uploadData.length === 0) {
            setError('No hay datos para cargar');
            return;
        }

        setIsUploading(true);
        setError('');

        // Para archivos grandes, procesar en lotes para evitar timeouts
        const batchSize = 200; // Procesar 200 filas por vez
        const totalRows = uploadData.length;
        const totalBatches = Math.ceil(totalRows / batchSize);
        
        console.log(`📊 Procesando ${totalRows} filas en ${totalBatches} lotes de ${batchSize} filas cada uno`);

        let allResults = {
            nuevos: [],
            duplicados: [],
            errores: [],
            productosNuevos: []
        };

        try {
            for (let i = 0; i < totalBatches; i++) {
                const start = i * batchSize;
                const end = Math.min(start + batchSize, totalRows);
                const batch = uploadData.slice(start, end);
                
                console.log(`🔄 Procesando lote ${i + 1}/${totalBatches} (filas ${start + 1}-${end})`);
                setError(`Procesando lote ${i + 1} de ${totalBatches}...`);

                const batchResult = await processBatch(batch, i + 1, totalBatches);
                
                // Combinar resultados
                allResults.nuevos.push(...(batchResult.detalles?.nuevos || []));
                allResults.duplicados.push(...(batchResult.detalles?.duplicados || []));
                allResults.errores.push(...(batchResult.detalles?.errores || []));
                allResults.productosNuevos.push(...(batchResult.detalles?.productosNuevos || []));
                
                // Pequeña pausa entre lotes para no sobrecargar el servidor
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            setUploadResult({
                mensaje: `Carga masiva completada para ${selectedTable}`,
                resumen: {
                    nuevos: allResults.nuevos.length,
                    duplicados: allResults.duplicados.length,
                    errores: allResults.errores.length,
                    productosNuevos: allResults.productosNuevos.length
                },
                detalles: allResults
            });
            setUploadData(null);
            setError('');
            
        } catch (err) {
            console.error('❌ Error en procesamiento por lotes:', err);
            setError('Error en procesamiento: ' + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const processBatch = async (batchData, batchNumber, totalBatches) => {
        try {
            console.log(`🚀 Iniciando upload lote ${batchNumber}/${totalBatches}:`, {
                tabla: selectedTable,
                filas: batchData.length,
                tamañoData: JSON.stringify(batchData).length
            });

            const response = await fetch('/api/bulk-upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tableType: selectedTable,
                    data: batchData,
                    user: user
                })
            });

            console.log(`📡 Respuesta lote ${batchNumber} recibida:`, {
                status: response.status,
                statusText: response.statusText
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ Error del servidor en lote ${batchNumber}:`, errorText);
                throw new Error(`Error del servidor (${response.status}): ${errorText}`);
            }

            const responseText = await response.text();
            console.log(`📄 Lote ${batchNumber} - Respuesta recibida, longitud:`, responseText.length);
            
            if (!responseText.trim()) {
                throw new Error(`Respuesta vacía del servidor en lote ${batchNumber}`);
            }

            let result;
            try {
                result = JSON.parse(responseText);
                console.log(`✅ Lote ${batchNumber} procesado exitosamente:`, result.resumen);
                return result;
            } catch (parseError) {
                console.error(`❌ Error parseando JSON lote ${batchNumber}:`, parseError);
                console.error('📄 Contenido de respuesta:', responseText.substring(0, 500) + '...');
                throw new Error(`Error procesando respuesta del servidor en lote ${batchNumber}`);
            }
            
        } catch (err) {
            console.error(`❌ Error en lote ${batchNumber}:`, err);
            throw err;
        }
    };

    const downloadTemplate = async () => {
        if (selectedTable === 'productos') {
            // Para productos, descargar template con datos existentes
            try {
                const response = await fetch('/api/bulk-upload', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `productos_existentes_${new Date().toISOString().split('T')[0]}.xlsx`;
                    link.click();
                    window.URL.revokeObjectURL(url);
                } else {
                    throw new Error('Error descargando template de productos');
                }
            } catch (error) {
                setError('Error descargando template de productos: ' + error.message);
            }
            return;
        }

        // Templates estáticos para otros tipos
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
                            <div>🔄 {selectedTable === 'productos' ? 'Actualizados' : 'Duplicados'}: <strong>{uploadResult.resumen.duplicados}</strong></div>
                            <div>❌ Errores: <strong>{uploadResult.resumen.errores}</strong></div>
                            {selectedTable !== 'productos' && (
                                <div>📦 Productos Nuevos: <strong>{uploadResult.resumen.productosNuevos}</strong></div>
                            )}
                            {uploadResult.resumen.contenedoresNuevos > 0 && (
                                <div>🚢 Contenedores Nuevos: <strong>{uploadResult.resumen.contenedoresNuevos}</strong></div>
                            )}
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
                                onChange={(e) => {
                                    setSelectedTable(e.target.value);
                                    setShowPurgeOption(false);
                                    setPurgeConfirmed(false);
                                }}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="ventas">📈 Ventas</option>
                                <option value="compras">🛒 Compras</option>
                                <option value="containers">🚢 Contenedores</option>
                                <option value="productos">📦 Productos</option>
                            </select>
                        </div>

                        {/* Opción de depurar base de datos (solo para ventas, compras y contenedores) */}
                        {selectedTable !== 'productos' && (
                            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        id="show-purge"
                                        checked={showPurgeOption}
                                        onChange={(e) => {
                                            setShowPurgeOption(e.target.checked);
                                            if (!e.target.checked) setPurgeConfirmed(false);
                                        }}
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <label htmlFor="show-purge" className="font-semibold text-red-800 cursor-pointer">
                                            🗑️ Depurar base de datos antes de cargar
                                        </label>
                                        <p className="text-sm text-red-700 mt-1">
                                            Elimina TODOS los datos existentes de {selectedTable} antes de cargar los nuevos datos.
                                            Útil para cargar todo desde cero.
                                        </p>
                                    </div>
                                </div>

                                {showPurgeOption && (
                                    <div className="mt-4 pl-6 border-l-4 border-red-400">
                                        <div className="flex items-start gap-3 mb-3">
                                            <input
                                                type="checkbox"
                                                id="confirm-purge"
                                                checked={purgeConfirmed}
                                                onChange={(e) => setPurgeConfirmed(e.target.checked)}
                                                className="mt-1"
                                            />
                                            <label htmlFor="confirm-purge" className="text-sm font-medium text-red-900 cursor-pointer">
                                                ⚠️ CONFIRMO que deseo eliminar TODOS los datos de {selectedTable}
                                            </label>
                                        </div>

                                        <button
                                            onClick={handlePurgeDatabase}
                                            disabled={!purgeConfirmed || isUploading}
                                            className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {isUploading ? '⚙️ Depurando...' : '🗑️ Depurar Base de Datos'}
                                        </button>

                                        <p className="text-xs text-red-600 mt-2 font-medium">
                                            ⚠️ Esta acción NO se puede deshacer. Todos los registros de {selectedTable} serán eliminados permanentemente.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-4">
                            <button 
                                onClick={downloadTemplate}
                                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium"
                            >
                                📄 Descargar Template
                            </button>
                            
                            <div className="text-sm text-gray-600 self-center">
                                {selectedTable === 'productos' 
                                    ? 'Descarga Excel con productos existentes para editar/agregar' 
                                    : 'Descarga el template para ver el formato requerido'
                                }
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                📂 Seleccionar Archivo
                            </label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                                <input 
                                    type="file"
                                    accept=".csv,.xls,.xlsx,.tsv,.json,.txt"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    id="file-upload"
                                    disabled={isProcessing}
                                />
                                <label htmlFor="file-upload" className="cursor-pointer">
                                    <div className="text-4xl mb-2">📁</div>
                                    <p className="text-lg font-medium text-gray-700 mb-1">
                                        {isProcessing ? '⚙️ Procesando archivo...' : 'Arrastra archivo aquí o haz clic para seleccionar'}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        Soporta: Excel (.xlsx, .xls), CSV, TSV, JSON, TXT
                                    </p>
                                </label>
                            </div>
                            
                            {fileInfo && (
                                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                    <h4 className="font-medium text-blue-800 mb-2">📄 Información del Archivo</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm text-blue-700">
                                        <div><strong>Nombre:</strong> {fileInfo.name}</div>
                                        <div><strong>Tamaño:</strong> {fileInfo.size}</div>
                                        <div><strong>Tipo:</strong> {fileInfo.type}</div>
                                        <div><strong>Modificado:</strong> {fileInfo.lastModified}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {parsedFileData && (
                            <div className="space-y-6">
                                {/* Análisis Automático */}
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <h3 className="font-bold text-green-800 mb-2">✅ Archivo Procesado Exitosamente</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-green-700">
                                        <div><strong>Tipo Detectado:</strong> {parsedFileData.detectedFormat.probableType || 'Genérico'}</div>
                                        <div><strong>Filas:</strong> {parsedFileData.totalRows}</div>
                                        <div><strong>Columnas:</strong> {parsedFileData.headers.length}</div>
                                        <div><strong>Calidad:</strong> {parsedFileData.detectedFormat.quality?.completenessScore || 0}%</div>
                                    </div>
                                </div>
                                
                                {/* Mapeo de Columnas */}
                                <div>
                                    <h3 className="font-medium text-gray-700 mb-3">🔗 Mapeo Automático de Columnas</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {parsedFileData.headers.map(header => {
                                            const mappedField = columnMapping[header];
                                            return (
                                                <div key={header} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                                    <span className="text-sm font-medium">{header}</span>
                                                    <span className="text-xs px-2 py-1 rounded {
                                                        mappedField ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                    }">
                                                        {mappedField ? `→ ${mappedField}` : 'Sin mapear'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                
                                {/* Validación */}
                                {validationResult && (
                                    <div className={`border rounded-lg p-4 ${
                                        validationResult.isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                                    }`}>
                                        <h3 className={`font-bold mb-2 ${
                                            validationResult.isValid ? 'text-green-800' : 'text-red-800'
                                        }`}>
                                            {validationResult.isValid ? '✅ Validación Exitosa' : '⚠️ Errores Encontrados'}
                                        </h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                                            <div><strong>Filas Válidas:</strong> {validationResult.summary.validRows}</div>
                                            <div><strong>Errores:</strong> {validationResult.summary.errorCount}</div>
                                            <div><strong>Advertencias:</strong> {validationResult.summary.warningCount}</div>
                                            <div><strong>Total:</strong> {validationResult.summary.totalRows}</div>
                                        </div>
                                        
                                        {validationResult.errors.length > 0 && (
                                            <details className="mt-3">
                                                <summary className="cursor-pointer text-red-600 font-medium">Ver Errores ({validationResult.errors.length})</summary>
                                                <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                                                    {validationResult.errors.map((error, index) => (
                                                        <div key={index} className="text-xs bg-red-100 p-2 rounded">{error}</div>
                                                    ))}
                                                </div>
                                            </details>
                                        )}
                                        
                                        {validationResult.warnings.length > 0 && (
                                            <details className="mt-3">
                                                <summary className="cursor-pointer text-yellow-600 font-medium">Ver Advertencias ({validationResult.warnings.length})</summary>
                                                <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                                                    {validationResult.warnings.map((warning, index) => (
                                                        <div key={index} className="text-xs bg-yellow-100 p-2 rounded">{warning}</div>
                                                    ))}
                                                </div>
                                            </details>
                                        )}
                                    </div>
                                )}
                                
                                {/* Vista Previa */}
                                <div>
                                    <h3 className="font-medium text-gray-700 mb-2">
                                        📊 Vista Previa de Datos ({uploadData?.length || 0} registros)
                                    </h3>
                                    <div className="max-h-60 overflow-auto border rounded-lg">
                                        <table className="w-full text-xs">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    {parsedFileData.headers.map(header => (
                                                        <th key={header} className="p-2 text-left border-b">
                                                            <div>{header}</div>
                                                            {columnMapping[header] && (
                                                                <div className="text-xs text-green-600 font-normal">({columnMapping[header]})</div>
                                                            )}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {uploadData?.slice(0, 5).map((row, index) => (
                                                    <tr key={index} className="border-b">
                                                        {parsedFileData.headers.map(header => (
                                                            <td key={header} className="p-2">{row._original?.[header] || ''}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {uploadData && uploadData.length > 5 && (
                                            <div className="p-2 text-center text-gray-500 bg-gray-50">
                                                ... y {uploadData.length - 5} registros más
                                            </div>
                                        )}
                                    </div>
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
                    {selectedTable === 'productos' ? (
                        <ul className="text-blue-700 text-sm space-y-1">
                            <li>• <strong>Para productos existentes:</strong> Solo se actualizan los campos que no estén vacíos en el archivo</li>
                            <li>• <strong>Para productos nuevos:</strong> Se crean con valores por defecto si faltan campos obligatorios</li>
                            <li>• <strong>Template inteligente:</strong> Descarga todos los productos existentes para facilitar la edición</li>
                            <li>• <strong>Campos disponibles:</strong> SKU, descripción, categoría, stock, costo_fob_rmb, CBM, link, status, desconsiderado</li>
                            <li>• <strong>Solo SKU es obligatorio:</strong> Los demás campos son opcionales</li>
                            <li>• <strong>Conversión automática:</strong> Números, booleanos y fechas se convierten automáticamente</li>
                        </ul>
                    ) : (
                        <ul className="text-blue-700 text-sm space-y-1">
                            <li>• Los datos se agregan de forma incremental (no reemplazan datos existentes)</li>
                            <li>• Los registros duplicados (por número de venta/compra/contenedor o SKU+fecha) se ignoran automáticamente</li>
                            <li>• Si aparece un SKU en ventas que no existe en productos, se crea automáticamente</li>
                            <li>• Se recomienda usar el template para asegurar el formato correcto</li>
                            <li>• Solo usuarios Admin y Chile pueden realizar carga masiva</li>
                        </ul>
                    )}
                </div>
            </main>
        </div>
    );
}