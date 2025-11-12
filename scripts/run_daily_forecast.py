"""
Script principal para ejecutar forecasting diario
Ejecutado por GitHub Actions
"""

import os
import sys
from pathlib import Path
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from supabase import create_client, Client

# Agregar path del proyecto
sys.path.append(str(Path(__file__).parent.parent))

from algoritmo_ml_avanzado import AlgoritmoMLAvanzado


def sanitize_float(value):
    """Convierte float a JSON-serializable, manejando inf/NaN"""
    try:
        f = float(value)
        # Reemplazar inf y NaN con None
        if np.isinf(f) or np.isnan(f):
            return 0.0
        return f
    except (ValueError, TypeError):
        return 0.0


def sanitize_bool(value):
    """Convierte NumPy bool a Python bool"""
    return bool(value)


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

        # Cargar matriz de packs
        self.packs_dict = self._cargar_packs()


    def _cargar_packs(self) -> dict:
        """Carga la matriz de packs para descomposición"""
        print(f"\n📦 Cargando matriz de packs...")

        response = self.supabase.table('packs').select('*').execute()

        if not response.data:
            print("   ℹ️  No hay packs configurados")
            return {}

        # Crear diccionario: {sku_pack: [(sku_componente, cantidad), ...]}
        packs = {}
        for row in response.data:
            sku_pack = row['sku_pack']
            sku_comp = row['sku_componente']
            cantidad = float(row['cantidad'])

            if sku_pack not in packs:
                packs[sku_pack] = []
            packs[sku_pack].append((sku_comp, cantidad))

        print(f"   ✓ {len(packs)} packs configurados")
        return packs


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

        # Expandir packs a SKUs componentes
        if self.packs_dict:
            df = self._expandir_packs(df)

        return df


    def _expandir_packs(self, df: pd.DataFrame) -> pd.DataFrame:
        """Expande las ventas de packs a sus SKUs componentes"""
        print(f"\n📦 Expandiendo packs a SKUs componentes...")

        ventas_expandidas = []
        packs_encontrados = 0

        for _, row in df.iterrows():
            sku = row['sku']

            # Si es un pack, expandir
            if sku in self.packs_dict:
                packs_encontrados += 1
                componentes = self.packs_dict[sku]

                for sku_comp, cantidad in componentes:
                    row_expandida = row.copy()
                    row_expandida['sku'] = sku_comp
                    row_expandida['unidades'] = row['unidades'] * cantidad
                    ventas_expandidas.append(row_expandida)
            else:
                # No es un pack, mantener como está
                ventas_expandidas.append(row)

        df_expandido = pd.DataFrame(ventas_expandidas)

        print(f"   ✓ {packs_encontrados} registros de packs expandidos")
        print(f"   ✓ {len(df_expandido)} registros totales después de expansión")
        print(f"   ✓ {df_expandido['sku'].nunique()} SKUs únicos")

        return df_expandido


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

        # Primero, eliminar predicciones antiguas de hoy para evitar duplicados
        fecha_hoy = datetime.now().date().isoformat()
        fecha_manana = (datetime.now().date() + timedelta(days=1)).isoformat()

        print(f"   🗑️  Limpiando predicciones antiguas del {fecha_hoy}...")
        try:
            # Contar cuántas hay antes de borrar (usando count, no len(data))
            response_count = self.supabase.table('predicciones') \
                .select('*', count='exact', head=True) \
                .gte('fecha_calculo', fecha_hoy) \
                .lt('fecha_calculo', fecha_manana) \
                .execute()

            count_antiguas = response_count.count if hasattr(response_count, 'count') else 0

            if count_antiguas > 0:
                # Eliminar predicciones en lotes para evitar límite de 1000
                total_eliminadas = 0
                while True:
                    response_delete = self.supabase.table('predicciones') \
                        .delete() \
                        .gte('fecha_calculo', fecha_hoy) \
                        .lt('fecha_calculo', fecha_manana) \
                        .limit(1000) \
                        .execute()

                    eliminadas_batch = len(response_delete.data) if response_delete.data else 0
                    total_eliminadas += eliminadas_batch

                    if eliminadas_batch < 1000:
                        break  # No hay más registros que eliminar

                print(f"   ✓ {total_eliminadas} predicciones antiguas eliminadas")
            else:
                print(f"   ℹ️  No hay predicciones antiguas para hoy")
        except Exception as e:
            print(f"   ⚠️  Error limpiando predicciones antiguas: {e}")
            # Continuar de todos modos

        # Convertir predicciones a formato JSON
        registros = []
        for pred in predicciones:
            registro = {
                'sku': pred.sku,
                'fecha_calculo': datetime.now().isoformat(),
                'venta_diaria_promedio': sanitize_float(pred.venta_diaria_promedio),
                'venta_diaria_p50': sanitize_float(pred.venta_diaria_p50),
                'venta_diaria_p75': sanitize_float(pred.venta_diaria_p75),
                'venta_diaria_p90': sanitize_float(pred.venta_diaria_p90),
                'desviacion_estandar': sanitize_float(pred.desviacion_estandar),
                'coeficiente_variacion': sanitize_float(pred.coeficiente_variacion),
                'tendencia': pred.tendencia,
                'tasa_crecimiento_mensual': sanitize_float(pred.tasa_crecimiento_mensual),
                'stock_actual': sanitize_float(pred.stock_actual),
                'stock_optimo': sanitize_float(pred.stock_optimo),
                'stock_seguridad': sanitize_float(pred.stock_seguridad),
                'dias_stock_actual': sanitize_float(pred.dias_stock_actual),
                'transito_china': sanitize_float(pred.transito_china),
                'sugerencia_reposicion': sanitize_float(pred.sugerencia_reposicion),
                'sugerencia_reposicion_p75': sanitize_float(pred.sugerencia_reposicion_p75),
                'sugerencia_reposicion_p90': sanitize_float(pred.sugerencia_reposicion_p90),
                'precio_unitario': sanitize_float(pred.precio_unitario),
                'valor_total_sugerencia': sanitize_float(pred.valor_total_sugerencia),
                'periodo_inicio': pred.periodo_inicio.isoformat(),
                'periodo_fin': pred.periodo_fin.isoformat(),
                'dias_periodo': int(pred.dias_periodo),
                'unidades_totales_periodo': sanitize_float(pred.unidades_totales_periodo),
                'clasificacion_abc': pred.clasificacion_abc,
                'clasificacion_xyz': pred.clasificacion_xyz,
                'es_demanda_intermitente': sanitize_bool(pred.es_demanda_intermitente),
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
            'mape_abc_a': sanitize_float(cv_a),  # Usando CV como proxy
            'mape_abc_b': sanitize_float(cv_b),
            'mape_abc_c': sanitize_float(cv_c),
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
                    'valor_actual': sanitize_float(pred.dias_stock_actual),
                    'valor_esperado': sanitize_float(self.dias_stock_deseado),
                    'estado': 'activa'
                })

            # Alerta: Exceso de stock
            if pred.dias_stock_actual > 180:
                alertas_registros.append({
                    'sku': pred.sku,
                    'tipo_alerta': 'exceso_stock',
                    'severidad': 'media',
                    'mensaje': f'{pred.dias_stock_actual:.0f} días de stock (exceso)',
                    'valor_actual': sanitize_float(pred.dias_stock_actual),
                    'valor_esperado': sanitize_float(self.dias_stock_deseado),
                    'estado': 'activa'
                })

            # Alerta: Demanda en declive
            if pred.tendencia == 'decreciente' and pred.tasa_crecimiento_mensual < -10:
                alertas_registros.append({
                    'sku': pred.sku,
                    'tipo_alerta': 'demanda_anomala',
                    'severidad': 'media',
                    'mensaje': f'Demanda cayendo {abs(pred.tasa_crecimiento_mensual):.1f}% mensual',
                    'valor_actual': sanitize_float(pred.tasa_crecimiento_mensual),
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

            # Filtrar SKUs tipo PACK de las predicciones
            if predicciones:
                predicciones_filtradas = [p for p in predicciones if not p.sku.startswith('PACK')]
                packs_filtrados = len(predicciones) - len(predicciones_filtradas)
                print(f"   ✓ {packs_filtrados} SKUs tipo PACK filtrados")
                print(f"   ✓ {len(predicciones_filtradas)} predicciones de SKUs reales")
                predicciones = predicciones_filtradas

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
