"""
Script para cargar datos desde Excel a Supabase
"""

import os
import sys
import pandas as pd
from datetime import datetime
from pathlib import Path
from supabase import create_client

# Cargar variables de entorno
from dotenv import load_dotenv
load_dotenv('.env.local')


class CargadorDatosExcel:
    """Carga datos desde Excel a Supabase"""

    def __init__(self, excel_path: str):
        self.excel_path = excel_path

        # Conectar a Supabase
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_KEY')

        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Faltan credenciales de Supabase en .env.local")

        self.supabase = create_client(self.supabase_url, self.supabase_key)

        print(f"✅ Conectado a Supabase")
        print(f"📁 Archivo: {excel_path}")


    def cargar_ventas(self, sheet_name='ventas'):
        """Carga datos de ventas a Supabase"""
        print(f"\n{'='*60}")
        print(f"📊 CARGANDO VENTAS")
        print(f"{'='*60}")

        try:
            # Leer Excel
            print(f"Leyendo hoja '{sheet_name}'...")
            df = pd.read_excel(self.excel_path, sheet_name=sheet_name)

            print(f"✓ {len(df)} registros encontrados")

            # Mapear columnas según el código VBA
            # Columna A: Empresa, B: Canal, F: Fecha, K: Unidades,
            # T: SKU (col 20), U: MLC (col 21), V: Descripción (col 22), X: Precio (col 24)

            df_ventas = pd.DataFrame({
                'empresa': df.iloc[:, 0],  # Columna A
                'canal': df.iloc[:, 1],    # Columna B
                'fecha': pd.to_datetime(df.iloc[:, 5]),  # Columna F
                'unidades': pd.to_numeric(df.iloc[:, 10], errors='coerce'),  # Columna K
                'sku': df.iloc[:, 19].astype(str).str.strip(),  # Columna T
                'mlc': df.iloc[:, 20].astype(str).str.strip(),  # Columna U
                'descripcion': df.iloc[:, 21].astype(str).str.strip(),  # Columna V
                'precio': pd.to_numeric(df.iloc[:, 23], errors='coerce')  # Columna X
            })

            # Filtrar solo TLT + MELI
            df_ventas = df_ventas[
                (df_ventas['empresa'].str.upper() == 'TLT') &
                (df_ventas['canal'].str.upper() == 'MELI')
            ]

            # Limpiar datos
            df_ventas = df_ventas.dropna(subset=['sku', 'fecha', 'unidades'])
            df_ventas = df_ventas[df_ventas['unidades'] > 0]

            print(f"✓ {len(df_ventas)} registros válidos (TLT + MELI)")

            # Convertir a registros
            registros = df_ventas.to_dict('records')

            # Insertar en lotes
            batch_size = 100
            total_insertados = 0

            for i in range(0, len(registros), batch_size):
                batch = registros[i:i+batch_size]

                try:
                    self.supabase.table('ventas_historicas').insert(batch).execute()
                    total_insertados += len(batch)
                    print(f"  ✓ Batch {i//batch_size + 1}: {len(batch)} registros")
                except Exception as e:
                    print(f"  ⚠️  Error en batch {i//batch_size + 1}: {e}")

            print(f"\n✅ Total insertados: {total_insertados} ventas")

        except Exception as e:
            print(f"❌ Error cargando ventas: {e}")
            import traceback
            traceback.print_exc()


    def cargar_stock(self, sheet_name='Stock'):
        """Carga datos de stock a Supabase"""
        print(f"\n{'='*60}")
        print(f"📦 CARGANDO STOCK")
        print(f"{'='*60}")

        try:
            print(f"Leyendo hoja '{sheet_name}'...")
            df = pd.read_excel(self.excel_path, sheet_name=sheet_name)

            print(f"✓ {len(df)} registros encontrados")

            # Mapear columnas según el código VBA
            # Columna A: SKU, B: Descripción
            # C, D, E, F, H, J: Stock por bodega

            df_stock = pd.DataFrame({
                'sku': df.iloc[:, 0].astype(str).str.strip(),  # Col A
                'descripcion': df.iloc[:, 1].astype(str).str.strip(),  # Col B
                'bodega_c': pd.to_numeric(df.iloc[:, 2], errors='coerce').fillna(0),  # Col C
                'bodega_d': pd.to_numeric(df.iloc[:, 3], errors='coerce').fillna(0),  # Col D
                'bodega_e': pd.to_numeric(df.iloc[:, 4], errors='coerce').fillna(0),  # Col E
                'bodega_f': pd.to_numeric(df.iloc[:, 5], errors='coerce').fillna(0),  # Col F
                'bodega_h': pd.to_numeric(df.iloc[:, 7], errors='coerce').fillna(0),  # Col H
                'bodega_j': pd.to_numeric(df.iloc[:, 9], errors='coerce').fillna(0),  # Col J
            })

            # Limpiar
            df_stock = df_stock.dropna(subset=['sku'])

            print(f"✓ {len(df_stock)} SKUs con stock")

            # Convertir a registros
            registros = df_stock.to_dict('records')

            # Insertar
            batch_size = 100
            total_insertados = 0

            for i in range(0, len(registros), batch_size):
                batch = registros[i:i+batch_size]

                try:
                    self.supabase.table('stock_actual').upsert(batch).execute()
                    total_insertados += len(batch)
                    print(f"  ✓ Batch {i//batch_size + 1}: {len(batch)} registros")
                except Exception as e:
                    print(f"  ⚠️  Error en batch {i//batch_size + 1}: {e}")

            print(f"\n✅ Total insertados: {total_insertados} SKUs")

        except Exception as e:
            print(f"❌ Error cargando stock: {e}")
            import traceback
            traceback.print_exc()


    def cargar_transito_china(self, sheet_name='transito china'):
        """Carga datos de tránsito desde China"""
        print(f"\n{'='*60}")
        print(f"🚢 CARGANDO TRÁNSITO CHINA")
        print(f"{'='*60}")

        try:
            print(f"Leyendo hoja '{sheet_name}'...")
            df = pd.read_excel(self.excel_path, sheet_name=sheet_name)

            print(f"✓ {len(df)} registros encontrados")

            # Mapear columnas según el código VBA
            # Columna D: SKU, H: Total Units

            df_transito = pd.DataFrame({
                'sku': df.iloc[:, 3].astype(str).str.strip(),  # Col D
                'unidades': pd.to_numeric(df.iloc[:, 7], errors='coerce').fillna(0),  # Col H
                'estado': 'en_transito'
            })

            # Limpiar
            df_transito = df_transito.dropna(subset=['sku'])
            df_transito = df_transito[df_transito['unidades'] > 0]

            print(f"✓ {len(df_transito)} registros válidos")

            # Convertir a registros
            registros = df_transito.to_dict('records')

            if registros:
                try:
                    self.supabase.table('transito_china').insert(registros).execute()
                    print(f"✅ {len(registros)} registros insertados")
                except Exception as e:
                    print(f"⚠️  Error: {e}")
            else:
                print("ℹ️  No hay registros de tránsito")

        except Exception as e:
            print(f"❌ Error cargando tránsito: {e}")


    def cargar_compras(self, sheet_name='compras'):
        """Carga histórico de compras"""
        print(f"\n{'='*60}")
        print(f"💰 CARGANDO COMPRAS")
        print(f"{'='*60}")

        try:
            print(f"Leyendo hoja '{sheet_name}'...")
            df = pd.read_excel(self.excel_path, sheet_name=sheet_name)

            print(f"✓ {len(df)} registros encontrados")

            # Mapear columnas según el código VBA
            # Columna A: SKU, D: Fecha

            df_compras = pd.DataFrame({
                'sku': df.iloc[:, 0].astype(str).str.strip(),  # Col A
                'fecha_compra': pd.to_datetime(df.iloc[:, 3], errors='coerce'),  # Col D
            })

            # Limpiar
            df_compras = df_compras.dropna(subset=['sku', 'fecha_compra'])

            print(f"✓ {len(df_compras)} registros válidos")

            # Convertir a registros
            registros = df_compras.to_dict('records')

            # Insertar en lotes
            batch_size = 100
            total_insertados = 0

            for i in range(0, len(registros), batch_size):
                batch = registros[i:i+batch_size]

                try:
                    self.supabase.table('compras_historicas').insert(batch).execute()
                    total_insertados += len(batch)
                    print(f"  ✓ Batch {i//batch_size + 1}: {len(batch)} registros")
                except Exception as e:
                    print(f"  ⚠️  Error en batch {i//batch_size + 1}: {e}")

            print(f"\n✅ Total insertados: {total_insertados} compras")

        except Exception as e:
            print(f"❌ Error cargando compras: {e}")


    def cargar_packs(self, sheet_name='Packs'):
        """Carga definición de packs"""
        print(f"\n{'='*60}")
        print(f"📦 CARGANDO PACKS")
        print(f"{'='*60}")

        try:
            print(f"Leyendo hoja '{sheet_name}'...")
            df = pd.read_excel(self.excel_path, sheet_name=sheet_name)

            print(f"✓ {len(df)} registros encontrados")

            # Mapear columnas
            # Col A: SKU Pack, B: SKU Componente, C: Cantidad

            df_packs = pd.DataFrame({
                'sku_pack': df.iloc[:, 0].astype(str).str.strip(),
                'sku_componente': df.iloc[:, 1].astype(str).str.strip(),
                'cantidad': pd.to_numeric(df.iloc[:, 2], errors='coerce').fillna(1)
            })

            # Limpiar
            df_packs = df_packs.dropna(subset=['sku_pack', 'sku_componente'])

            print(f"✓ {len(df_packs)} relaciones pack-componente")

            # Convertir a registros
            registros = df_packs.to_dict('records')

            if registros:
                try:
                    self.supabase.table('packs').insert(registros).execute()
                    print(f"✅ {len(registros)} registros insertados")
                except Exception as e:
                    print(f"⚠️  Error: {e}")

        except Exception as e:
            print(f"❌ Error cargando packs: {e}")


    def cargar_todo(self):
        """Carga todas las hojas del Excel"""
        print(f"\n{'='*80}")
        print(f"🚀 INICIANDO CARGA COMPLETA DE DATOS")
        print(f"{'='*80}")
        print(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        inicio = datetime.now()

        # Cargar todas las hojas
        self.cargar_ventas()
        self.cargar_stock()
        self.cargar_transito_china()
        self.cargar_compras()
        self.cargar_packs()

        fin = datetime.now()
        duracion = (fin - inicio).total_seconds()

        print(f"\n{'='*80}")
        print(f"✅ CARGA COMPLETADA")
        print(f"{'='*80}")
        print(f"Duración: {duracion:.1f} segundos")


if __name__ == "__main__":
    # Path al Excel
    excel_path = Path(__file__).parent.parent / 'Gestión Full3.xlsm'

    if not excel_path.exists():
        print(f"❌ No se encontró el archivo: {excel_path}")
        print(f"   Por favor, coloca el archivo Excel en la carpeta raíz del proyecto")
        sys.exit(1)

    # Cargar datos
    cargador = CargadorDatosExcel(str(excel_path))
    cargador.cargar_todo()
