"""
Algoritmo de Predicción de Venta Diaria y Reposición China-Chile
Sistema escalable para SaaS

Optimizado para precisión máxima:
- Venta diaria con 4 decimales de precisión
- Cálculos internos en float sin redondeo
- Redondeo hacia arriba (ceil) en sugerencias para evitar pérdida de ventas
- Validación de casos extremos
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import math


@dataclass
class VentaRecord:
    """Registro de venta individual"""
    sku: str
    fecha: datetime
    unidades: float
    precio: float


@dataclass
class StockRecord:
    """Registro de stock por SKU"""
    sku: str
    stock_total_chile: float
    descripcion: str


@dataclass
class TransitoRecord:
    """Registro de tránsito desde China"""
    sku: str
    unidades: float


@dataclass
class CompraRecord:
    """Registro de última compra"""
    sku: str
    fecha_compra: datetime


@dataclass
class PackComponent:
    """Componente de un pack"""
    sku_componente: str
    cantidad: float


@dataclass
class SugerenciaReposicion:
    """
    Resultado de la sugerencia de reposición

    Nota: Los valores se almacenan sin redondear para precisión.
    El redondeo se aplica solo al momento de presentar/almacenar.
    """
    sku: str
    descripcion: str
    venta_diaria: float  # Precisión: 4 decimales
    stock_optimo: float  # Sin redondear internamente
    stock_total_chile: float
    transito_china: float
    dias_stock_chile: float  # Precisión: 1 decimal
    sugerencia_reposicion: float  # Sin redondear internamente
    precio_unitario: float
    valor_total_sugerencia: float
    fecha_inicio: datetime
    fecha_fin: datetime
    unidades_periodo: float
    observaciones: str


class AlgoritmoPrediccionReposicion:
    """
    Algoritmo de predicción de venta diaria y sugerencias de reposición
    desde China hacia Chile.
    """

    def __init__(
        self,
        dias_stock_deseado: int = 90,
        dias_transito: int = 120,
        umbral_dias_compra_reciente: int = 30,
        umbral_unidades_bajas: float = 10,
        dias_referencia_ajuste: int = 90
    ):
        """
        Inicializa el algoritmo con parámetros configurables.

        Args:
            dias_stock_deseado: Días de stock óptimo en Chile (default: 90)
            dias_transito: Días de tránsito desde China (default: 120)
            umbral_dias_compra_reciente: Días para considerar compra como reciente (default: 30)
            umbral_unidades_bajas: Umbral de unidades para aplicar factor de ajuste (default: 10)
            dias_referencia_ajuste: Días de referencia para calcular factor de ajuste (default: 90)
        """
        self.dias_stock_deseado = dias_stock_deseado
        self.dias_transito = dias_transito
        self.umbral_dias_compra_reciente = umbral_dias_compra_reciente
        self.umbral_unidades_bajas = umbral_unidades_bajas
        self.dias_referencia_ajuste = dias_referencia_ajuste


    def descomponer_ventas_packs(
        self,
        ventas: List[VentaRecord],
        packs: Dict[str, List[PackComponent]]
    ) -> List[VentaRecord]:
        """
        Descompone las ventas de packs en sus componentes individuales.

        Args:
            ventas: Lista de registros de venta
            packs: Diccionario {sku_pack: [componentes]}

        Returns:
            Lista de ventas con packs descompuestos en componentes
        """
        ventas_descompuestas = []

        for venta in ventas:
            if venta.sku in packs:
                # Es un pack, descomponer
                for componente in packs[venta.sku]:
                    venta_componente = VentaRecord(
                        sku=componente.sku_componente,
                        fecha=venta.fecha,
                        unidades=venta.unidades * componente.cantidad,
                        precio=venta.precio  # Mantener precio del pack para referencia
                    )
                    ventas_descompuestas.append(venta_componente)
            else:
                # No es pack, agregar directamente
                ventas_descompuestas.append(venta)

        return ventas_descompuestas


    def calcular_periodo_analisis(
        self,
        fecha_min_ventas: datetime,
        fecha_max_ventas: datetime,
        stock_total_chile: float,
        fecha_ultima_compra: Optional[datetime],
        fecha_hoy: datetime
    ) -> Tuple[datetime, datetime]:
        """
        Calcula el periodo de análisis (fecha inicio y fin) según la lógica de negocio.

        Lógica:
        - Si hay última compra hace >30 días: fecha_inicio = última_compra - 30 días
        - Si hay última compra reciente (<30 días): fecha_inicio = primera venta
        - Si no hay última compra: fecha_inicio = primera venta
        - Si stock = 0: fecha_fin = última venta
        - Si stock > 0: fecha_fin = hoy

        Args:
            fecha_min_ventas: Primera fecha de venta registrada
            fecha_max_ventas: Última fecha de venta registrada
            stock_total_chile: Stock total disponible en Chile
            fecha_ultima_compra: Fecha de la última compra (opcional)
            fecha_hoy: Fecha actual

        Returns:
            Tupla (fecha_inicio, fecha_fin)
        """
        # Calcular fecha inicio
        if fecha_ultima_compra:
            dias_desde_compra = (fecha_hoy - fecha_ultima_compra).days

            if dias_desde_compra > self.umbral_dias_compra_reciente:
                # Compra antigua: ajustar fecha inicio
                fecha_inicio_analisis = fecha_ultima_compra - timedelta(days=30)

                # Buscar primera venta después de fecha_inicio_analisis
                # (esto se simplifica aquí, asumir fecha_min_ventas)
                fecha_inicio = max(fecha_min_ventas, fecha_inicio_analisis)
            else:
                # Compra reciente
                fecha_inicio = fecha_min_ventas
        else:
            # No hay compra registrada
            fecha_inicio = fecha_min_ventas

        # Calcular fecha fin
        if stock_total_chile == 0:
            # Sin stock: fecha fin = última venta
            fecha_fin = fecha_max_ventas
        else:
            # Con stock: fecha fin = hoy
            fecha_fin = fecha_hoy

        return fecha_inicio, fecha_fin


    def calcular_venta_diaria(
        self,
        ventas_sku: List[VentaRecord],
        fecha_inicio: datetime,
        fecha_fin: datetime
    ) -> Tuple[float, float, float]:
        """
        Calcula la venta diaria promedio para un SKU.

        Args:
            ventas_sku: Lista de ventas del SKU
            fecha_inicio: Fecha inicio del periodo
            fecha_fin: Fecha fin del periodo

        Returns:
            Tupla (venta_diaria, total_unidades, dias_periodo)
        """
        # Filtrar ventas dentro del periodo
        ventas_periodo = [
            v for v in ventas_sku
            if fecha_inicio <= v.fecha <= fecha_fin
        ]

        # Calcular total de unidades
        total_unidades = sum(v.unidades for v in ventas_periodo)

        # Calcular días del periodo
        dias_periodo = (fecha_fin - fecha_inicio).days
        if dias_periodo <= 0:
            dias_periodo = 1

        # Venta diaria = total unidades / días periodo
        venta_diaria = total_unidades / dias_periodo

        return venta_diaria, total_unidades, dias_periodo


    def validar_venta_diaria_minima(
        self,
        venta_diaria: float,
        total_unidades: float,
        dias_periodo: int
    ) -> Tuple[float, str]:
        """
        Valida y ajusta la venta diaria para casos extremos.

        Casos especiales:
        - Si venta_diaria < 0.0001 (menos de 1 unidad cada 10,000 días): considerar como sin movimiento
        - Si total_unidades = 0: venta_diaria = 0
        - Si días_periodo muy corto: agregar advertencia

        Args:
            venta_diaria: Venta diaria calculada
            total_unidades: Total de unidades vendidas
            dias_periodo: Días del periodo

        Returns:
            Tupla (venta_diaria_validada, advertencia)
        """
        advertencia = ""

        # Caso 1: Sin ventas
        if total_unidades == 0:
            return 0.0, "Sin ventas en el periodo"

        # Caso 2: Venta extremadamente baja (menos de 1 unidad cada 10,000 días)
        if venta_diaria < 0.0001:
            advertencia = f"Venta muy baja: {total_unidades} unidades en {dias_periodo} días"

        # Caso 3: Periodo muy corto (menos de 30 días)
        if dias_periodo < 30:
            advertencia = f"Periodo corto ({dias_periodo} días) - predicción menos confiable"

        # Caso 4: Venta muy alta en poco tiempo (puede ser anomalía)
        if dias_periodo < 30 and venta_diaria > 10:
            advertencia = f"Venta alta ({venta_diaria:.2f}/día) en periodo corto - verificar"

        return venta_diaria, advertencia


    def calcular_sugerencia_reposicion(
        self,
        venta_diaria: float,
        stock_total_chile: float,
        transito_china: float,
        total_unidades: float,
        dias_periodo: int
    ) -> Tuple[float, float, str]:
        """
        Calcula la sugerencia de reposición según la lógica de negocio.

        Lógica:
        1. Calcular stock óptimo = venta_diaria * dias_stock_deseado
        2. Calcular días de stock actual = stock_total_chile / venta_diaria
        3. Si días_stock > dias_transito:
           - sugerencia = stock_optimo - (dias_restantes * venta_diaria)
        4. Si días_stock <= dias_transito:
           - sugerencia = stock_optimo
        5. Restar tránsito china de la sugerencia
        6. Si unidades_periodo < umbral: aplicar factor de ajuste

        Args:
            venta_diaria: Venta diaria promedio
            stock_total_chile: Stock disponible en Chile
            transito_china: Unidades en tránsito desde China
            total_unidades: Total de unidades vendidas en el periodo
            dias_periodo: Días del periodo analizado

        Returns:
            Tupla (sugerencia_reposicion, dias_stock_chile, observaciones)
        """
        observaciones = []

        # Calcular stock óptimo
        stock_optimo = venta_diaria * self.dias_stock_deseado

        # Calcular días de stock actual
        if venta_diaria > 0:
            dias_stock_chile = stock_total_chile / venta_diaria
        else:
            dias_stock_chile = 999999

        # Calcular sugerencia base
        if dias_stock_chile > self.dias_transito:
            # Stock supera días de tránsito
            dias_restantes = dias_stock_chile - self.dias_transito
            sugerencia = stock_optimo - (dias_restantes * venta_diaria)

            if sugerencia < 0:
                sugerencia = 0

            observaciones.append(
                f"Stock supera {self.dias_transito} días. Días restantes: {round(dias_restantes, 0)}"
            )
        else:
            # Stock no supera días de tránsito
            sugerencia = stock_optimo
            observaciones.append(
                f"Stock por debajo de {self.dias_transito} días de tránsito"
            )

        # Restar tránsito china
        if transito_china > 0:
            sugerencia -= transito_china
            if sugerencia < 0:
                sugerencia = 0
            observaciones.append(f"Tránsito: {round(transito_china, 0)}")

        # Factor de ajuste si hay pocas unidades vendidas
        if total_unidades < self.umbral_unidades_bajas and dias_periodo > 0:
            factor_ajuste = dias_periodo / self.dias_referencia_ajuste
            sugerencia *= factor_ajuste
            observaciones.append(
                f"Factor ajuste ({round(factor_ajuste, 2)}) por pocas unidades"
            )

        return sugerencia, dias_stock_chile, " | ".join(observaciones)


    def calcular_sugerencias_por_sku(
        self,
        ventas: List[VentaRecord],
        stock: List[StockRecord],
        transito: List[TransitoRecord],
        compras: List[CompraRecord],
        packs: Dict[str, List[PackComponent]] = None,
        skus_desconsiderar: List[str] = None,
        fecha_hoy: datetime = None
    ) -> List[SugerenciaReposicion]:
        """
        Calcula sugerencias de reposición para todos los SKUs.

        Args:
            ventas: Lista de registros de venta
            stock: Lista de registros de stock
            transito: Lista de registros de tránsito
            compras: Lista de registros de compras
            packs: Diccionario de packs y sus componentes (opcional)
            skus_desconsiderar: Lista de SKUs a excluir (opcional)
            fecha_hoy: Fecha actual (opcional, default: hoy)

        Returns:
            Lista de sugerencias de reposición ordenadas por valor total
        """
        if fecha_hoy is None:
            fecha_hoy = datetime.now()

        if packs is None:
            packs = {}

        if skus_desconsiderar is None:
            skus_desconsiderar = []

        # Descomponer ventas de packs
        ventas_procesadas = self.descomponer_ventas_packs(ventas, packs)

        # Agrupar datos por SKU
        ventas_por_sku = {}
        for venta in ventas_procesadas:
            if venta.sku not in ventas_por_sku:
                ventas_por_sku[venta.sku] = []
            ventas_por_sku[venta.sku].append(venta)

        stock_por_sku = {s.sku: s for s in stock}
        transito_por_sku = {}
        for t in transito:
            if t.sku not in transito_por_sku:
                transito_por_sku[t.sku] = 0
            transito_por_sku[t.sku] += t.unidades

        compras_por_sku = {}
        for c in compras:
            if c.sku not in compras_por_sku:
                compras_por_sku[c.sku] = c.fecha_compra
            else:
                # Mantener la fecha más reciente
                if c.fecha_compra > compras_por_sku[c.sku]:
                    compras_por_sku[c.sku] = c.fecha_compra

        # Calcular sugerencias
        sugerencias = []

        for sku, ventas_sku in ventas_por_sku.items():
            # Saltar si está en la lista de desconsiderar
            if sku in skus_desconsiderar:
                continue

            # Obtener datos del SKU
            stock_record = stock_por_sku.get(sku)
            if not stock_record:
                continue

            stock_total_chile = stock_record.stock_total_chile
            descripcion = stock_record.descripcion

            transito_china = transito_por_sku.get(sku, 0)
            fecha_ultima_compra = compras_por_sku.get(sku)

            # Calcular fechas del periodo de ventas
            fechas_ventas = [v.fecha for v in ventas_sku]
            fecha_min_ventas = min(fechas_ventas)
            fecha_max_ventas = max(fechas_ventas)

            # Calcular periodo de análisis
            fecha_inicio, fecha_fin = self.calcular_periodo_analisis(
                fecha_min_ventas,
                fecha_max_ventas,
                stock_total_chile,
                fecha_ultima_compra,
                fecha_hoy
            )

            # Validar fechas
            if fecha_inicio >= fecha_fin:
                continue

            # Calcular venta diaria
            venta_diaria, total_unidades, dias_periodo = self.calcular_venta_diaria(
                ventas_sku,
                fecha_inicio,
                fecha_fin
            )

            # Validar venta diaria y obtener advertencias
            venta_diaria, advertencia_venta = self.validar_venta_diaria_minima(
                venta_diaria,
                total_unidades,
                dias_periodo
            )

            # Calcular sugerencia de reposición
            sugerencia, dias_stock_chile, observaciones = self.calcular_sugerencia_reposicion(
                venta_diaria,
                stock_total_chile,
                transito_china,
                total_unidades,
                dias_periodo
            )

            # Solo incluir si hay sugerencia > 0
            if sugerencia <= 0:
                continue

            # Obtener precio (usar el último precio disponible)
            precio_unitario = 0
            for venta in reversed(ventas_sku):
                if venta.precio > 0:
                    precio_unitario = venta.precio
                    break

            # Calcular stock óptimo (mantener precisión)
            stock_optimo = venta_diaria * self.dias_stock_deseado

            # Redondeo inteligente para sugerencia de reposición:
            # - Si sugerencia > 0: usar ceil() para NO perder ventas
            # - Si sugerencia <= 0: mantener en 0
            if sugerencia > 0:
                sugerencia_redondeada = math.ceil(sugerencia)
            else:
                sugerencia_redondeada = 0

            # Agregar advertencia de validación si existe
            if advertencia_venta:
                observaciones = f"{advertencia_venta} | {observaciones}" if observaciones else advertencia_venta

            # Crear sugerencia con valores de precisión optimizada
            sugerencia_obj = SugerenciaReposicion(
                sku=sku,
                descripcion=descripcion,
                venta_diaria=round(venta_diaria, 4),  # 4 decimales para precisión
                stock_optimo=stock_optimo,  # Mantener float sin redondear
                stock_total_chile=stock_total_chile,  # Mantener float
                transito_china=transito_china,  # Mantener float
                dias_stock_chile=round(dias_stock_chile, 1),  # 1 decimal suficiente
                sugerencia_reposicion=sugerencia_redondeada,  # Redondeado hacia arriba (ceil)
                precio_unitario=precio_unitario,
                valor_total_sugerencia=sugerencia_redondeada * precio_unitario,  # Valor exacto
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                unidades_periodo=total_unidades,  # Mantener float
                observaciones=observaciones
            )

            sugerencias.append(sugerencia_obj)

        # Ordenar por valor total de sugerencia (mayor a menor)
        sugerencias.sort(key=lambda s: s.valor_total_sugerencia, reverse=True)

        return sugerencias


# Ejemplo de uso
if __name__ == "__main__":
    # Crear instancia del algoritmo
    algoritmo = AlgoritmoPrediccionReposicion(
        dias_stock_deseado=90,
        dias_transito=120
    )

    # Datos de ejemplo
    ventas = [
        VentaRecord("SKU001", datetime(2025, 1, 1), 10, 1000),
        VentaRecord("SKU001", datetime(2025, 1, 5), 15, 1000),
        VentaRecord("SKU001", datetime(2025, 1, 10), 12, 1000),
        VentaRecord("SKU002", datetime(2025, 1, 2), 5, 500),
    ]

    stock = [
        StockRecord("SKU001", 500, "Producto A"),
        StockRecord("SKU002", 100, "Producto B"),
    ]

    transito = [
        TransitoRecord("SKU001", 200),
    ]

    compras = [
        CompraRecord("SKU001", datetime(2024, 11, 1)),
    ]

    # Calcular sugerencias
    sugerencias = algoritmo.calcular_sugerencias_por_sku(
        ventas=ventas,
        stock=stock,
        transito=transito,
        compras=compras
    )

    # Mostrar resultados
    print(f"\n{'='*80}")
    print("SUGERENCIAS DE REPOSICIÓN CHINA-CHILE")
    print(f"{'='*80}\n")

    for s in sugerencias:
        print(f"SKU: {s.sku} - {s.descripcion}")
        print(f"  Venta Diaria: {s.venta_diaria}")
        print(f"  Stock Óptimo: {s.stock_optimo}")
        print(f"  Stock Chile: {s.stock_total_chile}")
        print(f"  Tránsito China: {s.transito_china}")
        print(f"  Días Stock: {s.dias_stock_chile}")
        print(f"  SUGERENCIA: {s.sugerencia_reposicion} unidades")
        print(f"  Valor Total: ${s.valor_total_sugerencia:,.0f}")
        print(f"  Periodo: {s.fecha_inicio.date()} a {s.fecha_fin.date()}")
        print(f"  Observaciones: {s.observaciones}")
        print(f"{'-'*80}\n")
