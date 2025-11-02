"""
Script principal para ejecutar forecasting diario
Ejecutado por GitHub Actions
"""

import os
import sys
from pathlib import Path
import pandas as pd
import numpy as np
from datetime import datetime
from supabase import create_client, Client

# Agregar path del proyecto
sys.path.append(str(Path(__file__).parent.parent))

from algoritmo_ml_avanzado import AlgoritmoMLAvanzado


class ForecastPipeline:
    """Pipeline completo de forecasting"""

    def __init__(self):
        # Configuración desde variables de entorno
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_KEY')
        self.dias_stock_deseado = int(os.getenv('DIAS_STOCK_DESEADO', '90'))
        self.nivel_servicio = float(os.getenv('NIVEL_SERVICIO', '0.95'))

        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Faltan credenciales de Supabase en variables de entorno")

        # Conectar a Supabase
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)

        # Inicializar algoritmo
        self.algoritmo = AlgoritmoMLAvanzado(
            dias_stock_deseado=self.dias_stock_deseado,
            nivel_servicio=self.nivel_servicio
        )

        print(f"✅ Pipeline inicializado")
        print(f"   - Días stock deseado: {self.dias_stock_deseado}")
        print(f"   - Nivel de servicio: {self.nivel_servicio * 100}%")


    def cargar_datos_ventas(self, dias_historico: int = 180) -> pd.DataFrame:
        """Carga ventas de los últimos N días desde Supabase con paginación"""
        print(f"\n📥 Cargando ventas de últimos {dias_historico} días...")

        fecha_inicio = (datetime.now() - pd.Timedelta(days=dias_historico)).strftime('%Y-%m-%d')

        # Cargar todos los datos con paginación
        all_data = []
        page_size = 1000
        offset = 0

        while True:
            response = self.supabase.table('ventas_historicas') \
                .select('*') \
                .gte('fecha', fecha_inicio) \
                .range(offset, offset + page_size - 1) \
                .execute()

            if not response.data or len(response.data) == 0:
                break

            all_data.extend(response.data)
            print(f"   ✓ Descargados {len(all_data)} registros...")

            if len(response.data) < page_size:
                break

            offset += page_size

        if not all_data:
            print("⚠️  No se encontraron ventas")
            return pd.DataFrame()

        df = pd.DataFrame(all_data)
        df['fecha'] = pd.to_datetime(df['fecha'])

        print(f"   ✓ {len(df)} registros cargados")
        print(f"   ✓ {df['sku'].nunique()} SKUs únicos")

        return df


    def cargar_datos_stock(self) -> pd.DataFrame:
        """Carga stock actual desde Supabase con paginación"""
        print(f"\n📦 Cargando stock actual...")

        all_data = []
        page_size = 1000
        offset = 0

        while True:
            response = self.supabase.table('stock_actual') \
                .select('*') \
                .range(offset, offset + page_size - 1) \
                .execute()

            if not response.data or len(response.data) == 0:
                break

            all_data.extend(response.data)

            if len(response.data) < page_size:
                break

            offset += page_size

        if not all_data:
            print("⚠️  No se encontró información de stock")
            return pd.DataFrame()

        df = pd.DataFrame(all_data)

        print(f"   ✓ {len(df)} SKUs con stock")

        return df


    def cargar_datos_transito(self) -> pd.DataFrame:
        """Carga tránsito desde China"""
        print(f"\n🚢 Cargando tránsito China...")

        response = self.supabase.table('transito_china') \
            .select('*') \
            .filter('estado', 'eq', 'en_transito') \
            .execute()

        if not response.data:
            print("   ℹ️  No hay tránsito en curso")
            return pd.DataFrame()

        df = pd.DataFrame(response.data)

        print(f"   ✓ {len(df)} registros de tránsito")

        return df


    def guardar_predicciones(self, predicciones: list):
        """Guarda predicciones en Supabase"""
        print(f"\n💾 Guardando {len(predicciones)} predicciones...")

        # Convertir predicciones a formato JSON
        registros = []
        for pred in predicciones:
            registro = {
                'sku': pred.sku,
                'fecha_calculo': datetime.now().isoformat(),
                'venta_diaria_promedio': float(pred.venta_diaria_promedio),
                'venta_diaria_p50': float(pred.venta_diaria_p50),
                'venta_diaria_p75': float(pred.venta_diaria_p75),
                'venta_diaria_p90': float(pred.venta_diaria_p90),
                'desviacion_estandar': float(pred.desviacion_estandar),
                'coeficiente_variacion': float(pred.coeficiente_variacion),
                'tendencia': pred.tendencia,
                'tasa_crecimiento_mensual': float(pred.tasa_crecimiento_mensual),
                'stock_actual': float(pred.stock_actual),
                'stock_optimo': float(pred.stock_optimo),
                'stock_seguridad': float(pred.stock_seguridad),
                'dias_stock_actual': float(pred.dias_stock_actual),
                'transito_china': float(pred.transito_china),
                'sugerencia_reposicion': float(pred.sugerencia_reposicion),
                'sugerencia_reposicion_p75': float(pred.sugerencia_reposicion_p75),
                'sugerencia_reposicion_p90': float(pred.sugerencia_reposicion_p90),
                'precio_unitario': float(pred.precio_unitario),
                'valor_total_sugerencia': float(pred.valor_total_sugerencia),
                'periodo_inicio': pred.periodo_inicio.isoformat(),
                'periodo_fin': pred.periodo_fin.isoformat(),
                'dias_periodo': int(pred.dias_periodo),
                'unidades_totales_periodo': float(pred.unidades_totales_periodo),
                'clasificacion_abc': pred.clasificacion_abc,
                'clasificacion_xyz': pred.clasificacion_xyz,
                'es_demanda_intermitente': pred.es_demanda_intermitente,
                'modelo_usado': pred.modelo_usado,
                'observaciones': pred.observaciones,
                'alertas': pred.alertas
            }
            registros.append(registro)

        # Insertar en lotes de 100
        batch_size = 100
        for i in range(0, len(registros), batch_size):
            batch = registros[i:i + batch_size]

            try:
                self.supabase.table('predicciones').insert(batch).execute()
                print(f"   ✓ Batch {i//batch_size + 1} guardado ({len(batch)} registros)")
            except Exception as e:
                print(f"   ❌ Error guardando batch {i//batch_size + 1}: {e}")

        print(f"   ✅ Predicciones guardadas")


    def guardar_metricas(self, predicciones: list):
        """Calcula y guarda métricas del modelo"""
        print(f"\n📊 Calculando métricas del modelo...")

        # Calcular métricas por segmento
        total_skus = len(predicciones)
        skus_abc_a = [p for p in predicciones if p.clasificacion_abc == 'A']
        skus_abc_b = [p for p in predicciones if p.clasificacion_abc == 'B']
        skus_abc_c = [p for p in predicciones if p.clasificacion_abc == 'C']

        # CV promedio por segmento (como proxy de accuracy)
        cv_a = np.mean([p.coeficiente_variacion for p in skus_abc_a]) if skus_abc_a else 0
        cv_b = np.mean([p.coeficiente_variacion for p in skus_abc_b]) if skus_abc_b else 0
        cv_c = np.mean([p.coeficiente_variacion for p in skus_abc_c]) if skus_abc_c else 0
        cv_promedio = np.mean([p.coeficiente_variacion for p in predicciones])

        metricas = {
            'fecha_calculo': datetime.now().date().isoformat(),
            'total_skus': total_skus,
            'mape': None,  # Requiere backtesting
            'mae': None,
            'rmse': None,
            'bias': None,
            'mape_abc_a': cv_a,  # Usando CV como proxy
            'mape_abc_b': cv_b,
            'mape_abc_c': cv_c,
            'skus_con_prediccion': total_skus,
            'skus_sin_datos': 0,
            'tiempo_ejecucion_segundos': 0  # Se calculará después
        }

        try:
            self.supabase.table('metricas_modelo').insert(metricas).execute()
            print(f"   ✓ Métricas guardadas")
        except Exception as e:
            print(f"   ❌ Error guardando métricas: {e}")


    def generar_alertas(self, predicciones: list):
        """Genera y guarda alertas de inventario"""
        print(f"\n🚨 Generando alertas...")

        alertas_registros = []

        for pred in predicciones:
            # Alerta: Stockout inminente
            if pred.dias_stock_actual < 60:
                alertas_registros.append({
                    'sku': pred.sku,
                    'tipo_alerta': 'stockout_inminente',
                    'severidad': 'critica' if pred.dias_stock_actual < 30 else 'alta',
                    'mensaje': f'Solo {pred.dias_stock_actual:.0f} días de stock restantes',
                    'valor_actual': float(pred.dias_stock_actual),
                    'valor_esperado': float(self.dias_stock_deseado),
                    'estado': 'activa'
                })

            # Alerta: Exceso de stock
            if pred.dias_stock_actual > 180:
                alertas_registros.append({
                    'sku': pred.sku,
                    'tipo_alerta': 'exceso_stock',
                    'severidad': 'media',
                    'mensaje': f'{pred.dias_stock_actual:.0f} días de stock (exceso)',
                    'valor_actual': float(pred.dias_stock_actual),
                    'valor_esperado': float(self.dias_stock_deseado),
                    'estado': 'activa'
                })

            # Alerta: Demanda en declive
            if pred.tendencia == 'decreciente' and pred.tasa_crecimiento_mensual < -10:
                alertas_registros.append({
                    'sku': pred.sku,
                    'tipo_alerta': 'demanda_anomala',
                    'severidad': 'media',
                    'mensaje': f'Demanda cayendo {abs(pred.tasa_crecimiento_mensual):.1f}% mensual',
                    'valor_actual': float(pred.tasa_crecimiento_mensual),
                    'valor_esperado': 0.0,
                    'estado': 'activa'
                })

        if alertas_registros:
            try:
                self.supabase.table('alertas_inventario').insert(alertas_registros).execute()
                print(f"   ✓ {len(alertas_registros)} alertas generadas")
            except Exception as e:
                print(f"   ❌ Error guardando alertas: {e}")
        else:
            print(f"   ℹ️  No se generaron nuevas alertas")


    def ejecutar(self):
        """Ejecuta el pipeline completo"""
        print(f"\n{'='*60}")
        print(f"🚀 INICIANDO FORECASTING DIARIO")
        print(f"{'='*60}")
        print(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        inicio = datetime.now()

        try:
            # 1. Cargar datos
            ventas_df = self.cargar_datos_ventas()
            stock_df = self.cargar_datos_stock()
            transito_df = self.cargar_datos_transito()

            if ventas_df.empty:
                print("❌ No hay datos de ventas. Abortando.")
                return

            # 2. Ejecutar forecasting
            print(f"\n🔮 Ejecutando algoritmo ML...")
            predicciones = self.algoritmo.calcular_predicciones_completas(
                ventas_df=ventas_df,
                stock_df=stock_df,
                transito_df=transito_df
            )

            print(f"   ✓ {len(predicciones)} predicciones generadas")

            # 3. Guardar resultados
            if predicciones:
                self.guardar_predicciones(predicciones)
                self.guardar_metricas(predicciones)
                self.generar_alertas(predicciones)

                # 4. Generar resumen
                self.generar_resumen(predicciones, inicio)
            else:
                print("⚠️  No se generaron predicciones")

        except Exception as e:
            print(f"\n❌ ERROR CRÍTICO: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)


    def generar_resumen(self, predicciones: list, inicio: datetime):
        """Genera resumen del forecasting"""
        fin = datetime.now()
        duracion = (fin - inicio).total_seconds()

        print(f"\n{'='*60}")
        print(f"✅ FORECASTING COMPLETADO")
        print(f"{'='*60}")

        # Estadísticas
        total_sugerencia = sum(p.sugerencia_reposicion for p in predicciones)
        total_valor = sum(p.valor_total_sugerencia for p in predicciones)

        skus_a = len([p for p in predicciones if p.clasificacion_abc == 'A'])
        skus_b = len([p for p in predicciones if p.clasificacion_abc == 'B'])
        skus_c = len([p for p in predicciones if p.clasificacion_abc == 'C'])

        alertas_criticas = sum(1 for p in predicciones if any('CRÍTICO' in a for a in p.alertas))

        resumen = f"""
RESUMEN DE FORECASTING
----------------------
Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Duración: {duracion:.1f} segundos

PREDICCIONES
- Total SKUs: {len(predicciones)}
- Clasificación A: {skus_a} SKUs
- Clasificación B: {skus_b} SKUs
- Clasificación C: {skus_c} SKUs

SUGERENCIAS
- Total unidades: {total_sugerencia:,.0f}
- Valor total: ${total_valor:,.0f}

ALERTAS
- Alertas críticas: {alertas_criticas}

TOP 5 POR VALOR
"""

        for i, pred in enumerate(predicciones[:5], 1):
            resumen += f"\n{i}. {pred.sku}: ${pred.valor_total_sugerencia:,.0f} ({pred.sugerencia_reposicion:.0f} unidades)"

        print(resumen)

        # Guardar en archivo
        with open('forecast_summary.txt', 'w', encoding='utf-8') as f:
            f.write(resumen)


if __name__ == "__main__":
    pipeline = ForecastPipeline()
    pipeline.ejecutar()
