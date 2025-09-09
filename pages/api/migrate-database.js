// pages/api/migrate-database.js
// API para ejecutar migraciones de base de datos
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Solo método POST permitido' });
    }

    const { user } = req.body;

    // Control de acceso - Solo admin
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Solo usuarios admin pueden ejecutar migraciones.' });
    }

    try {
        console.log('🔄 Iniciando migración de tabla products...');

        // Agregar columna categoria si no existe
        const { error: error1 } = await supabase.rpc('exec_sql', {
            query: `
                DO $$ 
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                   WHERE table_name = 'products' AND column_name = 'categoria') THEN
                        ALTER TABLE products ADD COLUMN categoria TEXT;
                    END IF;
                END $$;
            `
        });

        // Agregar columna precio_venta_sugerido si no existe
        const { error: error2 } = await supabase.rpc('exec_sql', {
            query: `
                DO $$ 
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                   WHERE table_name = 'products' AND column_name = 'precio_venta_sugerido') THEN
                        ALTER TABLE products ADD COLUMN precio_venta_sugerido DECIMAL(10,2);
                    END IF;
                END $$;
            `
        });

        // Agregar columna proveedor si no existe
        const { error: error3 } = await supabase.rpc('exec_sql', {
            query: `
                DO $$ 
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                   WHERE table_name = 'products' AND column_name = 'proveedor') THEN
                        ALTER TABLE products ADD COLUMN proveedor TEXT;
                    END IF;
                END $$;
            `
        });

        // Agregar columna notas si no existe
        const { error: error4 } = await supabase.rpc('exec_sql', {
            query: `
                DO $$ 
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                   WHERE table_name = 'products' AND column_name = 'notas') THEN
                        ALTER TABLE products ADD COLUMN notas TEXT;
                    END IF;
                END $$;
            `
        });

        // Agregar columna codigo_interno si no existe
        const { error: error5 } = await supabase.rpc('exec_sql', {
            query: `
                DO $$ 
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                   WHERE table_name = 'products' AND column_name = 'codigo_interno') THEN
                        ALTER TABLE products ADD COLUMN codigo_interno TEXT;
                    END IF;
                END $$;
            `
        });

        // Verificar errores
        const errors = [error1, error2, error3, error4, error5].filter(e => e);
        if (errors.length > 0) {
            console.error('❌ Errores en migración:', errors);
            return res.status(500).json({ 
                error: 'Error ejecutando migración', 
                details: errors 
            });
        }

        // Verificar las columnas existentes
        const { data: columns, error: verifyError } = await supabase.rpc('exec_sql', {
            query: `
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'products' 
                ORDER BY ordinal_position;
            `
        });

        if (verifyError) {
            console.error('❌ Error verificando columnas:', verifyError);
            return res.status(500).json({ 
                error: 'Error verificando estructura de tabla', 
                details: verifyError 
            });
        }

        console.log('✅ Migración completada exitosamente');

        return res.status(200).json({
            message: 'Migración de tabla products completada exitosamente',
            columns: columns,
            newColumns: ['categoria', 'precio_venta_sugerido', 'proveedor', 'notas', 'codigo_interno']
        });

    } catch (error) {
        console.error('❌ Error en migración:', error);
        return res.status(500).json({ 
            error: 'Error interno en migración: ' + error.message 
        });
    }
}