// pages/api/category-mapping.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
    const { method } = req;

    switch (method) {
        case 'GET':
            return await handleGetMappings(req, res);
        case 'POST':
            return await handleCreateMapping(req, res);
        case 'PUT':
            return await handleAutoMap(req, res);
        default:
            res.setHeader('Allow', ['GET', 'POST', 'PUT']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}

async function handleGetMappings(req, res) {
    try {
        // Obtener productos sin categoría o con categoría vacía
        const { data: productosSinCategoria, error } = await supabase
            .from('products')
            .select('sku, descripcion, categoria, name, description')
            .or('categoria.is.null,categoria.eq.')
            .limit(100);

        if (error) {
            console.error('Error obteniendo productos sin categoría:', error);
            return res.status(500).json({ error: 'Error obteniendo productos' });
        }

        // Obtener categorías existentes para sugerencias
        const { data: categoriasExistentes, error: catError } = await supabase
            .from('products')
            .select('categoria')
            .not('categoria', 'is', null)
            .neq('categoria', '');

        const categorias = [...new Set(categoriasExistentes?.map(p => p.categoria) || [])];

        return res.status(200).json({
            productos_sin_categoria: productosSinCategoria || [],
            categorias_existentes: categorias,
            total: productosSinCategoria?.length || 0
        });

    } catch (error) {
        console.error('Error en API category-mapping GET:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}

async function handleCreateMapping(req, res) {
    try {
        const { sku, categoria } = req.body;

        if (!sku || !categoria) {
            return res.status(400).json({ 
                error: 'SKU y categoría son requeridos' 
            });
        }

        // Actualizar producto con nueva categoría
        const { data: productoActualizado, error: updateError } = await supabase
            .from('products')
            .update({ 
                categoria: categoria.trim(),
                updated_at: new Date().toISOString()
            })
            .eq('sku', sku)
            .select()
            .single();

        if (updateError) {
            console.error('Error actualizando categoría:', updateError);
            return res.status(500).json({ error: 'Error actualizando categoría' });
        }

        return res.status(200).json({
            message: 'Categoría asignada exitosamente',
            producto: productoActualizado
        });

    } catch (error) {
        console.error('Error en API category-mapping POST:', error);
        return res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message
        });
    }
}

async function handleAutoMap(req, res) {
    try {
        const { force_all = false } = req.body;
        
        console.log('🤖 Iniciando mapeo automático de categorías...');
        
        // Obtener productos sin categoría
        const { data: productos, error } = await supabase
            .from('products')
            .select('sku, descripcion, name, description')
            .or('categoria.is.null,categoria.eq.')
            .limit(force_all ? 1000 : 50);

        if (error) {
            return res.status(500).json({ error: 'Error obteniendo productos' });
        }

        if (!productos || productos.length === 0) {
            return res.status(200).json({
                message: 'No hay productos sin categoría para mapear',
                procesados: 0,
                exitosos: 0
            });
        }

        // Mapeo automático basado en palabras clave
        const categoriaMappings = {
            'Iluminación': ['led', 'luz', 'lampara', 'foco', 'bombilla', 'luces', 'iluminacion'],
            'Electrónica': ['electronico', 'cable', 'adaptador', 'cargador', 'usb', 'bluetooth', 'wifi'],
            'Hogar': ['hogar', 'casa', 'cocina', 'baño', 'dormitorio', 'living', 'decoracion'],
            'Herramientas': ['herramienta', 'taladro', 'destornillador', 'martillo', 'llave', 'tornillo'],
            'Juguetes': ['juguete', 'niños', 'infantil', 'bebe', 'muñeca', 'auto', 'peluche'],
            'Deportes': ['deporte', 'fitness', 'ejercicio', 'pelota', 'bicicleta', 'running'],
            'Belleza': ['belleza', 'cosmetico', 'maquillaje', 'crema', 'shampoo', 'perfume'],
            'Ropa': ['ropa', 'camisa', 'pantalon', 'vestido', 'zapatos', 'calcetines'],
            'Tecnología': ['smartphone', 'tablet', 'computador', 'auricular', 'mouse', 'teclado'],
            'Automóvil': ['auto', 'carro', 'vehiculo', 'neumatico', 'aceite', 'repuesto']
        };

        let exitosos = 0;
        let errores = [];

        for (const producto of productos) {
            try {
                const descripcion = (
                    producto.descripcion || 
                    producto.name || 
                    producto.description || 
                    ''
                ).toLowerCase();

                let categoriaDetectada = 'General';

                // Buscar categoría por palabras clave
                for (const [categoria, keywords] of Object.entries(categoriaMappings)) {
                    if (keywords.some(keyword => descripcion.includes(keyword))) {
                        categoriaDetectada = categoria;
                        break;
                    }
                }

                // Actualizar producto
                const { error: updateError } = await supabase
                    .from('products')
                    .update({ 
                        categoria: categoriaDetectada,
                        updated_at: new Date().toISOString()
                    })
                    .eq('sku', producto.sku);

                if (updateError) {
                    errores.push({
                        sku: producto.sku,
                        error: updateError.message
                    });
                } else {
                    exitosos++;
                    console.log(`✅ ${producto.sku}: "${descripcion.substring(0, 30)}..." → ${categoriaDetectada}`);
                }

            } catch (itemError) {
                errores.push({
                    sku: producto.sku,
                    error: itemError.message
                });
            }
        }

        console.log(`🎯 Mapeo automático completado: ${exitosos}/${productos.length} exitosos`);

        return res.status(200).json({
            message: 'Mapeo automático de categorías completado',
            procesados: productos.length,
            exitosos,
            errores: errores.length,
            detalles_errores: errores.slice(0, 5) // Solo primeros 5 errores
        });

    } catch (error) {
        console.error('Error en API category-mapping PUT:', error);
        return res.status(500).json({ 
            error: 'Error interno del servidor',
            details: error.message
        });
    }
}