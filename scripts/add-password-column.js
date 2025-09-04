// scripts/add-password-column.js
// Script para agregar la columna password a la tabla users y establecer contraseña por defecto

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configurar cliente de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Variables de entorno de Supabase no encontradas');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addPasswordColumnAndSetDefaults() {
    try {
        console.log('🔄 Agregando columna password y estableciendo contraseñas por defecto...');

        // Ejecutar SQL para agregar la columna password
        const { data: addColumnResult, error: addColumnError } = await supabase.rpc('exec_sql', {
            query: `
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '123456';
                
                UPDATE users 
                SET password = '123456' 
                WHERE password IS NULL OR password = '';
            `
        });

        if (addColumnError) {
            // Si no existe la función exec_sql, intentamos con una query directa
            console.log('⚠️  Función exec_sql no encontrada, intentando método alternativo...');
            
            // Método alternativo: usar .from() con un INSERT que agregue la columna implícitamente
            const { data: users, error: fetchError } = await supabase
                .from('users')
                .select('*');

            if (fetchError) {
                throw new Error(`Error obteniendo usuarios: ${fetchError.message}`);
            }

            console.log('📋 Usuarios actuales:', users?.length || 0);

            // Intentar actualizar cada usuario con password
            for (const user of users || []) {
                const { data, error } = await supabase
                    .from('users')
                    .update({ password: '123456' })
                    .eq('id', user.id)
                    .select();

                if (error) {
                    console.log(`⚠️  No se pudo actualizar ${user.email}: ${error.message}`);
                } else {
                    console.log(`✅ Actualizado ${user.email}`);
                }
            }
        } else {
            console.log('✅ Columna password agregada y contraseñas establecidas');
        }

        // Verificar el resultado final
        const { data: finalUsers, error: finalError } = await supabase
            .from('users')
            .select('id, email, name, password');

        if (finalError) {
            console.log('⚠️  Error verificando resultado:', finalError.message);
        } else {
            console.log('\n🎉 Estado final de usuarios:');
            finalUsers?.forEach(user => {
                console.log(`  ✓ ${user.email} - Contraseña: ${user.password || 'NO ESTABLECIDA'}`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Ejecutar el script
addPasswordColumnAndSetDefaults();