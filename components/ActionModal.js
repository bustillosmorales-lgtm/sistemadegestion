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
                    <div className="flex justify-between"><span>Stock Objetivo ({product.breakdown.tiempoEntrega} días):</span><span className="font-mono">{product.breakdown.stockObjetivo} un.</span></div>
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

const ApprovePurchaseForm = ({ product, analysisDetails, onApprove, onReject }) => {
    const { data, error } = useSWR(analysisDetails?.sellingPrice ? `/api/analysis?sku=${product.sku}&precioVenta=${analysisDetails.sellingPrice}` : null, fetcher);
    const [comments, setComments] = useState('');

    if (error) return <div className="text-red-500">Error al calcular análisis.</div>;
    if (!data) return <div>Calculando rentabilidad...</div>;

    const analysis = data.results[0];
    const config = data.configActual;
    const breakdown = analysis.breakdown;

    const calculateTargetPrice = () => {
        const targetMargin = 0.18;
        const sellingPrice = parseFloat(analysisDetails.sellingPrice);
        const costosVenta = (sellingPrice * config.mercadoLibre.comisionPct) + (sellingPrice >= config.mercadoLibre.envioUmbral ? config.mercadoLibre.costoEnvio : (sellingPrice >= config.mercadoLibre.cargoFijoMedioUmbral ? config.mercadoLibre.cargoFijoMedio : config.mercadoLibre.cargoFijoBajo));
        const targetCostoFinalBodega = (sellingPrice * (1 - targetMargin)) - costosVenta;
        const costoLogisticoProductoCLP = parseFloat(breakdown.costoLogisticoProductoUSD) * config.usdToClp;
        const baseCifCLP = (targetCostoFinalBodega - costoLogisticoProductoCLP) / (1 + config.costosVariablesPct.derechosAdValorem + config.costosVariablesPct.iva + (config.costosVariablesPct.derechosAdValorem * config.costosVariablesPct.iva));
        const baseCifUSD = baseCifCLP / config.usdToClp;
        const fletePorProductoUSD = parseFloat(breakdown.fletePorProductoUSD);
        const baseSeguroUSD = (baseCifUSD - fletePorProductoUSD) / (1 + config.costosVariablesPct.seguroContenedor);
        const targetFobMasComision = baseSeguroUSD - fletePorProductoUSD;
        const targetFobUSD = targetFobMasComision / (1 + config.costosVariablesPct.comisionChina);
        return targetFobUSD;
    };

    const targetPrice = calculateTargetPrice();

    const createPayload = (approved) => ({
        approved,
        comments,
        targetPurchasePrice: targetPrice.toFixed(2),
        analysisSnapshot: {
            sellingPrice: analysisDetails.sellingPrice,
            gananciaNeta: analysis.gananciaNeta,
            margen: analysis.margen,
            breakdown: analysis.breakdown
        }
    });

    return (
        <div className="space-y-3 text-sm">
            <h4 className="font-bold text-center mb-2">Desglose del Cálculo</h4>
            <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                <div className="flex justify-between"><span>CBM por Unidad:</span> <span className="font-mono">{product.cbm.toFixed(4)}</span></div>
                <div className="flex justify-between"><span>Precio FOB:</span> <span className="font-mono">${breakdown.costoFobUSD} USD</span></div>
                <div className="flex justify-between"><span>Comisión China ({config.costosVariablesPct.comisionChina * 100}%):</span> <span className="font-mono">${breakdown.comisionChinaUSD} USD</span></div>
                <div className="flex justify-between"><span>Flete por Unidad:</span> <span className="font-mono">${breakdown.fletePorProductoUSD} USD</span></div>
                <div className="flex justify-between"><span>Seguro Contenedor ({config.costosVariablesPct.seguroContenedor * 100}%):</span> <span className="font-mono">${breakdown.seguroProductoUSD} USD</span></div>
                <div className="flex justify-between"><span>Costos Fijos por Unidad:</span> <span className="font-mono">${breakdown.costoLogisticoProductoUSD} USD</span></div>
                <div className="flex justify-between"><span>Derechos Ad Valorem ({config.costosVariablesPct.derechosAdValorem * 100}%):</span> <span className="font-mono">${parseInt(breakdown.adValoremCLP).toLocaleString('es-CL')} CLP</span></div>
                <div className="flex justify-between"><span>IVA ({config.costosVariablesPct.iva * 100}%):</span> <span className="font-mono">${parseInt(breakdown.ivaCLP).toLocaleString('es-CL')} CLP</span></div>
                <div className="flex justify-between border-t pt-1 mt-1 font-semibold"><span>Costo Final en Bodega:</span> <span className="font-mono">${parseInt(breakdown.costoFinalBodegaCLP).toLocaleString('es-CL')} CLP</span></div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                 <div className="flex justify-between"><span>Precio de Venta:</span> <span className="font-mono">${parseInt(analysisDetails.sellingPrice).toLocaleString('es-CL')} CLP</span></div>
                 <div className="flex justify-between"><span>Comisión ML ({config.mercadoLibre.comisionPct * 100}%):</span> <span className="font-mono">-${parseInt(breakdown.comisionML).toLocaleString('es-CL')} CLP</span></div>
                 <div className="flex justify-between"><span>Recargo ML (Envío/Fijo):</span> <span className="font-mono">-${parseInt(breakdown.recargoML).toLocaleString('es-CL')} CLP</span></div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex justify-between"><span className="font-medium">Ganancia Neta:</span> <span className={`font-bold text-lg ${analysis.gananciaNeta > 0 ? 'text-green-600' : 'text-red-600'}`}>${Math.round(analysis.gananciaNeta).toLocaleString('es-CL')}</span></div>
                <div className="flex justify-between"><span className="font-medium">Margen s/Venta:</span> <span className={`font-bold text-lg ${analysis.margen > 18 ? 'text-green-600' : 'text-red-600'}`}>{analysis.margen.toFixed(1)}%</span></div>
            </div>
            {analysis.margen < 18 && <div className="bg-yellow-100 p-3 rounded-lg text-center text-sm">Para un <b>18%</b> de ganancia, el precio de compra objetivo es <b>~${targetPrice.toFixed(2)} USD</b>.</div>}
            <FormField label="Comentarios de Aprobación/Rechazo" name="comments" as="textarea" value={comments} onChange={(e) => setComments(e.target.value)} rows={2} />
            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => onReject(createPayload(false))} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Rechazar</button>
                <button type="button" onClick={() => onApprove(createPayload(true))} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Aprobar</button>
            </div>
        </div>
    );
};

const PurchaseConfirmationForm = ({ data, setData }) => (
    <>
        <FormField label="Fecha de Entrega Estimada" name="estimatedDeliveryDate" type="date" value={data.estimatedDeliveryDate} onChange={setData} required />
        <FormField label="Comentarios" name="comments" as="textarea" value={data.comments} onChange={setData} rows={2} />
    </>
);

const ManufacturingForm = ({ data, setData }) => (
    <>
        <FormField label="Fecha de Finalización de Producción" name="completionDate" type="date" value={data.completionDate} onChange={setData} required />
        <FormField label="Notas de Calidad" name="qualityNotes" as="textarea" value={data.qualityNotes} onChange={setData} />
        <FormField label="Comentarios" name="comments" as="textarea" value={data.comments} onChange={setData} rows={2} />
    </>
);

const ShippingForm = ({ data, setData }) => (
    <>
        <FormField label="Número de Contenedor" name="containerNumber" value={data.containerNumber} onChange={setData} required />
        <FormField label="Fecha de Embarque" name="shippingDate" type="date" value={data.shippingDate} onChange={setData} required />
        <FormField label="Fecha Estimada de Llegada" name="eta" type="date" value={data.eta} onChange={setData} required />
        <FormField label="Comentarios" name="comments" as="textarea" value={data.comments} onChange={setData} rows={2} />
    </>
);

// --- Componente Principal del Modal ---

export default function ActionModal({ isOpen, onClose, product, status, onSubmit }) {
    const [formData, setFormData] = useState({});

    const statusMap = {
        NEEDS_REPLENISHMENT: { title: 'Pedir Cotización', Form: RequestQuoteForm, defaultState: { quantityToQuote: '', comments: '' } },
        QUOTE_REQUESTED: { title: 'Ingresar Cotización', Form: QuoteForm, defaultState: { unitPrice: '', currency: 'RMB', unitsPerBox: '', cbmPerBox: '', productionDays: '', comments: '' } },
        QUOTED: { title: 'Analizar Rentabilidad', Form: AnalyzeForm, defaultState: { sellingPrice: '', comments: '' } },
        ANALYZING: { title: 'Aprobar Compra', Form: ApprovePurchaseForm },
        PURCHASE_APPROVED: { title: 'Confirmar Compra', Form: PurchaseConfirmationForm, defaultState: { estimatedDeliveryDate: '', comments: '' } },
        PURCHASE_CONFIRMED: { title: 'Confirmar Fabricación', Form: ManufacturingForm, defaultState: { completionDate: '', qualityNotes: '', comments: '' } },
        MANUFACTURED: { title: 'Confirmar Carga', Form: ShippingForm, defaultState: { containerNumber: '', shippingDate: '', eta: '', comments: '' } },
    };

    const currentAction = statusMap[status];

    useEffect(() => {
        if (currentAction && currentAction.defaultState) {
            if (status === 'NEEDS_REPLENISHMENT' && product) {
                setFormData({ ...currentAction.defaultState, quantityToQuote: product.cantidadSugerida || '' });
            } else {
                setFormData(currentAction.defaultState);
            }
        }
    }, [status, isOpen, product]);

    if (!isOpen || !currentAction || !product) return null;

    const { title, Form } = currentAction;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(product.sku, status, formData);
    };

    const handleApproval = (payload) => onSubmit(product.sku, status, payload, 'PURCHASE_APPROVED');
    const handleRejection = (payload) => onSubmit(product.sku, status, payload, 'QUOTE_REJECTED');

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                <h2 className="text-xl font-bold mb-4">{title} (SKU: {product.sku})</h2>
                {status === 'ANALYZING' ? (
                    <Form product={product} analysisDetails={product.analysisDetails} onApprove={handleApproval} onReject={handleRejection} />
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
