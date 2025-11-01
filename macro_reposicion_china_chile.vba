Sub GenerarSugerenciasChinaChile()

    On Error GoTo ErrorHandler

    Dim wbArchivo As Workbook
    Dim wsVentas As Worksheet, wsStock As Worksheet, wsResultado As Worksheet
    Dim wsTransitoChina As Worksheet, wsCompras As Worksheet, wsDesconsiderar As Worksheet
    Dim diasStockDeseado As Integer
    Dim diasTransito As Integer
    Dim ultimaFilaVentas As Long, ultimaFilaStock As Long
    Dim ultimaFilaTransitoChina As Long, ultimaFilaCompras As Long, ultimaFilaDesconsiderar As Long
    Dim i As Long
    Dim empresa As String, canal As String, mlc As String, sku As String
    Dim fechaVenta As Date
    Dim unidades As Double

    ' Diccionarios
    Dim dictVentaPorSKU As Object
    Dim dictStockChilePorSKU As Object
    Dim dictInfoVentaSKU As Object
    Dim dictPacks As Object
    Dim dictTransitoChina As Object
    Dim dictUltimaCompra As Object
    Dim dictDesconsiderar As Object

    Dim skuKey As Variant
    Dim ventaDiariaSKU As Double
    Dim stockTotalChile As Double
    Dim diasStockChile As Double
    Dim stockOptimo90 As Double
    Dim sugerenciaReposicion As Double
    Dim transitoChina As Double
    Dim filaResultado As Long

    MsgBox "Iniciando macro GenerarSugerenciasChinaChile...", vbInformation

    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' Solicitar parámetros
    diasStockDeseado = InputBox("Ingrese los días de stock deseados en Chile:", "Stock Óptimo China?Chile", "90")
    If diasStockDeseado <= 0 Then
        MsgBox "Debe ingresar un valor válido de días", vbExclamation
        Exit Sub
    End If

    diasTransito = 120  ' Días fijos de tránsito desde China

    ' Asignar hojas
    Set wbArchivo = ThisWorkbook
    On Error Resume Next
    Set wsVentas = wbArchivo.Worksheets("ventas")
    Set wsStock = wbArchivo.Worksheets("Stock")
    Set wsTransitoChina = wbArchivo.Worksheets("transito china")
    Set wsCompras = wbArchivo.Worksheets("compras")
    Set wsDesconsiderar = wbArchivo.Worksheets("desconsiderar")
    On Error GoTo 0

    If wsVentas Is Nothing Or wsStock Is Nothing Then
        MsgBox "No se encontraron las hojas necesarias (ventas, Stock)", vbCritical
        GoTo Salir
    End If

    If wsTransitoChina Is Nothing Then
        MsgBox "Advertencia: No se encontró la hoja 'transito china'. Se continuará sin considerar tránsito.", vbExclamation
    End If

    If wsCompras Is Nothing Then
        MsgBox "Advertencia: No se encontró la hoja 'compras'. Se usará todo el periodo de ventas.", vbExclamation
    End If

    If wsDesconsiderar Is Nothing Then
        MsgBox "Advertencia: No se encontró la hoja 'desconsiderar'. Se incluirán todos los SKUs.", vbExclamation
    End If

    ' Crear/limpiar hoja de resultados
    On Error Resume Next
    Set wsResultado = wbArchivo.Worksheets("Sugerencias China-Chile")
    If Not wsResultado Is Nothing Then
        Application.DisplayAlerts = False
        wsResultado.Delete
        Application.DisplayAlerts = True
    End If
    On Error GoTo 0

    Set wsResultado = wbArchivo.Worksheets.Add
    wsResultado.Name = "Sugerencias China-Chile"

    ' Encabezados (mismo formato que Sugerencias Reposición Full)
    With wsResultado
        .Cells(1, 1).Value = "SKU"
        .Cells(1, 2).Value = "Descripción"
        .Cells(1, 3).Value = "Venta Diaria"
        .Cells(1, 4).Value = "Stock Óptimo (" & diasStockDeseado & " días)"
        .Cells(1, 5).Value = "Stock Total Chile"
        .Cells(1, 6).Value = "Tránsito China"
        .Cells(1, 7).Value = "Días de Stock Chile"
        .Cells(1, 8).Value = "Sugerencia Reposición"
        .Cells(1, 9).Value = "Precio Unitario"
        .Cells(1, 10).Value = "Valor Total Sugerencia"
        .Cells(1, 11).Value = "Fecha Inicio"
        .Cells(1, 12).Value = "Fecha Fin"
        .Cells(1, 13).Value = "Unidades Periodo"
        .Cells(1, 14).Value = "Observaciones"

        .Range("A1:N1").Font.Bold = True
        .Range("A1:N1").Interior.Color = RGB(68, 114, 196)
        .Range("A1:N1").Font.Color = RGB(255, 255, 255)
    End With

    ' Inicializar diccionarios
    Set dictVentaPorSKU = CreateObject("Scripting.Dictionary")
    Set dictStockChilePorSKU = CreateObject("Scripting.Dictionary")
    Set dictPacks = CreateObject("Scripting.Dictionary")
    Set dictTransitoChina = CreateObject("Scripting.Dictionary")
    Set dictUltimaCompra = CreateObject("Scripting.Dictionary")
    Set dictDesconsiderar = CreateObject("Scripting.Dictionary")

    ' ==========================================
    ' 0. CARGAR SKUs A DESCONSIDERAR
    ' ==========================================
    If Not wsDesconsiderar Is Nothing Then
        ultimaFilaDesconsiderar = wsDesconsiderar.Cells(wsDesconsiderar.Rows.Count, 1).End(xlUp).Row

        For i = 2 To ultimaFilaDesconsiderar
            sku = Trim(CStr(wsDesconsiderar.Cells(i, 1).Value))  ' Columna A: SKU

            If sku <> "" Then
                dictDesconsiderar(sku) = True
            End If
        Next i

        MsgBox "SKUs a desconsiderar: " & dictDesconsiderar.Count, vbInformation
    End If

    ' ==========================================
    ' 1. CARGAR PACKS (para descomponer en componentes)
    ' ==========================================
    Dim wsPacks As Worksheet
    Set wsPacks = wbArchivo.Worksheets("Packs")
    Dim ultimaFilaPacks As Long
    ultimaFilaPacks = wsPacks.Cells(wsPacks.Rows.Count, 1).End(xlUp).Row

    Dim idPack As String, skuComponente As String, cantidadComponente As Double
    Dim dictComp As Object

    For i = 2 To ultimaFilaPacks
        idPack = Trim(CStr(wsPacks.Cells(i, 1).Value))
        skuComponente = Trim(CStr(wsPacks.Cells(i, 2).Value))

        On Error Resume Next
        cantidadComponente = CDbl(wsPacks.Cells(i, 3).Value)
        If Err.Number <> 0 Then
            cantidadComponente = 1
            Err.Clear
        End If
        On Error GoTo 0

        If idPack <> "" And skuComponente <> "" Then
            If Not dictPacks.Exists(idPack) Then
                Set dictPacks(idPack) = CreateObject("Scripting.Dictionary")
            End If

            Set dictComp = dictPacks(idPack)
            dictComp(skuComponente) = cantidadComponente
        End If
    Next i

    MsgBox "Packs cargados: " & dictPacks.Count, vbInformation

    ' ==========================================
    ' 1B. CARGAR TRÁNSITO CHINA
    ' ==========================================
    If Not wsTransitoChina Is Nothing Then
        ultimaFilaTransitoChina = wsTransitoChina.Cells(wsTransitoChina.Rows.Count, 1).End(xlUp).Row

        For i = 2 To ultimaFilaTransitoChina
            sku = Trim(CStr(wsTransitoChina.Cells(i, 4).Value))  ' Columna D: SKU

            Dim cantTransito As Double
            On Error Resume Next
            cantTransito = CDbl(wsTransitoChina.Cells(i, 8).Value)  ' Columna H: Total Units
            If Err.Number <> 0 Then
                cantTransito = 0
                Err.Clear
            End If
            On Error GoTo 0

            If sku <> "" And cantTransito > 0 Then
                If Not dictTransitoChina.Exists(sku) Then
                    dictTransitoChina(sku) = 0
                End If
                dictTransitoChina(sku) = dictTransitoChina(sku) + cantTransito
            End If
        Next i

        MsgBox "Tránsito China cargado: " & dictTransitoChina.Count & " SKUs", vbInformation
    End If

    ' ==========================================
    ' 1C. CARGAR ÚLTIMA COMPRA POR SKU
    ' ==========================================
    If Not wsCompras Is Nothing Then
        ultimaFilaCompras = wsCompras.Cells(wsCompras.Rows.Count, 1).End(xlUp).Row

        Dim fechaCompra As Date
        Dim fechaHoy As Date
        fechaHoy = Date

        For i = 2 To ultimaFilaCompras
            sku = Trim(CStr(wsCompras.Cells(i, 1).Value))  ' Columna A: ITEM NO.

            On Error Resume Next
            fechaCompra = CDate(wsCompras.Cells(i, 4).Value)  ' Columna D: Fecha
            If Err.Number <> 0 Then
                fechaCompra = DateSerial(1900, 1, 1)
                Err.Clear
            End If
            On Error GoTo 0

            If sku <> "" And Year(fechaCompra) > 1900 Then
                ' Guardar la fecha MÁS RECIENTE de compra para cada SKU
                If dictUltimaCompra.Exists(sku) Then
                    If fechaCompra > dictUltimaCompra(sku) Then
                        dictUltimaCompra(sku) = fechaCompra
                    End If
                Else
                    dictUltimaCompra(sku) = fechaCompra
                End If
            End If
        Next i

        MsgBox "Compras cargadas: " & dictUltimaCompra.Count & " SKUs", vbInformation
    End If

    ' ==========================================
    ' 2. CARGAR VENTAS POR SKU
    ' ==========================================
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
                fechaVenta = DateSerial(1900, 1, 1)
                unidades = 0
                Err.Clear
            End If
            On Error GoTo 0

            If sku <> "" And unidades > 0 And Year(fechaVenta) > 1900 Then

                ' Verificar si es pack y descomponer
                Dim esPack As Boolean
                esPack = dictPacks.Exists(sku)

                If esPack Then
                    ' Descomponer pack en componentes
                    Set dictComp = dictPacks(sku)
                    Dim comp As Variant
                    For Each comp In dictComp.Keys
                        Dim skuComp As String
                        Dim cantPorPack As Double
                        skuComp = CStr(comp)
                        cantPorPack = dictComp(comp)

                        ' Agregar venta del componente
                        If Not dictVentaPorSKU.Exists(skuComp) Then
                            Set dictVentaPorSKU(skuComp) = CreateObject("Scripting.Dictionary")
                            Set dictVentaPorSKU(skuComp)("fechas") = New Collection
                            dictVentaPorSKU(skuComp)("totalUnidades") = 0
                        End If

                        Set dictInfoVentaSKU = dictVentaPorSKU(skuComp)
                        dictInfoVentaSKU("fechas").Add fechaVenta
                        dictInfoVentaSKU("totalUnidades") = dictInfoVentaSKU("totalUnidades") + (unidades * cantPorPack)
                    Next comp
                Else
                    ' SKU directo (no es pack)
                    If Not dictVentaPorSKU.Exists(sku) Then
                        Set dictVentaPorSKU(sku) = CreateObject("Scripting.Dictionary")
                        Set dictVentaPorSKU(sku)("fechas") = New Collection
                        dictVentaPorSKU(sku)("totalUnidades") = 0
                    End If

                    Set dictInfoVentaSKU = dictVentaPorSKU(sku)
                    dictInfoVentaSKU("fechas").Add fechaVenta
                    dictInfoVentaSKU("totalUnidades") = dictInfoVentaSKU("totalUnidades") + unidades
                End If
            End If
        End If
    Next i

    MsgBox "SKUs con ventas cargados: " & dictVentaPorSKU.Count, vbInformation

    ' ==========================================
    ' 3. CARGAR STOCK TOTAL CHILE POR SKU
    ' ==========================================
    ultimaFilaStock = wsStock.Cells(wsStock.Rows.Count, 1).End(xlUp).Row

    For i = 2 To ultimaFilaStock
        sku = Trim(CStr(wsStock.Cells(i, 1).Value))

        If sku <> "" Then
            Dim stockC As Double, stockD As Double, stockE As Double
            Dim stockF As Double, stockH As Double, stockJ As Double

            On Error Resume Next
            stockC = CDbl(wsStock.Cells(i, 3).Value)
            If Err.Number <> 0 Then stockC = 0: Err.Clear

            stockD = CDbl(wsStock.Cells(i, 4).Value)
            If Err.Number <> 0 Then stockD = 0: Err.Clear

            stockE = CDbl(wsStock.Cells(i, 5).Value)
            If Err.Number <> 0 Then stockE = 0: Err.Clear

            stockF = CDbl(wsStock.Cells(i, 6).Value)
            If Err.Number <> 0 Then stockF = 0: Err.Clear

            stockH = CDbl(wsStock.Cells(i, 8).Value)
            If Err.Number <> 0 Then stockH = 0: Err.Clear

            stockJ = CDbl(wsStock.Cells(i, 10).Value)
            If Err.Number <> 0 Then stockJ = 0: Err.Clear
            On Error GoTo 0

            stockTotalChile = stockC + stockD + stockE + stockF + stockH + stockJ

            If Not dictStockChilePorSKU.Exists(sku) Then
                dictStockChilePorSKU(sku) = 0
            End If
            dictStockChilePorSKU(sku) = dictStockChilePorSKU(sku) + stockTotalChile
        End If
    Next i

    MsgBox "SKUs con stock en Chile: " & dictStockChilePorSKU.Count, vbInformation

    ' ==========================================
    ' 4. CALCULAR VENTA DIARIA Y SUGERENCIAS
    ' ==========================================
    filaResultado = 2

    ' Cargar descripciones desde tabla Stock (columna B)
    Dim dictDescripciones As Object
    Set dictDescripciones = CreateObject("Scripting.Dictionary")

    For i = 2 To ultimaFilaStock
        sku = Trim(CStr(wsStock.Cells(i, 1).Value))
        Dim descripcion As String
        descripcion = Trim(CStr(wsStock.Cells(i, 2).Value))

        If sku <> "" And descripcion <> "" And Not dictDescripciones.Exists(sku) Then
            dictDescripciones(sku) = descripcion
        End If
    Next i

    MsgBox "Descripciones cargadas desde Stock: " & dictDescripciones.Count, vbInformation

    ' Cargar precios por SKU
    Dim dictPrecios As Object
    Set dictPrecios = CreateObject("Scripting.Dictionary")

    For i = 2 To ultimaFilaVentas
        empresa = Trim(CStr(wsVentas.Cells(i, 1).Value))
        canal = Trim(CStr(wsVentas.Cells(i, 2).Value))

        If UCase(empresa) = "TLT" And UCase(canal) = "MELI" Then
            sku = Trim(CStr(wsVentas.Cells(i, 20).Value))
            Dim precio As Double

            On Error Resume Next
            precio = CDbl(wsVentas.Cells(i, 24).Value)
            If Err.Number <> 0 Then
                precio = 0
                Err.Clear
            End If
            On Error GoTo 0

            If sku <> "" And precio > 0 And Not dictPrecios.Exists(sku) Then
                dictPrecios(sku) = precio
            End If
        End If
    Next i

    ' Procesar cada SKU
    For Each skuKey In dictVentaPorSKU.Keys
        sku = CStr(skuKey)
        Set dictInfoVentaSKU = dictVentaPorSKU(sku)

        ' Calcular venta diaria
        Dim fechaCol As Collection
        Set fechaCol = dictInfoVentaSKU("fechas")

        ' Buscar fechaMin y fechaMax en las ventas
        Dim fechaMin As Date, fechaMax As Date
        Dim fechaMinVentas As Date, fechaMaxVentas As Date
        fechaMinVentas = DateSerial(9999, 12, 31)
        fechaMaxVentas = DateSerial(1900, 1, 1)

        Dim f As Variant
        For Each f In fechaCol
            If f < fechaMinVentas Then fechaMinVentas = f
            If f > fechaMaxVentas Then fechaMaxVentas = f
        Next f

        ' Obtener stock total Chile (necesario para lógica de fechas)
        stockTotalChile = 0
        If dictStockChilePorSKU.Exists(sku) Then
            stockTotalChile = dictStockChilePorSKU(sku)
        End If

        ' ==========================================
        ' NUEVA LÓGICA: AJUSTAR FECHA INICIO SEGÚN ÚLTIMA COMPRA
        ' ==========================================
        Dim fechaUltimaCompra As Date
        Dim fechaInicioAnalisis As Date
        fechaHoy = Date

        If dictUltimaCompra.Exists(sku) Then
            fechaUltimaCompra = dictUltimaCompra(sku)

            ' Solo considerar compras que llegaron hace MÁS de 30 días
            Dim diasDesdeCompra As Long
            diasDesdeCompra = fechaHoy - fechaUltimaCompra

            If diasDesdeCompra > 30 Then
                ' Fecha inicio = última compra - 30 días
                fechaInicioAnalisis = fechaUltimaCompra - 30

                ' Buscar la primera venta DESPUÉS de fechaInicioAnalisis
                fechaMin = DateSerial(9999, 12, 31)
                For Each f In fechaCol
                    If f >= fechaInicioAnalisis And f < fechaMin Then
                        fechaMin = f
                    End If
                Next f

                ' Si no hay ventas después de la fecha de análisis, usar la primera venta
                If Year(fechaMin) = 9999 Then
                    fechaMin = fechaMinVentas
                End If
            Else
                ' Compra reciente (< 30 días), usar primera venta del periodo
                fechaMin = fechaMinVentas
            End If
        Else
            ' No hay compra registrada, usar primera venta
            fechaMin = fechaMinVentas
        End If

        ' ==========================================
        ' FECHA FIN: Última venta O hoy si hay stock
        ' ==========================================
        If stockTotalChile = 0 Then
            ' Sin stock: fecha fin = última venta
            fechaMax = fechaMaxVentas
        Else
            ' Con stock: fecha fin = hoy
            fechaMax = fechaHoy
        End If

        ' Calcular días del periodo
        Dim diasPeriodo As Long
        diasPeriodo = fechaMax - fechaMin
        If diasPeriodo <= 0 Then diasPeriodo = 1

        ' Calcular venta diaria (usando total de unidades / días ajustados)
        Dim totalUnidades As Double
        totalUnidades = dictInfoVentaSKU("totalUnidades")
        ventaDiariaSKU = totalUnidades / diasPeriodo

        ' Calcular días de stock en Chile
        If ventaDiariaSKU > 0 Then
            diasStockChile = stockTotalChile / ventaDiariaSKU
        Else
            diasStockChile = 999999
        End If

        ' Calcular stock óptimo
        stockOptimo90 = ventaDiariaSKU * diasStockDeseado

        ' Calcular sugerencia según lógica de 120 días de tránsito
        Dim observaciones As String
        observaciones = ""

        If diasStockChile > diasTransito Then
            ' Stock supera 120 días
            Dim diasRestantes As Double
            diasRestantes = diasStockChile - diasTransito
            sugerenciaReposicion = stockOptimo90 - (diasRestantes * ventaDiariaSKU)

            If sugerenciaReposicion < 0 Then sugerenciaReposicion = 0

            observaciones = "Stock supera " & diasTransito & " días. Días restantes: " & Round(diasRestantes, 0)
        Else
            ' Stock NO supera 120 días
            sugerenciaReposicion = stockOptimo90
            observaciones = "Stock por debajo de " & diasTransito & " días de tránsito"
        End If

        ' ==========================================
        ' RESTAR TRÁNSITO CHINA DE LA SUGERENCIA
        ' ==========================================
        transitoChina = 0
        If dictTransitoChina.Exists(sku) Then
            transitoChina = dictTransitoChina(sku)
        End If

        ' Ajustar sugerencia restando lo que viene en tránsito
        sugerenciaReposicion = sugerenciaReposicion - transitoChina
        If sugerenciaReposicion < 0 Then sugerenciaReposicion = 0

        ' Actualizar observaciones si hay tránsito
        If transitoChina > 0 Then
            observaciones = observaciones & " | Tránsito: " & Round(transitoChina, 0)
        End If

        ' ==========================================
        ' FACTOR DE AJUSTE SI UNIDADES PERIODO < 10
        ' ==========================================
        If totalUnidades < 10 Then
            Dim factorAjuste As Double
            Dim diasReales As Long
            diasReales = fechaMax - fechaMin

            If diasReales > 0 Then
                ' Factor = (diasReales / 90)
                factorAjuste = diasReales / 90

                ' Aplicar factor a la sugerencia
                sugerenciaReposicion = sugerenciaReposicion * factorAjuste

                ' Actualizar observaciones
                observaciones = observaciones & " | Factor ajuste (" & Round(factorAjuste, 2) & ") por pocas unidades"
            End If
        End If

        ' Solo escribir si hay sugerencia > 0 Y fechas diferentes Y NO está en desconsiderar
        Dim esDesconsiderar As Boolean
        esDesconsiderar = False
        If dictDesconsiderar.Exists(sku) Then
            esDesconsiderar = True
        End If

        If sugerenciaReposicion > 0 And fechaMin <> fechaMax And Not esDesconsiderar Then
            Dim descripcionMostrar As String
            descripcionMostrar = ""
            If dictDescripciones.Exists(sku) Then
                descripcionMostrar = dictDescripciones(sku)
            End If

            Dim precioMostrar As Double
            precioMostrar = 0
            If dictPrecios.Exists(sku) Then
                precioMostrar = dictPrecios(sku)
            End If

            Dim valorTotal As Double
            valorTotal = sugerenciaReposicion * precioMostrar

            With wsResultado
                .Cells(filaResultado, 1).Value = sku
                .Cells(filaResultado, 2).Value = descripcionMostrar
                .Cells(filaResultado, 3).Value = Round(ventaDiariaSKU, 2)
                .Cells(filaResultado, 4).Value = Round(stockOptimo90, 0)
                .Cells(filaResultado, 5).Value = Round(stockTotalChile, 0)
                .Cells(filaResultado, 6).Value = Round(transitoChina, 0)
                .Cells(filaResultado, 7).Value = Round(diasStockChile, 0)
                .Cells(filaResultado, 8).Value = Round(sugerenciaReposicion, 0)
                .Cells(filaResultado, 9).Value = precioMostrar
                .Cells(filaResultado, 10).Value = Round(valorTotal, 0)
                .Cells(filaResultado, 11).Value = fechaMin
                .Cells(filaResultado, 12).Value = fechaMax
                .Cells(filaResultado, 13).Value = Round(totalUnidades, 0)
                .Cells(filaResultado, 14).Value = observaciones

                .Cells(filaResultado, 3).NumberFormat = "0.00"
                .Cells(filaResultado, 4).NumberFormat = "#,##0"
                .Cells(filaResultado, 5).NumberFormat = "#,##0"
                .Cells(filaResultado, 6).NumberFormat = "#,##0"
                .Cells(filaResultado, 7).NumberFormat = "#,##0"
                .Cells(filaResultado, 8).NumberFormat = "#,##0"
                .Cells(filaResultado, 9).NumberFormat = "$#,##0"
                .Cells(filaResultado, 10).NumberFormat = "$#,##0"
                .Cells(filaResultado, 11).NumberFormat = "dd/mm/yyyy"
                .Cells(filaResultado, 12).NumberFormat = "dd/mm/yyyy"
                .Cells(filaResultado, 13).NumberFormat = "#,##0"
            End With

            filaResultado = filaResultado + 1
        End If
    Next skuKey

    ' ==========================================
    ' ORDENAR POR VALOR TOTAL SUGERENCIA (MAYOR A MENOR)
    ' ==========================================
    If filaResultado > 2 Then
        With wsResultado
            .Range("A1:N" & (filaResultado - 1)).Sort _
                Key1:=.Range("J2"), Order1:=xlDescending, _
                Header:=xlYes, _
                OrderCustom:=1, _
                MatchCase:=False, _
                Orientation:=xlTopToBottom
        End With
    End If

    ' Autoajustar columnas
    wsResultado.Columns("A:N").AutoFit

    MsgBox "Proceso completado. Se generaron " & (filaResultado - 2) & " sugerencias de reposición China?Chile.", vbInformation

Salir:
    Application.ScreenUpdating = True
    Application.Calculation = xlCalculationAutomatic
    Exit Sub

ErrorHandler:
    MsgBox "Error en GenerarSugerenciasChinaChile: " & Err.Description & vbCrLf & _
           "Línea: " & Erl & vbCrLf & _
           "Número: " & Err.Number, vbCritical
    Resume Salir

End Sub
