// components/ActionModal.js
import { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then((res) => res.json());

const formatDate = (isoDate) => {
    if (!isoDate || !isoDate.includes('-')) return isoDate;
    const [year, month, day] = isoDate.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
};

const FormField = ({ label, name, type = 'text', value, onChange, required = false, step, readOnly = false, as = 'input', children, rows }) => {
    const commonProps = {
        id: name, name, value, onChange, required, readOnly, step,
        className: `w-full p-2 border border-gray-300 rounded-md shadow-sm ${readOnly ? 'bg-gray-100' : 'focus:ring-blue-500 focus:border-blue-500'}`
    };
    if (as === 'textarea') return (<div><label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label><textarea {...commonProps} rows={rows || 3} /></div>);
    if (as === 'select') return (<div><label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label><select {...commonProps}>{children}</select></div>);
    return (<div><label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label><input type={type} {...commonProps} /></div>);
};

// --- Formularios Específicos ---

const RequestQuoteForm = ({ data, setData, product }) => {
    const diasDisponibles = product.breakdown?.diasCoberturaLlegada;
    const esUrgente = diasDisponibles !== undefined && diasDisponibles < 0;
    const ventaDiariaDetails = product.breakdown?.ventaDiariaDetails;

    return (
    <>
        <div className="bg-gray-50 p-3 rounded-lg space-y-2 text-sm mb-4">
            <h4 className="font-bold text-center">Cálculo de Venta Diaria</h4>
            {ventaDiariaDetails ? (
                <>
                    <div className="flex justify-between"><span>Fecha Inicial Análisis:</span><span className="font-mono">{formatDate(ventaDiariaDetails.fechaInicial)}</span></div>
                    <div className="flex justify-between"><span>Fecha Final Análisis:</span><span className="font-mono">{formatDate(ventaDiariaDetails.fechaFinal)}</span></div>
                    <div className="flex justify-between"><span>Unidades Vendidas Periodo:</span><span className="font-mono">{ventaDiariaDetails.unidadesVendidas} un.</span></div>
                    <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Venta Diaria Promedio:</span><span className="font-mono text-blue-600">{ventaDiariaDetails.ventaDiariaCalculada} un/día</span></div>
                </>
            ) : <p className="text-center">Cargando detalles...</p>}
        </div>

        <div className="bg-gray-50 p-3 rounded-lg space-y-2 text-sm mb-4">
            <h4 className="font-bold text-center">Cálculo de Reposición Sugerida</h4>
            {product.breakdown ? (
                <>
                    <div className="flex justify-between"><span>Stock Objetivo:</span><span className="font-mono">{product.breakdown.stockObjetivo} un.</span></div>
                    <hr/>
                    <div className="flex justify-between"><span>(+) Stock Actual:</span><span className="font-mono">{product.breakdown.stockActual} un.</span></div>
                    <div className="flex justify-between"><span>(+) Stock en Tránsito que llega:</span><span className="font-mono">{product.breakdown.stockEnTransitoQueLlega} un.</span></div>
                    <div className="flex justify-between"><span>(-) Consumo Proyectado:</span><span className="font-mono">-{product.breakdown.consumoDuranteLeadTime} un.</span></div>
                    <div className="flex justify-between border-t pt-1 mt-1"><span>(=) Stock Proyectado a la Llegada:</span><span className="font-mono">{product.breakdown.stockFinalProyectado} un.</span></div>
                    <hr/>
                    <div className="flex justify-between font-bold text-base mt-1"><span>Cantidad a Reponer Sugerida:</span><span className="font-mono text-blue-600">{product.cantidadSugerida} un.</span></div>
                </>
            ) : <p className="text-center">Cargando detalles del cálculo...</p>}
        </div>

        <div className={`p-2 rounded-lg text-center mb-4 ${esUrgente ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            <div className="font-bold">{diasDisponibles !== undefined ? `${diasDisponibles} días` : 'Calculando...'}</div>
            <div className="text-xs">{esUrgente ? 'Para posible quiebre de stock' : 'Disponibles para comprar'}</div>
        </div>

        <FormField label="Link de Referencia" name="link" value={product.link || 'N/A'} readOnly />
        <FormField label="Cantidad a Cotizar" name="quantityToQuote" type="number" value={data.quantityToQuote} onChange={setData} required />
        <FormField label="Comentarios" name="comments" as="textarea" value={data.comments} onChange={setData} rows={2} />
    </>
    );
};

const QuoteForm = ({ data, setData }) => (
    <>
        <div className="flex gap-2 items-end">
            <div className="flex-grow"><FormField label="Precio Unitario" name="unitPrice" type="number" step="0.01" value={data.unitPrice} onChange={setData} required /></div>
            <div className="w-1/3"><FormField label="Moneda" name="currency" as="select" value={data.currency} onChange={setData}><option value="RMB">RMB</option><option value="USD">USD</option></FormField></div>
        </div>
        <FormField label="Unidades por Bulto" name="unitsPerBox" type="number" value={data.unitsPerBox} onChange={setData} required />
        <FormField label="CBM por Bulto" name="cbmPerBox" type="number" step="0.001" value={data.cbmPerBox} onChange={setData} required />
        <FormField label="Días de Producción" name="productionDays" type="number" value={data.productionDays} onChange={setData} required />
        <FormField label="Comentarios" name="comments" as="textarea" value={data.comments} onChange={setData} rows={2} />
    </>
);

const AnalyzeForm = ({ data, setData }) => (
    <>
        <FormField label="Precio de Venta Estimado (CLP)" name="sellingPrice" type="number" value={data.sellingPrice} onChange={setData} required />
        <FormField label="Comentarios" name="comments" as="textarea" value={data.comments} onChange={setData} rows={2} />
    </>
);

const ApprovePurchaseForm = ({ product, analysisDetails, onApprove, onReject, onClose }) => {
    // El precio de venta ya debe estar guardado del paso anterior "Analizar"
    const precioVenta = analysisDetails?.sellingPrice;
    const [precioVentaEditable, setPrecioVentaEditable] = useState(precioVenta || '');
    const { data, error } = useSWR(precioVentaEditable ? `/api/analysis?sku=${product.sku}&precioVenta=${precioVentaEditable}` : null, fetcher);
    const [comments, setComments] = useState('');
    
    // SKU editing for auto-generated SKUs
    const isAutoGeneratedSku = product.sku && product.sku.match(/^SKU-\d{6}$/);
    const [editableSku, setEditableSku] = useState(product.sku || '');
    const [skuWarningDismissed, setSkuWarningDismissed] = useState(false);
    
    // Datos de la cotización para calcular cantidad ajustada y validación
    const quoteDetails = product.quote_details;
    const unitsPerBox = quoteDetails?.unitsPerBox || 1;
    const quantityToQuote = quoteDetails?.quantityToQuote || 0; // Cantidad mínima de compra
    
    // Calcular cantidad sugerida ajustada por embalaje
    const calculateAdjustedQuantity = (suggestedQty) => {
        if (!unitsPerBox || unitsPerBox <= 0) return suggestedQty;
        return Math.ceil(suggestedQty / unitsPerBox) * unitsPerBox;
    };
    
    const suggestedQuantity = product.cantidadSugerida || 0;
    const adjustedQuantity = calculateAdjustedQuantity(suggestedQuantity);
    
    const [purchaseQuantity, setPurchaseQuantity] = useState(adjustedQuantity);

    if (error) return (
        <div className="space-y-4">
            <div className="text-red-500">Error al calcular análisis.</div>
            <div className="flex justify-end">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cerrar</button>
            </div>
        </div>
    );
    
    // Si no hay precio de venta guardado del paso Analizar, mostrar error
    if (!precioVenta) {
        return (
            <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800 text-sm font-medium">
                        ❌ Error: No se encontró el precio de venta del análisis anterior
                    </p>
                    <p className="text-red-700 text-xs mt-2">
                        El producto debe pasar por el paso "Analizar" antes de poder aprobarse.
                    </p>
                </div>
                <div className="flex justify-end pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cerrar</button>
                </div>
            </div>
        );
    }
    
    if (!data) return (
        <div className="space-y-4">
            <div>Calculando rentabilidad...</div>
            <div className="flex justify-end">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cerrar</button>
            </div>
        </div>
    );

    const analysis = data.results[0];
    const config = data.configActual;
    const breakdown = analysis.breakdown;
    
    if (!analysis || !config || !breakdown) {
        return (
            <div className="space-y-4">
                <div>Cargando datos de análisis...</div>
                <div className="flex justify-end">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cerrar</button>
                </div>
            </div>
        );
    }
    
    // Validar que la configuración esté completa
    const missingConfig = [];
    if (!config.mercadoLibre?.comisionPct) missingConfig.push('Comisión MercadoLibre');
    if (!config.rmbToUsd) missingConfig.push('Tasa RMB a USD');
    if (!config.usdToClp) missingConfig.push('Tasa USD a CLP');
    if (!config.costosVariablesPct?.comisionChina) missingConfig.push('Comisión China');
    if (!config.costosVariablesPct?.iva) missingConfig.push('IVA');
    if (!config.costosFijosUSD?.fleteMaritimo) missingConfig.push('Flete Marítimo');
    
    if (missingConfig.length > 0) {
        return (
            <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800 text-sm font-medium mb-2">
                        ❌ Configuración incompleta. No se puede proceder con el análisis.
                    </p>
                    <ul className="text-red-700 text-sm list-disc list-inside">
                        {missingConfig.map((item, index) => (
                            <li key={index}>Falta configurar: {item}</li>
                        ))}
                    </ul>
                    <p className="text-red-600 text-xs mt-2">
                        Contacte al administrador para completar la configuración.
                    </p>
                </div>
                <div className="flex justify-end pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cerrar</button>
                </div>
            </div>
        );
    }

    const calculateTargetPrice = () => {
        const targetMargin = 0.18; // 18% de ganancia objetivo
        const sellingPrice = parseFloat(precioVentaEditable);
        
        // Calcular costos de venta en MercadoLibre
        const comisionML = sellingPrice * config.mercadoLibre.comisionPct;
        let recargoML = 0;
        if (sellingPrice >= config.mercadoLibre.envioUmbral) {
            recargoML = config.mercadoLibre.costoEnvio;
        } else if (sellingPrice >= config.mercadoLibre.cargoFijoMedioUmbral) {
            recargoML = config.mercadoLibre.cargoFijoMedio;
        } else {
            recargoML = config.mercadoLibre.cargoFijoBajo;
        }
        const totalCostosVenta = comisionML + recargoML;
        
        // Cálculo reverso: Precio objetivo que deje exactamente 18% de margen
        // Fórmula: margen = (precioVenta - costoFinalBodega - costosVenta) / precioVenta
        // Despejando: costoFinalBodegaObjetivo = precioVenta * (1 - margen) - costosVenta
        const targetCostoFinalBodega = sellingPrice * (1 - targetMargin) - totalCostosVenta;
        
        // Calcular costos logísticos actuales
        const costoLogisticoCLP = analysis.costoFinalBodega - (sellingPrice * config.usdToClp * 
            ((product.costo_fob_rmb * config.rmbToUsd * (1 + config.costosVariablesPct.comisionChina)) +
            ((product.costo_fob_rmb * config.rmbToUsd * (1 + config.costosVariablesPct.comisionChina)) * config.costosVariablesPct.seguroContenedor) +
            (config.costosFijosUSD.fleteMaritimo * product.cbm / config.containerCBM)) *
            (1 + config.costosVariablesPct.derechosAdValorem + config.costosVariablesPct.iva));
            
        // Costo CIF objetivo en CLP
        const targetCifCLP = targetCostoFinalBodega - costoLogisticoCLP;
        
        // Convertir a USD y descomponer
        const targetCifUSD = targetCifCLP / config.usdToClp / (1 + config.costosVariablesPct.derechosAdValorem + config.costosVariablesPct.iva);
        
        // Quitar flete y seguro para obtener FOB + comisión
        const fleteUSD = config.costosFijosUSD.fleteMaritimo * product.cbm / config.containerCBM;
        const targetFobMasComisionUSD = (targetCifUSD - fleteUSD) / (1 + config.costosVariablesPct.seguroContenedor);
        
        // Quitar comisión china para obtener FOB puro
        const targetFobUSD = targetFobMasComisionUSD / (1 + config.costosVariablesPct.comisionChina);
        
        return Math.max(targetFobUSD, 0.1); // Mínimo $0.10 USD
    };

    const targetPrice = calculateTargetPrice();

    const createPayload = (approved) => ({
        approved,
        comments,
        targetPurchasePrice: targetPrice.toFixed(2),
        purchaseQuantity: parseInt(purchaseQuantity),
        newSku: isAutoGeneratedSku && editableSku !== product.sku ? editableSku : null,
        analysisSnapshot: {
            sellingPrice: precioVentaEditable,
            gananciaNeta: analysis.gananciaNeta,
            margen: analysis.margen,
            breakdown: analysis.breakdown
        }
    });

    return (
        <div className="space-y-4 text-sm">
            {/* Cantidad de Compra */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-800 mb-3">📦 Cantidad de Compra</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span>Cantidad Sugerida Original:</span>
                            <span className="font-mono">{suggestedQuantity} unidades</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Unidades por Embalaje:</span>
                            <span className="font-mono">{unitsPerBox} unidades/bulto</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                            <span className="font-semibold">Cantidad Ajustada:</span>
                            <span className="font-mono font-semibold text-green-600">{adjustedQuantity} unidades</span>
                        </div>
                        <div className="text-xs text-gray-600">
                            * Ajustado al múltiplo más cercano del embalaje
                        </div>
                    </div>
                    <div>
                        <FormField 
                            label="Cantidad Final de Compra" 
                            name="purchaseQuantity" 
                            type="number" 
                            value={purchaseQuantity} 
                            onChange={(e) => setPurchaseQuantity(e.target.value)}
                            required 
                        />
                        {purchaseQuantity < quantityToQuote && quantityToQuote > 0 && (
                            <div className="bg-yellow-50 border border-yellow-300 rounded p-3 mt-2">
                                <div className="flex items-start">
                                    <span className="text-yellow-600 mr-2">⚠️</span>
                                    <div className="text-yellow-800 text-xs">
                                        <p className="font-semibold">Cantidad menor al mínimo de compra</p>
                                        <p>Mínimo establecido en cotización: <strong>{quantityToQuote} unidades</strong></p>
                                        <p className="text-yellow-700">Puede continuar pero considere riesgos de aprovisionamiento.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* SKU Editing for auto-generated SKUs */}
            {isAutoGeneratedSku && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-semibold text-yellow-800 mb-3">🏷️ Código SKU del Producto</h4>
                    {!skuWarningDismissed && (
                        <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3 mb-4">
                            <div className="flex items-start">
                                <span className="text-yellow-600 mr-2">💡</span>
                                <div className="flex-1">
                                    <p className="text-yellow-800 text-sm font-medium mb-1">
                                        SKU Auto-generado Detectado
                                    </p>
                                    <p className="text-yellow-700 text-xs mb-2">
                                        Este producto tiene un SKU generado automáticamente. Se recomienda cambiarlo por un código interno más específico de su empresa antes de aprobar la compra.
                                    </p>
                                    <button 
                                        type="button"
                                        onClick={() => setSkuWarningDismissed(true)}
                                        className="text-yellow-600 hover:text-yellow-800 text-xs underline"
                                    >
                                        Entendido, continuar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    <FormField 
                        label="Código SKU" 
                        name="editableSku" 
                        type="text" 
                        value={editableSku} 
                        onChange={(e) => setEditableSku(e.target.value)}
                        required 
                    />
                    <p className="text-xs text-gray-600 mt-1">
                        Puede modificar el SKU antes de aprobar. Debe ser único en el sistema.
                    </p>
                </div>
            )}

            {/* Precio de Venta Editable */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm mb-3">
                    💡 <strong>Precio de venta del análisis anterior.</strong> Puede modificarlo si es necesario:
                </p>
                <FormField 
                    label="Precio de Venta (CLP)" 
                    name="precioVentaEditable" 
                    type="number" 
                    value={precioVentaEditable} 
                    onChange={(e) => setPrecioVentaEditable(e.target.value)}
                    required 
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Columna Izquierda - Costos de Compra */}
                <div className="space-y-4">
                    <h4 className="font-bold text-lg text-gray-800 border-b pb-2">💰 Desglose de Costos de Compra</h4>
                    
                    {/* Costos Base */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h5 className="font-semibold text-gray-700 mb-3">📦 Costos Base del Producto</h5>
                        <div className="space-y-2">
                            <div className="flex justify-between"><span>CBM por Unidad:</span> <span className="font-mono">{(product.cbm || 0).toFixed(4)} m³</span></div>
                            <div className="flex justify-between"><span>Precio FOB (RMB):</span> <span className="font-mono">¥{(product.costo_fob_rmb || 0).toFixed(2)}</span></div>
                            <div className="flex justify-between"><span>Tasa RMB → USD:</span> <span className="font-mono">{config.rmbToUsd || 0.14}</span></div>
                            <div className="flex justify-between border-t pt-2"><span className="font-semibold">Precio FOB (USD):</span> <span className="font-mono font-semibold">${((product.costo_fob_rmb || 0) * (config.rmbToUsd || 0.14)).toFixed(2)}</span></div>
                        </div>
                    </div>

                    {/* Costos Variables */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h5 className="font-semibold text-gray-700 mb-3">🔄 Costos Variables</h5>
                        <div className="space-y-2">
                            {(() => {
                                // Lógica exacta del API analysis.js líneas 90-96
                                const costoFobUSD = (product.costo_fob_rmb || 0) * (config.rmbToUsd || 0);
                                const comisionChinaUSD = costoFobUSD * (config.costosVariablesPct?.comisionChina || 0);
                                const costoFobMasComisionUSD = costoFobUSD + comisionChinaUSD;
                                const fletePorProductoUSD = ((config.costosFijosUSD?.fleteMaritimo || 0) / (config.containerCBM || 1)) * (product.cbm || 0);
                                const baseSeguroUSD = costoFobMasComisionUSD + fletePorProductoUSD;
                                const seguroProductoUSD = baseSeguroUSD * (config.costosVariablesPct?.seguroContenedor || 0);
                                
                                return (
                                    <>
                                        <div className="flex justify-between"><span>Comisión China ({((config.costosVariablesPct?.comisionChina || 0) * 100).toFixed(1)}%):</span> <span className="font-mono">${comisionChinaUSD.toFixed(2)}</span></div>
                                        <div className="flex justify-between"><span>Flete Marítimo:</span> <span className="font-mono">${fletePorProductoUSD.toFixed(2)}</span></div>
                                        <div className="flex justify-between"><span>Seguro ({((config.costosVariablesPct?.seguroContenedor || 0) * 100).toFixed(1)}%):</span> <span className="font-mono">${seguroProductoUSD.toFixed(2)}</span></div>
                                        <div className="flex justify-between border-t pt-1"><span className="font-medium">Valor CIF (USD):</span> <span className="font-mono font-medium">${(costoFobMasComisionUSD + fletePorProductoUSD + seguroProductoUSD).toFixed(2)}</span></div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Costos Locales */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h5 className="font-semibold text-gray-700 mb-3">🇨🇱 Costos Locales (Chile)</h5>
                        <div className="space-y-2">
                            {(() => {
                                // Lógica exacta del API analysis.js líneas 90-111
                                const costoFobUSD = (product.costo_fob_rmb || 0) * (config.rmbToUsd || 0);
                                const comisionChinaUSD = costoFobUSD * (config.costosVariablesPct?.comisionChina || 0);
                                const costoFobMasComisionUSD = costoFobUSD + comisionChinaUSD;
                                const fletePorProductoUSD = ((config.costosFijosUSD?.fleteMaritimo || 0) / (config.containerCBM || 1)) * (product.cbm || 0);
                                const baseSeguroUSD = costoFobMasComisionUSD + fletePorProductoUSD;
                                const seguroProductoUSD = baseSeguroUSD * (config.costosVariablesPct?.seguroContenedor || 0);
                                const valorCifUSD = costoFobMasComisionUSD + fletePorProductoUSD + seguroProductoUSD;

                                // Costos logísticos (líneas 98-104)
                                const totalCostosFijosCLP = Object.values(config.costosFijosCLP || {}).reduce((sum, val) => sum + (val || 0), 0);
                                const totalCostosFijosUSD_fromCLP = totalCostosFijosCLP / (config.usdToClp || 1);
                                const { fleteMaritimo, ...otrosCostosFijosUSD } = config.costosFijosUSD || {};
                                const totalOtrosCostosFijosUSD = Object.values(otrosCostosFijosUSD).reduce((sum, val) => sum + (val || 0), 0);
                                const costoLogisticoTotalUSD = totalCostosFijosUSD_fromCLP + totalOtrosCostosFijosUSD;
                                const costoLogisticoPorCBM_USD = costoLogisticoTotalUSD / (config.containerCBM || 1);
                                const costoLogisticoProductoUSD = costoLogisticoPorCBM_USD * (product.cbm || 0);

                                // Costos locales (líneas 106-111)
                                const valorCifCLP = valorCifUSD * (config.usdToClp || 1);
                                const adValoremCLP = valorCifCLP * (config.costosVariablesPct?.derechosAdValorem || 0);
                                const baseIvaCLP = valorCifCLP + adValoremCLP;
                                const ivaCLP = baseIvaCLP * (config.costosVariablesPct?.iva || 0);
                                const costoLogisticoProductoCLP = costoLogisticoProductoUSD * (config.usdToClp || 1);
                                const costoFinalBodegaCLP = valorCifCLP + adValoremCLP + ivaCLP + costoLogisticoProductoCLP;
                                
                                return (
                                    <>
                                        <div className="flex justify-between"><span>Tasa USD → CLP:</span> <span className="font-mono">{config.usdToClp || 1}</span></div>
                                        <div className="flex justify-between"><span>Valor CIF (CLP):</span> <span className="font-mono">${Math.round(valorCifCLP).toLocaleString('es-CL')}</span></div>
                                        <div className="flex justify-between"><span>Derechos Ad Valorem ({((config.costosVariablesPct?.derechosAdValorem || 0) * 100).toFixed(1)}%):</span> <span className="font-mono">${Math.round(adValoremCLP).toLocaleString('es-CL')}</span></div>
                                        <div className="flex justify-between"><span>IVA ({((config.costosVariablesPct?.iva || 0) * 100).toFixed(1)}%):</span> <span className="font-mono">${Math.round(ivaCLP).toLocaleString('es-CL')}</span></div>
                                        <div className="flex justify-between"><span>Costos Logísticos:</span> <span className="font-mono">${Math.round(costoLogisticoProductoCLP).toLocaleString('es-CL')}</span></div>
                                        <div className="flex justify-between border-t pt-2"><span className="font-semibold text-lg">Costo Final en Bodega:</span> <span className="font-mono font-semibold text-lg">${Math.round(costoFinalBodegaCLP || 0).toLocaleString('es-CL')} CLP</span></div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {/* Columna Derecha - Análisis de Rentabilidad */}
                <div className="space-y-4">
                    <h4 className="font-bold text-lg text-gray-800 border-b pb-2">📈 Análisis de Rentabilidad</h4>
                    
                    {/* Costos de Venta */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h5 className="font-semibold text-gray-700 mb-3">🛒 Costos de Venta (MercadoLibre)</h5>
                        <div className="space-y-2">
                            <div className="flex justify-between"><span>Precio de Venta:</span> <span className="font-mono">${parseInt(precioVentaEditable).toLocaleString('es-CL')} CLP</span></div>
                            <div className="flex justify-between"><span>Comisión ML ({((config.mercadoLibre?.comisionPct || 0) * 100).toFixed(1)}%):</span> <span className="font-mono text-red-600">-${Math.round((parseInt(precioVentaEditable) * (config.mercadoLibre?.comisionPct || 0))).toLocaleString('es-CL')}</span></div>
                            <div className="flex justify-between"><span>Costo de Envío/Cargo Fijo:</span> <span className="font-mono text-red-600">-${Math.round((analysis.costosVenta || 0) - (parseInt(precioVentaEditable) * (config.mercadoLibre?.comisionPct || 0))).toLocaleString('es-CL')}</span></div>
                            <div className="flex justify-between border-t pt-2"><span className="font-semibold">Total Costos ML:</span> <span className="font-mono font-semibold text-red-600">-${Math.round(analysis.costosVenta || 0).toLocaleString('es-CL')} CLP</span></div>
                        </div>
                    </div>

                    {/* Resultado Final */}
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                        <h5 className="font-semibold text-blue-800 mb-3">💼 Resultado Final</h5>
                        <div className="space-y-3">
                            <div className="flex justify-between text-lg"><span className="font-semibold">Ganancia Neta:</span> <span className={`font-bold text-xl ${analysis.gananciaNeta > 0 ? 'text-green-600' : 'text-red-600'}`}>${Math.round(analysis.gananciaNeta).toLocaleString('es-CL')} CLP</span></div>
                            <div className="flex justify-between text-lg"><span className="font-semibold">Margen sobre Venta:</span> <span className={`font-bold text-xl ${analysis.margen > 18 ? 'text-green-600' : analysis.margen > 10 ? 'text-yellow-600' : 'text-red-600'}`}>{analysis.margen.toFixed(1)}%</span></div>
                            <div className="bg-white p-3 rounded border-l-4 border-blue-400">
                                <p className="text-sm text-gray-600">
                                    <strong>Fórmula:</strong> Margen = (Ganancia Neta / Precio Venta) × 100
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Ganancia Neta = Precio Venta - Costo Bodega - Costos ML
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Recomendación */}
                    {analysis.margen < 18 && (
                        <div className="bg-yellow-50 border border-yellow-300 p-4 rounded-lg">
                            <h5 className="font-semibold text-yellow-800 mb-2">⚡ Análisis de Rentabilidad</h5>
                            <p className="text-yellow-800 text-sm mb-2">
                                📊 El margen actual es <strong>{analysis.margen.toFixed(1)}%</strong>, inferior al objetivo de 18%
                            </p>
                            <p className="text-yellow-900 text-sm">
                                💡 Para alcanzar exactamente <strong>18% de ganancia</strong>, el precio FOB objetivo debería ser: <strong>${targetPrice.toFixed(2)} USD</strong>
                            </p>
                        </div>
                    )}

                    {/* Información de Stock */}
                    <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                        <h5 className="font-semibold text-green-800 mb-3">📦 Información de Inventario</h5>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">{breakdown.stockActual}</div>
                                <div className="text-xs text-gray-600">Stock Actual</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-yellow-600">{breakdown.stockEnTransitoQueLlega}</div>
                                <div className="text-xs text-gray-600">En Tránsito</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-purple-600">{parseFloat(breakdown.ventaDiaria).toFixed(1)}</div>
                                <div className="text-xs text-gray-600">Venta Diaria</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">{breakdown.diasCoberturaLlegada}</div>
                                <div className="text-xs text-gray-600">Días de Cobertura</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Comentarios */}
            <div className="mt-6">
                <FormField label="Comentarios de Aprobación/Rechazo" name="comments" as="textarea" value={comments} onChange={(e) => setComments(e.target.value)} rows={3} />
            </div>

            {/* Botones */}
            <div className="flex justify-end gap-3 pt-6 border-t">
                <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancelar</button>
                <button type="button" onClick={() => onReject(createPayload(false))} className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Rechazar</button>
                <button type="button" onClick={() => onApprove(createPayload(true))} className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Aprobar</button>
            </div>
        </div>
    );
};

const PurchaseConfirmationForm = ({ data, setData, product }) => {
    const approvedQuantity = product.approval_details?.purchaseQuantity || 0;
    
    return (
        <>
            {/* Mostrar cantidad aprobada y permitir confirmar */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-blue-800 mb-3">📦 Confirmación de Cantidad</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span>Cantidad Aprobada:</span>
                            <span className="font-mono font-semibold text-blue-600">{approvedQuantity} unidades</span>
                        </div>
                        <div className="text-xs text-gray-600">
                            Esta es la cantidad que se aprobó para compra
                        </div>
                    </div>
                    <div>
                        <FormField 
                            label="Cantidad Confirmada de Compra" 
                            name="confirmedQuantity" 
                            type="number" 
                            value={data.confirmedQuantity || approvedQuantity} 
                            onChange={setData} 
                            required 
                        />
                        <div className="text-xs text-gray-600 mt-1">
                            Confirme la cantidad final acordada con el proveedor
                        </div>
                    </div>
                </div>
            </div>
            
            <FormField label="Fecha de Entrega Estimada" name="estimatedDeliveryDate" type="date" value={data.estimatedDeliveryDate} onChange={setData} required />
            <FormField label="Comentarios" name="comments" as="textarea" value={data.comments} onChange={setData} rows={2} />
        </>
    );
};

const ManufacturingForm = ({ data, setData, product }) => {
    const purchaseQuantity = product.purchase_details?.confirmedQuantity || product.approval_details?.purchaseQuantity || 0;
    
    return (
        <>
            {/* Mostrar cantidad de compra confirmada y permitir confirmar fabricación */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-green-800 mb-3">🏭 Confirmación de Fabricación</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span>Cantidad en Compra:</span>
                            <span className="font-mono font-semibold text-green-600">{purchaseQuantity} unidades</span>
                        </div>
                        <div className="text-xs text-gray-600">
                            Cantidad confirmada en el paso anterior
                        </div>
                    </div>
                    <div>
                        <FormField 
                            label="Cantidad Fabricada" 
                            name="manufacturedQuantity" 
                            type="number" 
                            value={data.manufacturedQuantity || purchaseQuantity} 
                            onChange={setData} 
                            required 
                        />
                        <div className="text-xs text-gray-600 mt-1">
                            Confirme la cantidad efectivamente fabricada
                        </div>
                    </div>
                </div>
            </div>
            
            <FormField label="Fecha de Finalización de Producción" name="completionDate" type="date" value={data.completionDate} onChange={setData} required />
            <FormField label="Notas de Calidad" name="qualityNotes" as="textarea" value={data.qualityNotes} onChange={setData} />
            <FormField label="Comentarios" name="comments" as="textarea" value={data.comments} onChange={setData} rows={2} />
        </>
    );
};

const ShippingForm = ({ data, setData, product }) => {
    const { data: containers, error: containersError } = useSWR('/api/containers', fetcher);
    const manufacturedQuantity = product.manufacturing_details?.manufacturedQuantity || product.purchase_details?.confirmedQuantity || product.approval_details?.purchaseQuantity || 0;
    
    if (containersError) {
        return (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                <p className="text-red-600">Error cargando contenedores. Por favor intente nuevamente.</p>
            </div>
        );
    }
    
    if (!containers) {
        return (
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                <p className="text-gray-600">Cargando contenedores...</p>
            </div>
        );
    }
    
    const availableContainers = containers.filter(container => 
        container.status === 'CREATED' || container.status === 'IN_USE'
    );
    
    // Encontrar el contenedor seleccionado para mostrar sus detalles
    const selectedContainer = availableContainers.find(container => 
        container.container_number === data.containerNumber
    );
    
    return (
        <>
            {/* Mostrar cantidad fabricada y permitir confirmar carga */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-orange-800 mb-3">📦 Confirmación de Carga</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span>Cantidad Fabricada:</span>
                            <span className="font-mono font-semibold text-orange-600">{manufacturedQuantity} unidades</span>
                        </div>
                        <div className="text-xs text-gray-600">
                            Cantidad fabricada en el paso anterior
                        </div>
                    </div>
                    <div>
                        <FormField 
                            label="Cantidad Cargada" 
                            name="shippedQuantity" 
                            type="number" 
                            value={data.shippedQuantity || manufacturedQuantity} 
                            onChange={setData} 
                            required 
                        />
                        <div className="text-xs text-gray-600 mt-1">
                            Confirme la cantidad efectivamente cargada al contenedor
                        </div>
                    </div>
                </div>
            </div>
            
            <FormField 
                label="Número de Contenedor" 
                name="containerNumber" 
                as="select" 
                value={data.containerNumber} 
                onChange={setData} 
                required
            >
                <option value="">Seleccione un contenedor</option>
                {availableContainers.map(container => (
                    <option key={container.id} value={container.container_number}>
                        {container.container_number} ({container.container_type}) - {container.max_cbm} CBM - {container.shipping_company || 'Sin naviera'}
                    </option>
                ))}
            </FormField>
            
            {availableContainers.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                    <p className="text-yellow-800 text-sm">
                        ⚠️ No hay contenedores disponibles. <strong>Debe crear contenedores primero.</strong>
                    </p>
                </div>
            )}
            
            {/* Mostrar detalles del contenedor seleccionado */}
            {selectedContainer && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">Detalles del Contenedor</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        {selectedContainer.departure_port && (
                            <div><strong>Puerto Salida:</strong> {selectedContainer.departure_port}</div>
                        )}
                        {selectedContainer.arrival_port && (
                            <div><strong>Puerto Llegada:</strong> {selectedContainer.arrival_port}</div>
                        )}
                        {selectedContainer.estimated_departure && (
                            <div><strong>Salida Estimada:</strong> {formatDate(selectedContainer.estimated_departure)}</div>
                        )}
                        {selectedContainer.estimated_arrival && (
                            <div><strong>Llegada Estimada:</strong> {formatDate(selectedContainer.estimated_arrival)}</div>
                        )}
                    </div>
                </div>
            )}
            
            <FormField label="Comentarios" name="comments" as="textarea" value={data.comments} onChange={setData} rows={2} />
        </>
    );
};

// --- Componente Principal del Modal ---

export default function ActionModal({ isOpen, onClose, product, status, onSubmit }) {
    const [formData, setFormData] = useState({});

    const statusMap = {
        NEEDS_REPLENISHMENT: { title: 'Pedir Cotización', Form: RequestQuoteForm, defaultState: { quantityToQuote: '', comments: '' } },
        QUOTE_REQUESTED: { title: 'Ingresar Cotización', Form: QuoteForm, defaultState: { unitPrice: '', currency: 'RMB', unitsPerBox: '', cbmPerBox: '', productionDays: '', comments: '' } },
        QUOTE_REJECTED: { title: 'Re-Cotizar', Form: QuoteForm, defaultState: { unitPrice: '', currency: 'RMB', unitsPerBox: '', cbmPerBox: '', productionDays: '', comments: '' } },
        QUOTED: { title: 'Analizar Rentabilidad', Form: AnalyzeForm, defaultState: { sellingPrice: '', comments: '' } },
        ANALYZING: { title: 'Aprobar Compra', Form: ApprovePurchaseForm },
        PURCHASE_APPROVED: { title: 'Confirmar Compra', Form: PurchaseConfirmationForm, defaultState: { estimatedDeliveryDate: '', comments: '', confirmedQuantity: '' } },
        PURCHASE_CONFIRMED: { title: 'Confirmar Fabricación', Form: ManufacturingForm, defaultState: { completionDate: '', qualityNotes: '', comments: '', manufacturedQuantity: '' } },
        MANUFACTURED: { title: 'Confirmar Carga', Form: ShippingForm, defaultState: { containerNumber: '', comments: '', shippedQuantity: '' } },
    };

    const currentAction = statusMap[status];

    useEffect(() => {
        console.log('🔧 useEffect en ActionModal ejecutado:', { status, isOpen, currentAction: currentAction?.title });
        if (currentAction && currentAction.defaultState) {
            const initialData = status === 'NEEDS_REPLENISHMENT' && product 
                ? { ...currentAction.defaultState, quantityToQuote: product.cantidadSugerida || '' }
                : currentAction.defaultState;
            console.log('📊 Inicializando FormData:', JSON.stringify(initialData, null, 2));
            setFormData(initialData);
        }
    }, [status, isOpen, product]);

    if (!isOpen || !currentAction || !product) return null;

    const { title, Form } = currentAction;

    const handleChange = (e) => {
        const { name, value } = e.target;
        console.log('📝 Campo cambiado:', name, '=', value);
        setFormData(prev => {
            const newData = { ...prev, [name]: value };
            console.log('💾 Nuevo FormData:', JSON.stringify(newData, null, 2));
            return newData;
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('🎯 Modal handleSubmit ejecutado');
        console.log('📝 FormData:', JSON.stringify(formData, null, 2));
        console.log('🏷️ Status actual:', status);
        console.log('📦 Product SKU:', product.sku);
        
        // Determinar el siguiente status basado en el status actual
        const statusMap = {
            'NEEDS_REPLENISHMENT': 'QUOTE_REQUESTED',
            'QUOTE_REQUESTED': 'QUOTED',
            'QUOTE_REJECTED': 'QUOTED',
            'QUOTED': 'ANALYZING',
            'ANALYZING': 'PURCHASE_APPROVED',
            'PURCHASE_APPROVED': 'PURCHASE_CONFIRMED',
            'PURCHASE_CONFIRMED': 'MANUFACTURED',
            'MANUFACTURED': 'SHIPPED'
        };
        const nextStatus = statusMap[status];
        console.log('🎯 Siguiente status:', nextStatus);
        
        onSubmit(product.sku, status, formData, nextStatus);
    };

    const handleApproval = (payload) => onSubmit(product.sku, status, payload, 'PURCHASE_APPROVED');
    const handleRejection = (payload) => onSubmit(product.sku, status, payload, 'QUOTE_REJECTED');

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className={`bg-white rounded-lg shadow-xl p-6 w-full ${status === 'ANALYZING' ? 'max-w-6xl' : 'max-w-lg'}`}>
                <h2 className="text-xl font-bold mb-4">{title} (SKU: {product.sku})</h2>
                {status === 'ANALYZING' ? (
                    <Form product={product} analysisDetails={product.analysis_details} onApprove={handleApproval} onReject={handleRejection} onClose={onClose} />
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Form data={formData} setData={handleChange} product={product} />
                        <div className="flex justify-end gap-3 pt-4">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancelar</button>
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Confirmar y Avanzar</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
