export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Pre-warm the database connection on server startup
    console.log('[Instrumentation] Pre-warming database connection...');
    const startTime = Date.now();

    try {
      // Import and initialize the database client
      const { default: db } = await import('./lib/db/client');

      // Force initialization by running a simple query
      const result = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get() as any;

      const elapsed = Date.now() - startTime;
      console.log(`[Instrumentation] ✓ Database pre-warmed successfully in ${elapsed}ms`);
      console.log(`[Instrumentation] ✓ Found ${result.count} tables in database`);
    } catch (error) {
      console.error('[Instrumentation] ✗ Failed to pre-warm database:', error);
      // Don't throw - let the app start anyway
    }
  }
}
