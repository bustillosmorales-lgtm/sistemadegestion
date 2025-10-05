// pages/api/purge-database.js
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tableType, user } = req.body;

    // Verificar autorización - solo admin y chile
    if (!user || (user.role !== 'admin' && user.role !== 'chile')) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Verificar que no sea productos (productos no se puede depurar)
    if (tableType === 'productos') {
      return res.status(400).json({ error: 'No se puede depurar la tabla de productos' });
    }

    let tableName;
    switch (tableType) {
      case 'ventas':
        tableName = 'ventas';
        break;
      case 'compras':
        tableName = 'compras';
        break;
      case 'containers':
        tableName = 'contenedores';
        break;
      default:
        return res.status(400).json({ error: 'Tipo de tabla inválido' });
    }

    console.log(`🗑️ Iniciando depuración de tabla: ${tableName}`);
    console.log(`👤 Usuario: ${user.username} (${user.role})`);

    // Primero contar cuántos registros hay
    const { count: beforeCount, error: countError } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error contando registros:', countError);
      throw countError;
    }

    console.log(`📊 Registros antes de depurar: ${beforeCount}`);

    // Eliminar todos los registros
    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .neq('id', 0); // Esto eliminará todos los registros

    if (deleteError) {
      console.error('Error eliminando registros:', deleteError);
      throw deleteError;
    }

    // Verificar que se eliminaron todos
    const { count: afterCount, error: verifyError } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (verifyError) {
      console.error('Error verificando eliminación:', verifyError);
      throw verifyError;
    }

    console.log(`✅ Depuración completada`);
    console.log(`📊 Registros eliminados: ${beforeCount}`);
    console.log(`📊 Registros restantes: ${afterCount}`);

    return res.status(200).json({
      success: true,
      message: `Base de datos ${tableName} depurada exitosamente`,
      deletedCount: beforeCount,
      remainingCount: afterCount,
      tableName: tableName
    });

  } catch (error) {
    console.error('❌ Error en depuración:', error);
    return res.status(500).json({
      error: 'Error al depurar base de datos',
      details: error.message
    });
  }
}
