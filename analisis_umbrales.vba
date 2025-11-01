Option Explicit

' ==========================================
' ANÁLISIS DE UMBRALES ÓPTIMOS
' ==========================================
' Este script analiza las ventas para recomendar umbrales óptimos
' en lugar de los actuales: 10 unidades y 90 días

Sub AnalizarUmbralesOptimos()

    Dim wbArchivo As Workbook
    Dim wsVentas As Worksheet
    Dim wsAnalisis As Worksheet
    Dim dictVentasPorSKU As Object
    Dim dictInfo As Object

    Dim ultimaFilaVentas As Long
    Dim i As Long
    Dim empresa As String, canal As String, sku As String, mlc As String
    Dim fechaVenta As Date, unidades As Double
    Dim claveMlcSku As String

    ' Arrays para estadísticas
    Dim arrUnidades() As Double
    Dim arrDias() As Long
    Dim arrVentaDiaria() As Double
    Dim contadorSKUs As Long

    Application.ScreenUpdating = False

    Set wbArchivo = ThisWorkbook
    Set wsVentas = wbArchivo.Worksheets("ventas")

    ' Crear hoja de análisis
    On Error Resume Next
    Set wsAnalisis = wbArchivo.Worksheets("Análisis Umbrales")
    If Not wsAnalisis Is Nothing Then
        Application.DisplayAlerts = False
        wsAnalisis.Delete
        Application.DisplayAlerts = True
    End If
    On Error GoTo 0

    Set wsAnalisis = wbArchivo.Worksheets.Add(After:=wbArchivo.Worksheets(wbArchivo.Worksheets.Count))
    wsAnalisis.Name = "Análisis Umbrales"

    ' ==========================================
    ' 1. CARGAR VENTAS POR MLC+SKU
    ' ==========================================
    Set dictVentasPorSKU = CreateObject("Scripting.Dictionary")

    ultimaFilaVentas = wsVentas.Cells(wsVentas.Rows.Count, 1).End(xlUp).Row

    For i = 2 To ultimaFilaVentas
        empresa = Trim(CStr(wsVentas.Cells(i, 1).Value))
        canal = Trim(CStr(wsVentas.Cells(i, 2).Value))

        If UCase(empresa) = "TLT" And UCase(canal) = "MELI" Then
            mlc = Trim(CStr(wsVentas.Cells(i, 21).Value))
            sku = Trim(CStr(wsVentas.Cells(i, 20).Value))

            ' Quitar prefijo "MLC"
            If Left(UCase(mlc), 3) = "MLC" Then
                mlc = Mid(mlc, 4)
            End If

            On Error Resume Next
            fechaVenta = CDate(wsVentas.Cells(i, 6).Value)
            unidades = CDbl(wsVentas.Cells(i, 11).Value)
            If Err.Number <> 0 Then
                fechaVenta = Date
                unidades = 0
                Err.Clear
            End If
            On Error GoTo 0

            If mlc <> "" And sku <> "" And unidades > 0 Then
                claveMlcSku = mlc & "|" & sku

                If Not dictVentasPorSKU.Exists(claveMlcSku) Then
                    Set dictInfo = CreateObject("Scripting.Dictionary")
                    dictInfo("totalUnidades") = 0
                    dictInfo("primeraFecha") = fechaVenta
                    dictInfo("ultimaFecha") = fechaVenta
                    Set dictVentasPorSKU(claveMlcSku) = dictInfo
                Else
                    Set dictInfo = dictVentasPorSKU(claveMlcSku)
                    If fechaVenta < dictInfo("primeraFecha") Then
                        dictInfo("primeraFecha") = fechaVenta
                    End If
                    If fechaVenta > dictInfo("ultimaFecha") Then
                        dictInfo("ultimaFecha") = fechaVenta
                    End If
                End If

                dictInfo("totalUnidades") = dictInfo("totalUnidades") + unidades
            End If
        End If
    Next i

    ' ==========================================
    ' 2. CALCULAR ESTADÍSTICAS
    ' ==========================================
    contadorSKUs = dictVentasPorSKU.Count

    If contadorSKUs = 0 Then
        MsgBox "No se encontraron ventas para analizar", vbExclamation
        GoTo Salir
    End If

    ReDim arrUnidades(1 To contadorSKUs)
    ReDim arrDias(1 To contadorSKUs)
    ReDim arrVentaDiaria(1 To contadorSKUs)

    Dim idx As Long
    idx = 0

    Dim clave As Variant
    Dim totalUnidades As Double
    Dim diasHistorial As Long
    Dim ventaDiaria As Double

    For Each clave In dictVentasPorSKU.Keys
        Set dictInfo = dictVentasPorSKU(clave)

        totalUnidades = dictInfo("totalUnidades")
        diasHistorial = dictInfo("ultimaFecha") - dictInfo("primeraFecha")
        If diasHistorial <= 0 Then diasHistorial = 1

        ventaDiaria = totalUnidades / diasHistorial

        idx = idx + 1
        arrUnidades(idx) = totalUnidades
        arrDias(idx) = diasHistorial
        arrVentaDiaria(idx) = ventaDiaria
    Next clave

    ' ==========================================
    ' 3. CALCULAR PERCENTILES Y ESTADÍSTICAS
    ' ==========================================

    ' Ordenar arrays
    Call OrdenarArray(arrUnidades)
    Call OrdenarArrayLong(arrDias)
    Call OrdenarArray(arrVentaDiaria)

    ' Calcular estadísticas
    Dim p10_unidades As Double, p25_unidades As Double, p50_unidades As Double
    Dim p75_unidades As Double, p90_unidades As Double

    Dim p10_dias As Long, p25_dias As Long, p50_dias As Long
    Dim p75_dias As Long, p90_dias As Long

    p10_unidades = CalcularPercentil(arrUnidades, 10)
    p25_unidades = CalcularPercentil(arrUnidades, 25)
    p50_unidades = CalcularPercentil(arrUnidades, 50)
    p75_unidades = CalcularPercentil(arrUnidades, 75)
    p90_unidades = CalcularPercentil(arrUnidades, 90)

    p10_dias = CalcularPercentilLong(arrDias, 10)
    p25_dias = CalcularPercentilLong(arrDias, 25)
    p50_dias = CalcularPercentilLong(arrDias, 50)
    p75_dias = CalcularPercentilLong(arrDias, 75)
    p90_dias = CalcularPercentilLong(arrDias, 90)

    Dim promedio_unidades As Double, promedio_dias As Double
    promedio_unidades = PromedioArray(arrUnidades)
    promedio_dias = PromedioArrayLong(arrDias)

    ' ==========================================
    ' 4. ANALIZAR DISTRIBUCIÓN ACTUAL
    ' ==========================================
    Dim contMenosde10 As Long, contMenosde90dias As Long
    Dim contAmbos As Long

    contMenosde10 = 0
    contMenosde90dias = 0
    contAmbos = 0

    For i = 1 To contadorSKUs
        If arrUnidades(i) < 10 Then contMenosde10 = contMenosde10 + 1
        If arrDias(i) < 90 Then contMenosde90dias = contMenosde90dias + 1
        If arrUnidades(i) < 10 And arrDias(i) < 90 Then contAmbos = contAmbos + 1
    Next i

    Dim pctMenosde10 As Double, pctMenosde90dias As Double, pctAmbos As Double
    pctMenosde10 = (contMenosde10 / contadorSKUs) * 100
    pctMenosde90dias = (contMenosde90dias / contadorSKUs) * 100
    pctAmbos = (contAmbos / contadorSKUs) * 100

    ' ==========================================
    ' 5. ESCRIBIR RESULTADOS
    ' ==========================================
    With wsAnalisis
        .Range("A1").Value = "ANÁLISIS DE UMBRALES ÓPTIMOS"
        .Range("A1").Font.Size = 14
        .Range("A1").Font.Bold = True

        .Range("A3").Value = "Total SKUs analizados:"
        .Range("B3").Value = contadorSKUs
        .Range("B3").Font.Bold = True

        ' ESTADÍSTICAS DE UNIDADES
        .Range("A5").Value = "DISTRIBUCIÓN DE UNIDADES VENDIDAS"
        .Range("A5").Font.Bold = True
        .Range("A5").Interior.Color = RGB(68, 114, 196)
        .Range("A5").Font.Color = RGB(255, 255, 255)

        .Range("A6").Value = "Promedio"
        .Range("B6").Value = Round(promedio_unidades, 2)

        .Range("A7").Value = "Percentil 10%"
        .Range("B7").Value = Round(p10_unidades, 2)

        .Range("A8").Value = "Percentil 25% (Q1)"
        .Range("B8").Value = Round(p25_unidades, 2)

        .Range("A9").Value = "Mediana (50%)"
        .Range("B9").Value = Round(p50_unidades, 2)

        .Range("A10").Value = "Percentil 75% (Q3)"
        .Range("B10").Value = Round(p75_unidades, 2)

        .Range("A11").Value = "Percentil 90%"
        .Range("B11").Value = Round(p90_unidades, 2)

        ' ESTADÍSTICAS DE DÍAS
        .Range("A13").Value = "DISTRIBUCIÓN DE DÍAS DE HISTORIAL"
        .Range("A13").Font.Bold = True
        .Range("A13").Interior.Color = RGB(68, 114, 196)
        .Range("A13").Font.Color = RGB(255, 255, 255)

        .Range("A14").Value = "Promedio"
        .Range("B14").Value = Round(promedio_dias, 0)

        .Range("A15").Value = "Percentil 10%"
        .Range("B15").Value = p10_dias

        .Range("A16").Value = "Percentil 25% (Q1)"
        .Range("B16").Value = p25_dias

        .Range("A17").Value = "Mediana (50%)"
        .Range("B17").Value = p50_dias

        .Range("A18").Value = "Percentil 75% (Q3)"
        .Range("B18").Value = p75_dias

        .Range("A19").Value = "Percentil 90%"
        .Range("B19").Value = p90_dias

        ' ANÁLISIS ACTUAL
        .Range("A21").Value = "IMPACTO DE UMBRALES ACTUALES (10 unidades, 90 días)"
        .Range("A21").Font.Bold = True
        .Range("A21").Interior.Color = RGB(255, 192, 0)

        .Range("A22").Value = "SKUs con <10 unidades:"
        .Range("B22").Value = contMenosde10
        .Range("C22").Value = Round(pctMenosde10, 1) & "%"

        .Range("A23").Value = "SKUs con <90 días:"
        .Range("B23").Value = contMenosde90dias
        .Range("C23").Value = Round(pctMenosde90dias, 1) & "%"

        .Range("A24").Value = "SKUs con AMBAS condiciones:"
        .Range("B24").Value = contAmbos
        .Range("C24").Value = Round(pctAmbos, 1) & "%"
        .Range("C24").Font.Bold = True
        .Range("C24").Interior.Color = RGB(255, 255, 0)

        ' RECOMENDACIONES
        .Range("A26").Value = "RECOMENDACIONES DE NUEVOS UMBRALES"
        .Range("A26").Font.Bold = True
        .Range("A26").Interior.Color = RGB(146, 208, 80)
        .Range("A26").Font.Color = RGB(255, 255, 255)

        ' Umbral de unidades: Percentil 25 (captura 75% de los datos)
        Dim umbralUnidadesRecomendado As Long
        umbralUnidadesRecomendado = Application.WorksheetFunction.Max(5, Round(p25_unidades, 0))

        .Range("A27").Value = "Umbral de unidades recomendado:"
        .Range("B27").Value = umbralUnidadesRecomendado
        .Range("C27").Value = "(Percentil 25)"

        ' Umbral de días: Percentil 25-50
        Dim umbralDiasRecomendado As Long
        umbralDiasRecomendado = Application.WorksheetFunction.Max(30, p25_dias)

        .Range("A28").Value = "Umbral de días recomendado:"
        .Range("B28").Value = umbralDiasRecomendado
        .Range("C28").Value = "(Percentil 25-50)"

        ' Cálculo de impacto con nuevos umbrales
        Dim contNuevos As Long
        contNuevos = 0
        For i = 1 To contadorSKUs
            If arrUnidades(i) < umbralUnidadesRecomendado And arrDias(i) < umbralDiasRecomendado Then
                contNuevos = contNuevos + 1
            End If
        Next i

        Dim pctNuevos As Double
        pctNuevos = (contNuevos / contadorSKUs) * 100

        .Range("A29").Value = "SKUs afectados con nuevos umbrales:"
        .Range("B29").Value = contNuevos
        .Range("C29").Value = Round(pctNuevos, 1) & "%"

        .Range("A31").Value = "INTERPRETACIÓN"
        .Range("A31").Font.Bold = True

        .Range("A32").Value = "Los umbrales actuales (10 unidades, 90 días) afectan al " & Round(pctAmbos, 1) & "% de tus productos."
        .Range("A33").Value = "Los umbrales recomendados afectarían al " & Round(pctNuevos, 1) & "% de tus productos."

        If pctNuevos < pctAmbos Then
            .Range("A34").Value = "RECOMENDACIÓN: Considera AUMENTAR los umbrales para ser más conservador."
            .Range("A34").Interior.Color = RGB(146, 208, 80)
        ElseIf pctNuevos > pctAmbos Then
            .Range("A34").Value = "RECOMENDACIÓN: Los nuevos umbrales son más restrictivos."
            .Range("A34").Interior.Color = RGB(255, 192, 0)
        Else
            .Range("A34").Value = "Los umbrales actuales están bien calibrados."
            .Range("A34").Interior.Color = RGB(146, 208, 80)
        End If

        .Columns("A:C").AutoFit
    End With

    MsgBox "Análisis completado. Revisa la hoja 'Análisis Umbrales'", vbInformation

Salir:
    Application.ScreenUpdating = True

End Sub

' ==========================================
' FUNCIONES AUXILIARES
' ==========================================

Function CalcularPercentil(arr() As Double, percentil As Long) As Double
    Dim n As Long
    Dim posicion As Double
    Dim indice As Long

    n = UBound(arr)
    posicion = (percentil / 100) * (n - 1) + 1
    indice = Int(posicion)

    If indice >= n Then
        CalcularPercentil = arr(n)
    Else
        CalcularPercentil = arr(indice) + (arr(indice + 1) - arr(indice)) * (posicion - indice)
    End If
End Function

Function CalcularPercentilLong(arr() As Long, percentil As Long) As Long
    Dim n As Long
    Dim posicion As Double
    Dim indice As Long

    n = UBound(arr)
    posicion = (percentil / 100) * (n - 1) + 1
    indice = Int(posicion)

    If indice >= n Then
        CalcularPercentilLong = arr(n)
    Else
        CalcularPercentilLong = arr(indice)
    End If
End Function

Function PromedioArray(arr() As Double) As Double
    Dim suma As Double
    Dim i As Long

    suma = 0
    For i = 1 To UBound(arr)
        suma = suma + arr(i)
    Next i

    PromedioArray = suma / UBound(arr)
End Function

Function PromedioArrayLong(arr() As Long) As Double
    Dim suma As Long
    Dim i As Long

    suma = 0
    For i = 1 To UBound(arr)
        suma = suma + arr(i)
    Next i

    PromedioArrayLong = suma / UBound(arr)
End Function

Sub OrdenarArray(arr() As Double)
    Dim i As Long, j As Long
    Dim temp As Double

    For i = LBound(arr) To UBound(arr) - 1
        For j = i + 1 To UBound(arr)
            If arr(i) > arr(j) Then
                temp = arr(i)
                arr(i) = arr(j)
                arr(j) = temp
            End If
        Next j
    Next i
End Sub

Sub OrdenarArrayLong(arr() As Long)
    Dim i As Long, j As Long
    Dim temp As Long

    For i = LBound(arr) To UBound(arr) - 1
        For j = i + 1 To UBound(arr)
            If arr(i) > arr(j) Then
                temp = arr(i)
                arr(i) = arr(j)
                arr(j) = temp
            End If
        Next j
    Next i
End Sub
