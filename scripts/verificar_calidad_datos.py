"""
Script para verificar calidad de datos históricos
ANTES de cargar a Supabase

Uso:
    python scripts/verificar_calidad_datos.py datos_2_años.xlsx
"""

import sys
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict


class ValidadorDatos:
    """Valida calidad de datos históricos para forecasting"""

    def __init__(self, archivo_path: str):
        self.archivo_path = archivo_path
        self.df = None
        self.problemas = []
        self.advertencias = []
        self.stats = {}


    def cargar_archivo(self):
        """Carga archivo Excel o CSV"""
        print(f"\n{'='*60}")
        print(f"VALIDADOR DE DATOS HISTÓRICOS")
        print(f"{'='*60}")
        print(f"Archivo: {self.archivo_path}\n")

        try:
            if self.archivo_path.endswith('.xlsx') or self.archivo_path.endswith('.xlsm'):
                # Intentar leer como Excel
                print("📊 Leyendo Excel...")
                self.df = pd.read_excel(self.archivo_path, sheet_name='ventas')
            elif self.archivo_path.endswith('.csv'):
                print("📄 Leyendo CSV...")
                self.df = pd.read_csv(self.archivo_path)
            else:
                raise ValueError("Formato no soportado. Use .xlsx, .xlsm o .csv")

            print(f"✅ Archivo cargado: {len(self.df):,} registros\n")

        except Exception as e:
            print(f"❌ Error cargando archivo: {e}")
            sys.exit(1)


    def validar_columnas_requeridas(self):
        """Verifica que existan columnas necesarias"""
        print("🔍 Validando columnas...")

        columnas_requeridas = ['fecha', 'sku', 'unidades']
        columnas_opcionales = ['precio', 'empresa', 'canal']

        # Normalizar nombres de columnas
        columnas_df = [col.lower().strip() for col in self.df.columns]

        faltantes = []
        for col in columnas_requeridas:
            if col not in columnas_df:
                faltantes.append(col)

        if faltantes:
            self.problemas.append(f"❌ Faltan columnas: {', '.join(faltantes)}")
            print(f"   ❌ Faltan columnas: {', '.join(faltantes)}")
        else:
            print("   ✅ Columnas requeridas presentes")

        # Verificar opcionales
        for col in columnas_opcionales:
            if col not in columnas_df:
                self.advertencias.append(f"⚠️  Columna opcional '{col}' no encontrada")


    def validar_cobertura_temporal(self):
        """Verifica que haya al menos 2 años de datos"""
        print("\n📅 Validando cobertura temporal...")

        # Convertir fechas
        try:
            self.df['fecha'] = pd.to_datetime(self.df['fecha'])
        except Exception as e:
            self.problemas.append(f"❌ Error parseando fechas: {e}")
            return

        fecha_min = self.df['fecha'].min()
        fecha_max = self.df['fecha'].max()
        dias_total = (fecha_max - fecha_min).days

        print(f"   Fecha inicio: {fecha_min.date()}")
        print(f"   Fecha fin: {fecha_max.date()}")
        print(f"   Total días: {dias_total}")

        self.stats['fecha_min'] = fecha_min
        self.stats['fecha_max'] = fecha_max
        self.stats['dias_total'] = dias_total

        # Validar 2 años
        if dias_total < 730:  # 2 años
            self.problemas.append(
                f"❌ Solo {dias_total} días de datos (necesario: 730+)"
            )
            print(f"   ❌ Insuficiente: Solo {dias_total} días (necesario: 730+)")
        else:
            print(f"   ✅ Suficiente: {dias_total} días")

        # Verificar años incluidos
        años = self.df['fecha'].dt.year.unique()
        print(f"   Años incluidos: {sorted(años)}")

        if len(años) < 2:
            self.problemas.append("❌ Necesita datos de al menos 2 años diferentes")


    def validar_fechas_clave(self):
        """Verifica que incluya fechas importantes (Navidad, Black Friday)"""
        print("\n🎄 Validando fechas clave...")

        años = self.df['fecha'].dt.year.unique()

        fechas_clave = {
            'Navidad': (12, 20, 12, 31),  # 20-31 Dic
            'Black Friday': (11, 25, 11, 30),  # 25-30 Nov
            'Fiestas Patrias': (9, 15, 9, 21),  # 15-21 Sep
        }

        for evento, (mes_inicio, dia_inicio, mes_fin, dia_fin) in fechas_clave.items():
            años_con_evento = []

            for año in años:
                fecha_inicio = pd.Timestamp(año, mes_inicio, dia_inicio)
                fecha_fin = pd.Timestamp(año, mes_fin, dia_fin)

                ventas_evento = self.df[
                    (self.df['fecha'] >= fecha_inicio) &
                    (self.df['fecha'] <= fecha_fin)
                ]

                if len(ventas_evento) > 0:
                    años_con_evento.append(año)

            if len(años_con_evento) >= 2:
                print(f"   ✅ {evento}: {años_con_evento}")
            elif len(años_con_evento) == 1:
                self.advertencias.append(
                    f"⚠️  {evento}: Solo en {años_con_evento[0]} (ideal: 2+ años)"
                )
                print(f"   ⚠️  {evento}: Solo en {años_con_evento[0]}")
            else:
                self.advertencias.append(f"⚠️  {evento}: No encontrado en datos")
                print(f"   ⚠️  {evento}: No encontrado")


    def validar_por_sku(self):
        """Valida cada SKU individualmente"""
        print("\n📦 Validando por SKU...")

        skus_total = self.df['sku'].nunique()
        print(f"   Total SKUs: {skus_total:,}\n")

        # Agrupar por SKU
        sku_stats = []

        for sku in self.df['sku'].unique()[:100]:  # Analizar primeros 100
            df_sku = self.df[self.df['sku'] == sku]

            fecha_min = df_sku['fecha'].min()
            fecha_max = df_sku['fecha'].max()
            dias_datos = (fecha_max - fecha_min).days
            registros = len(df_sku)
            unidades_totales = df_sku['unidades'].sum()

            sku_stats.append({
                'sku': sku,
                'dias_datos': dias_datos,
                'registros': registros,
                'unidades_totales': unidades_totales,
                'fecha_min': fecha_min,
                'fecha_max': fecha_max
            })

        df_stats = pd.DataFrame(sku_stats)

        # SKUs con suficientes datos
        skus_buenos = df_stats[df_stats['dias_datos'] >= 365]
        skus_malos = df_stats[df_stats['dias_datos'] < 365]

        print(f"   ✅ SKUs con 365+ días: {len(skus_buenos)} ({len(skus_buenos)/len(df_stats)*100:.1f}%)")
        print(f"   ⚠️  SKUs con <365 días: {len(skus_malos)} ({len(skus_malos)/len(df_stats)*100:.1f}%)")

        self.stats['skus_total'] = skus_total
        self.stats['skus_buenos'] = len(skus_buenos)
        self.stats['skus_malos'] = len(skus_malos)

        # Top 10 SKUs por volumen
        print("\n   📊 Top 10 SKUs por volumen:")
        top10 = df_stats.nlargest(10, 'unidades_totales')
        for idx, row in top10.iterrows():
            print(f"      {row['sku']}: {row['unidades_totales']:,.0f} unidades ({row['dias_datos']} días)")

        # SKUs problemáticos
        if len(skus_malos) > 0:
            print(f"\n   ⚠️  Primeros 5 SKUs con pocos datos:")
            for idx, row in skus_malos.head(5).iterrows():
                print(f"      {row['sku']}: Solo {row['dias_datos']} días")

            self.advertencias.append(
                f"{len(skus_malos)} SKUs tienen <365 días de datos (no aptos para Prophet)"
            )


    def detectar_gaps(self):
        """Detecta gaps (días sin ventas) en los datos"""
        print("\n🔍 Detectando gaps...")

        # Analizar gaps por SKU (top 20)
        skus_analizar = self.df['sku'].value_counts().head(20).index

        gaps_encontrados = []

        for sku in skus_analizar:
            df_sku = self.df[self.df['sku'] == sku].copy()
            df_sku = df_sku.sort_values('fecha')

            # Crear serie temporal diaria
            fecha_min = df_sku['fecha'].min()
            fecha_max = df_sku['fecha'].max()

            rango_fechas = pd.date_range(fecha_min, fecha_max, freq='D')
            fechas_con_venta = set(df_sku['fecha'].dt.date)

            # Encontrar gaps de 30+ días
            gap_actual = 0
            fecha_inicio_gap = None

            for fecha in rango_fechas:
                if fecha.date() not in fechas_con_venta:
                    if gap_actual == 0:
                        fecha_inicio_gap = fecha
                    gap_actual += 1
                else:
                    if gap_actual >= 30:
                        gaps_encontrados.append({
                            'sku': sku,
                            'dias_gap': gap_actual,
                            'fecha_inicio': fecha_inicio_gap,
                            'fecha_fin': fecha - timedelta(days=1)
                        })
                    gap_actual = 0

        if len(gaps_encontrados) > 0:
            print(f"   ⚠️  {len(gaps_encontrados)} gaps de 30+ días encontrados:")
            for gap in gaps_encontrados[:5]:
                print(f"      {gap['sku']}: {gap['dias_gap']} días ({gap['fecha_inicio'].date()} - {gap['fecha_fin'].date()})")

            self.advertencias.append(
                f"{len(gaps_encontrados)} gaps largos detectados (puede afectar Prophet)"
            )
        else:
            print("   ✅ No se encontraron gaps significativos")


    def validar_datos_numericos(self):
        """Valida que unidades y precios sean válidos"""
        print("\n🔢 Validando datos numéricos...")

        # Unidades
        try:
            unidades_invalidas = self.df[self.df['unidades'] <= 0]
            if len(unidades_invalidas) > 0:
                self.advertencias.append(
                    f"⚠️  {len(unidades_invalidas)} registros con unidades <= 0"
                )
                print(f"   ⚠️  {len(unidades_invalidas)} registros con unidades <= 0")
            else:
                print("   ✅ Todas las unidades son > 0")

            # Valores extremos
            q99 = self.df['unidades'].quantile(0.99)
            extremos = self.df[self.df['unidades'] > q99 * 10]
            if len(extremos) > 0:
                print(f"   ⚠️  {len(extremos)} valores extremos detectados (pueden ser outliers)")

        except Exception as e:
            self.problemas.append(f"❌ Error validando unidades: {e}")

        # Precios (si existe la columna)
        if 'precio' in [col.lower() for col in self.df.columns]:
            try:
                precios_invalidos = self.df[self.df['precio'] <= 0]
                if len(precios_invalidos) > 0:
                    self.advertencias.append(
                        f"⚠️  {len(precios_invalidos)} registros con precio <= 0"
                    )
            except:
                pass


    def generar_reporte(self):
        """Genera reporte final de validación"""
        print(f"\n{'='*60}")
        print("REPORTE DE VALIDACIÓN")
        print(f"{'='*60}\n")

        # Problemas críticos
        if self.problemas:
            print("❌ PROBLEMAS CRÍTICOS (deben corregirse):")
            for problema in self.problemas:
                print(f"   {problema}")
            print()

        # Advertencias
        if self.advertencias:
            print("⚠️  ADVERTENCIAS (revisar):")
            for advertencia in self.advertencias:
                print(f"   {advertencia}")
            print()

        # Estadísticas
        print("📊 ESTADÍSTICAS:")
        print(f"   Total registros: {len(self.df):,}")
        print(f"   Total SKUs: {self.stats.get('skus_total', 'N/A'):,}")
        print(f"   SKUs con 365+ días: {self.stats.get('skus_buenos', 'N/A')}")
        print(f"   Rango fechas: {self.stats.get('fecha_min', 'N/A')} a {self.stats.get('fecha_max', 'N/A')}")
        print(f"   Total días: {self.stats.get('dias_total', 'N/A')}")
        print()

        # Veredicto final
        print(f"{'='*60}")
        if not self.problemas:
            print("✅ DATOS APTOS PARA PROPHET")
            print("   Puede proceder a cargar en Supabase")
        else:
            print("❌ DATOS NO APTOS")
            print(f"   Corrija {len(self.problemas)} problema(s) crítico(s)")
        print(f"{'='*60}\n")


    def ejecutar_validacion(self):
        """Ejecuta todas las validaciones"""
        self.cargar_archivo()
        self.validar_columnas_requeridas()
        self.validar_cobertura_temporal()
        self.validar_fechas_clave()
        self.validar_por_sku()
        self.detectar_gaps()
        self.validar_datos_numericos()
        self.generar_reporte()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python verificar_calidad_datos.py <archivo.xlsx>")
        print("\nEjemplo:")
        print("  python verificar_calidad_datos.py datos_2_años.xlsx")
        sys.exit(1)

    archivo = sys.argv[1]

    if not Path(archivo).exists():
        print(f"❌ Archivo no encontrado: {archivo}")
        sys.exit(1)

    validador = ValidadorDatos(archivo)
    validador.ejecutar_validacion()
