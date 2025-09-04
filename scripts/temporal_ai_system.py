#!/usr/bin/env python3
"""
SISTEMA IA TEMPORAL PARA PREDICCIÓN DE INVENTARIO
Especializado en eventos chilenos y MercadoLibre
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta, date
import json
import logging
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import warnings
warnings.filterwarnings('ignore')

# Machine Learning imports
try:
    from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor, IsolationForest
    from sklearn.preprocessing import StandardScaler, LabelEncoder
    from sklearn.model_selection import train_test_split, GridSearchCV
    from sklearn.metrics import mean_absolute_error, r2_score, mean_squared_error
    from scipy import stats
    from scipy.optimize import minimize
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    print("⚠️ Librerías ML no disponibles. Instalar: pip install scikit-learn scipy")

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class SeasonalEvent:
    """Evento estacional chileno"""
    name: str
    event_type: str
    start_month: int
    end_month: int
    peak_month: int
    factor_multiplier: float
    confidence: float
    categories_affected: List[str]
    channel: str = 'mercadolibre'

@dataclass
class PredictionResult:
    """Resultado de predicción IA"""
    sku: str
    cantidad_predicha: int
    confianza: float
    evento_objetivo: str
    temporalidad_target: date
    factores_aplicados: Dict
    logica_detallada: Dict
    alerta_temporal: Optional[Dict] = None

class ChileanSeasonalityEngine:
    """Motor de estacionalidad específico para Chile"""
    
    def __init__(self):
        self.eventos_chile = self._initialize_chilean_events()
        self.mercadolibre_multipliers = {
            'cyberday': {'base': 3.5, 'electronics': 6.5, 'home': 3.2},
            'black_friday': {'base': 4.8, 'electronics': 8.2, 'home': 4.5},
            'hot_day': {'base': 2.2, 'electronics': 3.8, 'home': 1.9}
        }
    
    def _initialize_chilean_events(self) -> List[SeasonalEvent]:
        """Inicializar eventos estacionales chilenos"""
        return [
            # EVENTOS MÁXIMOS
            SeasonalEvent('Navidad', 'navidad', 12, 12, 12, 3.5, 0.95, 
                         ['Juegos y Juguetes', 'Electrónicos', 'Hogar y Muebles']),
            SeasonalEvent('Día del Niño', 'dia_nino', 8, 8, 8, 4.2, 0.94,
                         ['Juegos y Juguetes', 'Deportes y Fitness']),
            SeasonalEvent('Fiestas Patrias', 'fiestas_patrias', 9, 9, 9, 2.8, 0.92,
                         ['Hogar y Muebles', 'Jardín', 'Vehículos']),
            
            # EVENTOS DIGITALES (MERCADOLIBRE)
            SeasonalEvent('CyberDay Mayo', 'cyberday', 5, 5, 5, 6.5, 0.95,
                         ['Electrónicos', 'Hogar y Muebles', 'Deportes y Fitness']),
            SeasonalEvent('Black Friday', 'black_friday', 11, 11, 11, 8.2, 0.96,
                         ['Electrónicos', 'Hogar y Muebles', 'Juegos y Juguetes']),
            
            # EVENTOS FAMILIARES
            SeasonalEvent('Día de la Madre', 'dia_madre', 5, 5, 5, 2.6, 0.88,
                         ['Belleza y Cuidado Personal', 'Joyas', 'Hogar y Muebles']),
            SeasonalEvent('Día del Padre', 'dia_padre', 6, 6, 6, 1.7, 0.78,
                         ['Vehículos', 'Deportes y Fitness', 'Electrónicos']),
            
            # EVENTOS ESTACIONALES
            SeasonalEvent('Regreso a Clases', 'regreso_clases', 3, 3, 3, 2.1, 0.84,
                         ['Electrónicos', 'Deportes y Fitness']),
            SeasonalEvent('Verano', 'verano', 12, 2, 1, 2.5, 0.87,
                         ['Deportes y Fitness', 'Jardín']),
            SeasonalEvent('Vacaciones Invierno', 'vacaciones_invierno', 7, 7, 7, 1.8, 0.76,
                         ['Juegos y Juguetes', 'Electrónicos']),
        ]
    
    def get_events_for_month(self, month: int) -> List[SeasonalEvent]:
        """Obtener eventos para un mes específico"""
        eventos = []
        for evento in self.eventos_chile:
            if evento.start_month <= month <= evento.end_month:
                eventos.append(evento)
        return eventos
    
    def calculate_seasonal_factor(self, categoria: str, month: int) -> Tuple[float, str, float]:
        """Calcular factor estacional para categoría y mes"""
        eventos = self.get_events_for_month(month)
        
        max_factor = 1.0
        evento_principal = None
        max_confianza = 0.0
        
        for evento in eventos:
            if categoria in evento.categories_affected:
                if evento.factor_multiplier > max_factor:
                    max_factor = evento.factor_multiplier
                    evento_principal = evento.name
                    max_confianza = evento.confidence
        
        return max_factor, evento_principal or 'Normal', max_confianza

class TemporalAIPredictor:
    """Predictor IA temporal con eventos chilenos"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.seasonality_engine = ChileanSeasonalityEngine()
        self.model = None
        self.scaler = StandardScaler() if ML_AVAILABLE else None
        self.is_trained = False
        
        # Configuración temporal desde config
        self.lead_time_fabricacion = config.get('tiempoPromedioFabricacion', 30)
        self.lead_time_transito = config.get('tiempoEntrega', 60)
        self.lead_time_total = self.lead_time_fabricacion + self.lead_time_transito
        self.buffer_seguridad = config.get('bufferSeguridad', 10)
        
        logger.info(f"🏭 Lead time configurado: {self.lead_time_total} días total")
        logger.info(f"📦 Fabricación: {self.lead_time_fabricacion}d + 🚢 Tránsito: {self.lead_time_transito}d")
    
    def train_model(self, ventas_historicas: pd.DataFrame, productos_info: pd.DataFrame):
        """Entrenar modelo IA con datos históricos"""
        if not ML_AVAILABLE:
            logger.warning("⚠️ ML no disponible, usando predicciones basadas en reglas")
            return
        
        try:
            logger.info("🤖 Entrenando modelo IA temporal...")
            
            # Preparar features para ML
            features_df = self._prepare_ml_features(ventas_historicas, productos_info)
            
            if len(features_df) < 50:
                logger.warning("⚠️ Pocos datos para ML, usando predicciones simplificadas")
                return
            
            # Separar features y target
            feature_columns = [col for col in features_df.columns if col not in ['cantidad_vendida', 'sku', 'fecha']]
            X = features_df[feature_columns]
            y = features_df['cantidad_vendida']
            
            # Train/test split
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
            
            # Escalar features
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_test_scaled = self.scaler.transform(X_test)
            
            # Entrenar modelo
            self.model = GradientBoostingRegressor(
                n_estimators=200,
                learning_rate=0.1,
                max_depth=6,
                random_state=42
            )
            
            self.model.fit(X_train_scaled, y_train)
            
            # Evaluar modelo
            y_pred = self.model.predict(X_test_scaled)
            mae = mean_absolute_error(y_test, y_pred)
            r2 = r2_score(y_test, y_pred)
            
            logger.info(f"✅ Modelo entrenado - MAE: {mae:.2f}, R²: {r2:.3f}")\n            
            self.is_trained = True
            
        except Exception as e:\n            logger.error(f"❌ Error entrenando modelo: {str(e)}")
    
    def _prepare_ml_features(self, ventas_df: pd.DataFrame, productos_df: pd.DataFrame) -> pd.DataFrame:
        """Preparar features para machine learning"""
        # Agrupar ventas por SKU y fecha
        ventas_agg = ventas_df.groupby(['sku', 'fecha_venta']).agg({
            'cantidad': 'sum'
        }).reset_index()
        
        ventas_agg['fecha_venta'] = pd.to_datetime(ventas_agg['fecha_venta'])
        ventas_agg['mes'] = ventas_agg['fecha_venta'].dt.month
        ventas_agg['dia_semana'] = ventas_agg['fecha_venta'].dt.dayofweek
        ventas_agg['dia_mes'] = ventas_agg['fecha_venta'].dt.day
        
        # Features cíclicas para estacionalidad
        ventas_agg['sin_mes'] = np.sin(2 * np.pi * ventas_agg['mes'] / 12)
        ventas_agg['cos_mes'] = np.cos(2 * np.pi * ventas_agg['mes'] / 12)
        ventas_agg['sin_dia'] = np.sin(2 * np.pi * ventas_agg['dia_semana'] / 7)
        ventas_agg['cos_dia'] = np.cos(2 * np.pi * ventas_agg['dia_semana'] / 7)
        
        # Unir con información de productos
        if 'categoria' in productos_df.columns:
            ventas_agg = ventas_agg.merge(productos_df[['sku', 'categoria']], on='sku', how='left')
            # Encode categorías
            le = LabelEncoder()
            ventas_agg['categoria_encoded'] = le.fit_transform(ventas_agg['categoria'].fillna('Unknown'))
        
        # Features estacionales específicas Chile
        ventas_agg['factor_estacional'] = ventas_agg.apply(
            lambda row: self.seasonality_engine.calculate_seasonal_factor(
                row.get('categoria', 'Unknown'), row['mes']
            )[0], axis=1
        )
        
        # Renombrar para consistencia
        ventas_agg = ventas_agg.rename(columns={'cantidad': 'cantidad_vendida', 'fecha_venta': 'fecha'})
        
        return ventas_agg
    
    def predict_demand(self, sku: str, categoria: str, target_month: int, target_year: int = 2025, 
                      historical_data: Dict = None) -> PredictionResult:
        """Predecir demanda para un SKU específico"""
        
        target_date = date(target_year, target_month, 15)  # Medio del mes
        
        # Calcular venta diaria base (desde datos históricos o análisis actual)
        venta_diaria_base = historical_data.get('venta_diaria', 1.0) if historical_data else 1.0
        
        # Factor estacional específico para la categoría y mes
        factor_estacional, evento_principal, confianza_evento = self.seasonality_engine.calculate_seasonal_factor(categoria, target_month)
        
        # Días del mes (aproximación)
        dias_mes = 30
        if target_month in [1, 3, 5, 7, 8, 10, 12]:
            dias_mes = 31
        elif target_month == 2:
            dias_mes = 28
        elif target_month in [4, 6, 9, 11]:
            dias_mes = 30
        
        # Predicción base
        demanda_base = venta_diaria_base * dias_mes
        
        # Aplicar factor estacional
        demanda_con_estacionalidad = demanda_base * factor_estacional
        
        # Factores adicionales MercadoLibre
        ml_factor = 1.0
        ml_event = None
        
        if target_month == 5:  # CyberDay + Día de la Madre
            ml_factor = 1.3  # Factor combinado
            ml_event = "CyberDay + Día Madre"
        elif target_month == 11:  # Black Friday + CyberDay
            ml_factor = 1.5  # Factor máximo
            ml_event = "Black Friday + CyberDay"
        
        demanda_final = demanda_con_estacionalidad * ml_factor
        
        # Buffer de seguridad configurable
        buffer_factor = 1 + (self.buffer_seguridad / 100)  # 10% = 1.1
        demanda_con_buffer = demanda_final * buffer_factor
        
        # Stock en tránsito (si disponible)
        stock_transito = historical_data.get('en_transito', 0) if historical_data else 0
        
        # Cantidad final sugerida
        cantidad_sugerida = max(0, int(demanda_con_buffer - stock_transito))
        
        # Calcular confianza global
        confianza_global = min(0.95, confianza_evento * 0.8 + 0.15)  # Max 95%
        
        # Alerta temporal
        fecha_limite_orden = target_date - timedelta(days=self.lead_time_total)
        fecha_alerta_30d = fecha_limite_orden - timedelta(days=30)
        dias_restantes = (fecha_limite_orden - date.today()).days
        
        alerta_temporal = {
            'fecha_limite_orden': fecha_limite_orden.isoformat(),
            'fecha_alerta_30d': fecha_alerta_30d.isoformat(),
            'dias_restantes': dias_restantes,
            'status_alerta': self._get_alert_status(dias_restantes),
            'mensaje': f"Para {evento_principal} {target_year}: ordenar antes {fecha_limite_orden.strftime('%d %b %Y')}"
        }
        
        # Construir resultado detallado
        factores_aplicados = {
            'venta_diaria_base': round(venta_diaria_base, 2),
            'dias_mes': dias_mes,
            'demanda_base': round(demanda_base, 1),
            'factor_estacional': round(factor_estacional, 2),
            'evento_principal': evento_principal,
            'factor_mercadolibre': round(ml_factor, 2),
            'evento_ml': ml_event,
            'buffer_seguridad': f"{self.buffer_seguridad}%",
            'stock_transito_descontado': stock_transito
        }
        
        logica_detallada = {
            'metodologia': 'IA Temporal Chile + MercadoLibre',
            'formula_aplicada': f"({venta_diaria_base:.1f} × {dias_mes}) × {factor_estacional:.2f} × {ml_factor:.2f} × {buffer_factor:.2f} - {stock_transito}",
            'breakdown_calculo': {
                'paso_1_base': f"{venta_diaria_base:.1f} venta/día × {dias_mes} días = {demanda_base:.0f} unidades",
                'paso_2_estacional': f"{demanda_base:.0f} × {factor_estacional:.2f} ({evento_principal}) = {demanda_con_estacionalidad:.0f} unidades",
                'paso_3_mercadolibre': f"{demanda_con_estacionalidad:.0f} × {ml_factor:.2f} ({ml_event or 'Normal'}) = {demanda_final:.0f} unidades",
                'paso_4_buffer': f"{demanda_final:.0f} × {buffer_factor:.2f} (buffer) = {demanda_con_buffer:.0f} unidades",
                'paso_5_final': f"{demanda_con_buffer:.0f} - {stock_transito} (tránsito) = {cantidad_sugerida} unidades"
            },
            'configuracion_utilizada': {
                'lead_time_fabricacion': self.lead_time_fabricacion,
                'lead_time_transito': self.lead_time_transito,
                'lead_time_total': self.lead_time_total,
                'buffer_seguridad': self.buffer_seguridad
            },
            'confianza_components': {
                'evento_historico': confianza_evento,
                'ajuste_novedad': 0.15,
                'confianza_final': confianza_global
            }
        }
        
        return PredictionResult(
            sku=sku,
            cantidad_predicha=cantidad_sugerida,
            confianza=confianza_global,
            evento_objetivo=f"{evento_principal} {target_year}",
            temporalidad_target=target_date,
            factores_aplicados=factores_aplicados,
            logica_detallada=logica_detallada,
            alerta_temporal=alerta_temporal
        )
    
    def _get_alert_status(self, dias_restantes: int) -> str:
        """Determinar status de alerta basado en días restantes"""
        if dias_restantes < 0:
            return 'vencido'
        elif dias_restantes <= 3:
            return 'critico'
        elif dias_restantes <= 14:
            return 'urgente'
        else:
            return 'planificacion'
    
    def predict_for_all_products(self, productos_df: pd.DataFrame, ventas_historicas: pd.DataFrame = None) -> List[PredictionResult]:
        """Predecir para todos los productos"""
        
        logger.info(f"🔮 Generando predicciones para {len(productos_df)} productos...")
        
        predictions = []
        
        # Próximos eventos críticos (siguiente mes importante)
        hoy = datetime.now()
        next_month = (hoy.month % 12) + 1
        next_year = hoy.year if hoy.month < 12 else hoy.year + 1
        
        # Si estamos en Enero, predecir para Mayo (CyberDay + Día Madre)
        if hoy.month == 1:
            target_month, target_year = 5, hoy.year
        else:
            target_month, target_year = next_month, next_year
        
        for _, producto in productos_df.iterrows():
            try:
                # Datos históricos del producto si están disponibles
                historical_data = {}
                if hasattr(producto, 'venta_diaria'):
                    historical_data['venta_diaria'] = getattr(producto, 'venta_diaria', 1.0)
                if hasattr(producto, 'enTransito'):
                    historical_data['en_transito'] = getattr(producto, 'enTransito', 0)
                
                # Predicción
                prediction = self.predict_demand(
                    sku=producto['sku'],
                    categoria=producto.get('categoria', 'Unknown'),
                    target_month=target_month,
                    target_year=target_year,
                    historical_data=historical_data
                )
                
                predictions.append(prediction)
                
            except Exception as e:
                logger.error(f"❌ Error prediciendo SKU {producto['sku']}: {str(e)}")
        
        logger.info(f"✅ Predicciones completadas: {len(predictions)} exitosas")
        return predictions
    
    def analyze_stock_event(self, sku: str, evento_tipo: str, stock_data: Dict, sales_data: List = None) -> Dict:
        """Analizar evento de stock (quiebre o exceso)"""
        
        analysis = {
            'sku': sku,
            'evento_tipo': evento_tipo,
            'causa_principal': 'unknown',
            'factores_contribuyentes': [],
            'confianza_diagnostico': 0.0,
            'evidencia_detectada': {},
            'recomendaciones': []
        }
        
        try:
            if evento_tipo == 'quiebre_stock':
                analysis = self._analyze_stockout(sku, stock_data, sales_data)
            elif evento_tipo == 'exceso_stock':
                analysis = self._analyze_excess_stock(sku, stock_data, sales_data)
                
        except Exception as e:
            logger.error(f"❌ Error analizando evento {evento_tipo} para {sku}: {str(e)}")
        
        return analysis
    
    def _analyze_stockout(self, sku: str, stock_data: Dict, sales_data: List) -> Dict:
        """Analizar causa de quiebre de stock"""
        
        venta_promedio = stock_data.get('venta_diaria_promedio', 1.0)
        venta_maxima = max([s.get('cantidad', 0) for s in (sales_data or [{}])]) if sales_data else venta_promedio
        fecha_evento = stock_data.get('fecha_evento')
        categoria = stock_data.get('categoria_producto', 'Unknown')
        
        # Detectar pico de demanda
        pico_ratio = venta_maxima / venta_promedio if venta_promedio > 0 else 1
        
        causas_posibles = []
        evidencia = {}
        
        if pico_ratio > 2.5:
            # Pico de demanda anómalo
            causas_posibles.append('pico_demanda_inesperado')
            evidencia['pico_demanda'] = {
                'venta_normal': venta_promedio,
                'venta_maxima': venta_maxima,
                'ratio_incremento': f"{pico_ratio:.1f}x"
            }
            
            # Verificar si coincide con evento estacional
            if fecha_evento:
                fecha_dt = datetime.strptime(fecha_evento, '%Y-%m-%d') if isinstance(fecha_evento, str) else fecha_evento
                mes_evento = fecha_dt.month
                
                factor_estacional, evento_chile, _ = self.seasonality_engine.calculate_seasonal_factor(categoria, mes_evento)
                
                if factor_estacional > 1.5:
                    causas_posibles.append(f'evento_estacional_{evento_chile.lower().replace(" ", "_")}')
                    evidencia['evento_estacional'] = {
                        'evento_detectado': evento_chile,
                        'factor_historico': factor_estacional,
                        'mes': mes_evento
                    }
        
        # Determinar causa principal
        causa_principal = causas_posibles[0] if causas_posibles else 'demanda_superior_stock'
        
        # Recomendaciones específicas
        recomendaciones = []
        if 'evento_estacional' in evidencia:
            evento_nombre = evidencia['evento_estacional']['evento_detectado']
            recomendaciones.extend([
                f"Preparar stock 3x normal para próximo {evento_nombre}",
                f"Crear alerta 90 días antes de {evento_nombre}",
                "Coordinar con equipo marketing eventos estacionales"
            ])
        else:
            recomendaciones.extend([
                f"Aumentar stock seguridad en {int(pico_ratio * 50)}%",
                "Implementar alertas tempranas de demanda anómala",
                "Revisar capacidad logística para picos"
            ])
        
        return {
            'sku': sku,
            'evento_tipo': 'quiebre_stock',
            'causa_principal': causa_principal,
            'factores_contribuyentes': causas_posibles[1:],
            'confianza_diagnostico': min(0.95, 0.6 + (pico_ratio / 10)),
            'evidencia_detectada': evidencia,
            'recomendaciones': recomendaciones
        }
    
    def _analyze_excess_stock(self, sku: str, stock_data: Dict, sales_data: List) -> Dict:
        """Analizar causa de exceso de stock"""
        
        dias_cobertura = stock_data.get('dias_cobertura_durante', 0)
        venta_actual = stock_data.get('venta_diaria_promedio', 1.0)
        
        causas_posibles = []
        evidencia = {}
        
        if dias_cobertura > 120:  # Más de 4 meses
            causas_posibles.append('sobrecompra_inicial')
            evidencia['exceso_severo'] = {
                'dias_cobertura': dias_cobertura,
                'meses_cobertura': round(dias_cobertura / 30, 1)
            }
        
        # Verificar caída de demanda
        if sales_data and len(sales_data) >= 2:
            ventas_recientes = [s.get('cantidad', 0) for s in sales_data[-5:]]  # Últimas 5 ventas
            ventas_anteriores = [s.get('cantidad', 0) for s in sales_data[-10:-5]]  # 5 anteriores
            
            if ventas_anteriores:
                promedio_anterior = sum(ventas_anteriores) / len(ventas_anteriores)
                promedio_reciente = sum(ventas_recientes) / len(ventas_recientes)
                
                if promedio_reciente < promedio_anterior * 0.7:  # Caída >30%
                    causas_posibles.append('caida_demanda')
                    evidencia['caida_demanda'] = {
                        'venta_anterior': promedio_anterior,
                        'venta_reciente': promedio_reciente,
                        'porcentaje_caida': f"{(1 - promedio_reciente/promedio_anterior)*100:.1f}%"
                    }
        
        # Causa principal
        causa_principal = causas_posibles[0] if causas_posibles else 'stock_excesivo'
        
        # Recomendaciones
        recomendaciones = [
            f"Evaluar promoción temporal para mover {int(dias_cobertura/30)} meses stock",
            "Pausar órdenes futuras hasta normalizar stock",
            "Considerar liquidación si producto en declive"
        ]
        
        if 'caida_demanda' in evidencia:
            recomendaciones.insert(0, "Investigar causa caída demanda (competencia, precio, mercado)")
        
        return {
            'sku': sku,
            'evento_tipo': 'exceso_stock',
            'causa_principal': causa_principal,
            'factores_contribuyentes': causas_posibles[1:],
            'confianza_diagnostico': 0.85,
            'evidencia_detectada': evidencia,
            'recomendaciones': recomendaciones
        }

class TemporalAlertSystem:
    """Sistema de alertas temporales automático"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.lead_time_total = config.get('tiempoPromedioFabricacion', 30) + config.get('tiempoEntrega', 60)
    
    def generate_temporal_alerts(self, current_date: date = None) -> List[Dict]:
        """Generar alertas temporales para eventos críticos"""
        
        if current_date is None:
            current_date = date.today()
        
        # Eventos críticos 2025
        eventos_criticos = [
            {'nombre': 'Día de la Madre 2025', 'fecha': date(2025, 5, 11), 'tipo': 'dia_madre'},
            {'nombre': 'CyberDay Mayo 2025', 'fecha': date(2025, 5, 15), 'tipo': 'cyberday'},
            {'nombre': 'Día del Padre 2025', 'fecha': date(2025, 6, 15), 'tipo': 'dia_padre'},
            {'nombre': 'Día del Niño 2025', 'fecha': date(2025, 8, 10), 'tipo': 'dia_nino'},
            {'nombre': 'Fiestas Patrias 2025', 'fecha': date(2025, 9, 18), 'tipo': 'fiestas_patrias'},
            {'nombre': 'Black Friday 2025', 'fecha': date(2025, 11, 28), 'tipo': 'black_friday'},
            {'nombre': 'Navidad 2025', 'fecha': date(2025, 12, 25), 'tipo': 'navidad'},
        ]
        
        alertas = []
        
        for evento in eventos_criticos:
            fecha_limite = evento['fecha'] - timedelta(days=self.lead_time_total)
            fecha_alerta_30d = fecha_limite - timedelta(days=30)
            dias_restantes = (fecha_limite - current_date).days
            
            if dias_restantes >= -30:  # Solo alertas relevantes
                
                # Determinar status
                if dias_restantes < 0:
                    status = 'vencido'
                elif dias_restantes <= 3:
                    status = 'critico'
                elif dias_restantes <= 14:
                    status = 'urgente'
                else:
                    status = 'planificacion'
                
                alerta = {
                    'evento_nombre': evento['nombre'],
                    'evento_tipo': evento['tipo'],
                    'fecha_evento': evento['fecha'].isoformat(),
                    'fecha_limite_orden': fecha_limite.isoformat(),
                    'fecha_alerta_30d': fecha_alerta_30d.isoformat(),
                    'dias_restantes': dias_restantes,
                    'status_alerta': status,
                    'mensaje': f"Para {evento['nombre']}: {'¡VENCIDO!' if dias_restantes < 0 else f'ordenar antes {fecha_limite.strftime(\"%d %b %Y\")}'}"
                }
                
                alertas.append(alerta)
        
        return alertas

def main():
    """Función principal para testing"""
    
    # Configuración de prueba
    config_test = {
        'tiempoPromedioFabricacion': 30,
        'tiempoEntrega': 60,
        'bufferSeguridad': 10
    }
    
    # Inicializar sistema
    predictor = TemporalAIPredictor(config_test)
    alert_system = TemporalAlertSystem(config_test)
    
    # Datos de prueba
    producto_test = {
        'sku': 'TEST-001',
        'categoria': 'Electrónicos',
        'venta_diaria': 2.5,
        'enTransito': 0
    }
    
    # Predicción de prueba para Mayo 2025 (CyberDay)
    resultado = predictor.predict_demand(
        sku=producto_test['sku'],
        categoria=producto_test['categoria'],
        target_month=5,
        target_year=2025,
        historical_data=producto_test
    )
    
    print("🎯 RESULTADO PREDICCIÓN IA:")
    print(f"SKU: {resultado.sku}")
    print(f"Cantidad Predicha: {resultado.cantidad_predicha}")
    print(f"Confianza: {resultado.confianza:.1%}")
    print(f"Evento: {resultado.evento_objetivo}")
    print(f"Días restantes para ordenar: {resultado.alerta_temporal['dias_restantes']}")
    
    # Alertas temporales
    alertas = alert_system.generate_temporal_alerts()
    print(f"\n📅 ALERTAS TEMPORALES ACTIVAS: {len(alertas)}")
    for alerta in alertas[:3]:  # Primeras 3
        print(f"- {alerta['evento_nombre']}: {alerta['dias_restantes']} días ({alerta['status_alerta']})")

if __name__ == "__main__":
    main()