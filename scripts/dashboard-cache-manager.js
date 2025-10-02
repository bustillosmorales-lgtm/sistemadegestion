// scripts/dashboard-cache-manager.js - Gestión completa del cache de dashboard
const { supabase } = require('../lib/supabaseClient');

class DashboardCacheManager {

  async cleanExpiredCache() {
    console.log('🧹 Cleaning expired cache...');
    try {
      const { data, error } = await supabase.rpc('clean_expired_dashboard_cache');
      if (error) throw error;
      console.log(`✅ Cleaned ${data || 0} expired cache entries`);
      return data || 0;
    } catch (error) {
      console.error('❌ Error cleaning cache:', error);
      throw error;
    }
  }

  async forceCacheRefresh() {
    console.log('🔄 Forcing complete cache refresh...');
    try {
      // 1. Limpiar todo el cache
      const { error: deleteError } = await supabase
        .from('dashboard_analysis_cache')
        .delete()
        .neq('id', 0); // Delete all

      if (deleteError) throw deleteError;

      // 2. Trigger background recalculation
      const response = await fetch('http://localhost:3000/api/background-analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'full_recalculation',
          priority: 'high'
        })
      });

      if (!response.ok) throw new Error('Background analyzer failed');

      const result = await response.json();
      console.log('✅ Cache refresh completed:', result);
      return result;

    } catch (error) {
      console.error('❌ Error refreshing cache:', error);
      throw error;
    }
  }

  async getCacheStats() {
    console.log('📊 Getting cache statistics...');
    try {
      // Total entries
      const { count: totalEntries, error: countError } = await supabase
        .from('dashboard_analysis_cache')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      // Valid entries (not expired)
      const { count: validEntries, error: validError } = await supabase
        .from('dashboard_analysis_cache')
        .select('*', { count: 'exact', head: true })
        .gt('expires_at', new Date().toISOString());

      if (validError) throw validError;

      // Oldest and newest entries
      const { data: oldestEntry, error: oldestError } = await supabase
        .from('dashboard_analysis_cache')
        .select('calculated_at')
        .order('calculated_at', { ascending: true })
        .limit(1);

      const { data: newestEntry, error: newestError } = await supabase
        .from('dashboard_analysis_cache')
        .select('calculated_at')
        .order('calculated_at', { ascending: false })
        .limit(1);

      if (oldestError || newestError) throw oldestError || newestError;

      const stats = {
        totalEntries: totalEntries || 0,
        validEntries: validEntries || 0,
        expiredEntries: (totalEntries || 0) - (validEntries || 0),
        hitRatio: totalEntries > 0 ? `${Math.round((validEntries / totalEntries) * 100)}%` : '0%',
        oldestEntry: oldestEntry?.[0]?.calculated_at || null,
        newestEntry: newestEntry?.[0]?.calculated_at || null,
        cacheAge: oldestEntry?.[0] ? Math.round((Date.now() - new Date(oldestEntry[0].calculated_at).getTime()) / (1000 * 60)) : 0
      };

      console.log('📈 Cache Stats:', stats);
      return stats;

    } catch (error) {
      console.error('❌ Error getting cache stats:', error);
      throw error;
    }
  }

  async optimizeCache() {
    console.log('🚀 Optimizing cache...');
    try {
      // 1. Clean expired
      const cleanedCount = await this.cleanExpiredCache();

      // 2. Get current stats
      const statsBefore = await this.getCacheStats();

      // 3. Refresh if cache is too old (> 2 hours) or hit ratio is low (< 80%)
      const cacheAgeHours = statsBefore.cacheAge / 60;
      const hitRatio = parseInt(statsBefore.hitRatio.replace('%', ''));

      if (cacheAgeHours > 2 || hitRatio < 80) {
        console.log(`🔄 Cache needs refresh: age=${cacheAgeHours.toFixed(1)}h, hit ratio=${hitRatio}%`);
        await this.forceCacheRefresh();
      }

      const statsAfter = await this.getCacheStats();

      return {
        optimized: true,
        cleanedExpired: cleanedCount,
        statsBefore,
        statsAfter,
        cacheRefreshed: cacheAgeHours > 2 || hitRatio < 80
      };

    } catch (error) {
      console.error('❌ Error optimizing cache:', error);
      throw error;
    }
  }

  async scheduleOptimization() {
    console.log('⏰ Starting scheduled cache optimization...');

    // Run optimization every hour
    setInterval(async () => {
      try {
        await this.optimizeCache();
        console.log('✅ Scheduled optimization completed');
      } catch (error) {
        console.error('❌ Scheduled optimization failed:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    // Initial optimization
    await this.optimizeCache();
    console.log('🎯 Cache optimization scheduler started');
  }
}

// CLI interface
async function main() {
  const manager = new DashboardCacheManager();
  const command = process.argv[2];

  try {
    switch (command) {
      case 'clean':
        await manager.cleanExpiredCache();
        break;

      case 'refresh':
        await manager.forceCacheRefresh();
        break;

      case 'stats':
        await manager.getCacheStats();
        break;

      case 'optimize':
        await manager.optimizeCache();
        break;

      case 'schedule':
        await manager.scheduleOptimization();
        // Keep process alive
        process.stdin.resume();
        break;

      default:
        console.log(`
🎛️  Dashboard Cache Manager

Usage: node scripts/dashboard-cache-manager.js <command>

Commands:
  clean     - Clean expired cache entries
  refresh   - Force complete cache refresh
  stats     - Show cache statistics
  optimize  - Clean + refresh if needed
  schedule  - Start background optimization scheduler

Examples:
  npm run cache-clean
  npm run cache-refresh
  npm run cache-stats
  npm run cache-optimize
        `);
    }
  } catch (error) {
    console.error('💥 Command failed:', error);
    process.exit(1);
  }
}

// Export for use as module
module.exports = DashboardCacheManager;

// Run CLI if called directly
if (require.main === module) {
  main();
}