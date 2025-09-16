// scripts/reset-passwords.js
// Script para resetear todas las contraseñas a 123456

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configurar cliente de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Variables de entorno de Supabase no encontradas');
    console.log('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
    console.log('SUPABASE_SERVICE_ROLE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetAllPasswords() {
    try {
        console.log('🔄 Iniciando reset de contraseñas...');

        // Primero obtener la estructura de la tabla y lista de usuarios actuales
        const { data: currentUsers, error: fetchError } = await supabase
            .from('users')
            .select('*');

        if (fetchError) {
            throw new Error(`Error obteniendo usuarios: ${fetchError.message}`);
        }

        console.log(`📋 Encontrados ${currentUsers?.length || 0} usuarios:`);
        console.log('📝 Estructura de usuario ejemplo:', currentUsers?.[0] ? Object.keys(currentUsers[0]) : 'Sin usuarios');
        currentUsers?.forEach(user => {
            console.log(`  - ${user.email} (${user.name}) - ID: ${user.id}`);
        });

        // Actualizar todas las contraseñas a 123456
        const { data, error } = await supabase
            .from('users')
            .update({ password: '123456' })
            .select('id, email, name');

        if (error) {
            throw new Error(`Error resetting passwords: ${error.message}`);
        }

        console.log(`✅ Contraseñas reseteadas exitosamente para ${data?.length || 0} usuarios:`);
        data?.forEach(user => {
            console.log(`  ✓ ${user.email} (${user.name})`);
        });

        console.log('\n🎉 Reset completado! Todas las contraseñas son ahora: 123456');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Ejecutar el script
resetAllPasswords();