/**
 * Next.js Instrumentation Hook
 * Wird beim Server-Start ausgeführt
 * Perfekt für Cron-Jobs und andere Server-Initialisierung
 */

export async function register() {
  // Nur im Production-Mode Cron-Jobs starten
  if (process.env.NODE_ENV === 'production') {
    // Prüfe ob wir im Edge Runtime sind (Middleware läuft im Edge Runtime)
    // Edge Runtime hat typischerweise keinen require() oder andere Node.js-spezifische APIs
    const isEdgeRuntime = 
      // @ts-ignore - EdgeRuntime existiert nur im Edge Runtime
      typeof (globalThis as any).EdgeRuntime !== 'undefined' ||
      (typeof process === 'undefined') ||
      (typeof process !== 'undefined' && !process.versions?.node) ||
      // Next.js setzt diese Umgebungsvariable für Edge Runtime
      (typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'edge');
    
    if (isEdgeRuntime) {
      // Middleware läuft im Edge Runtime - hier keine Cron-Jobs starten
      // Cron-Jobs werden nur beim Node.js Server-Start initialisiert
      return;
    }
    
    console.log('[Instrumentation] Initializing cron jobs in Node.js runtime...');
    
    // Dynamisches Import NACH dem Build (zur Laufzeit)
    // Verzögere die Ausführung um sicherzustellen dass alles geladen ist
    Promise.resolve().then(async () => {
      try {
        const cronModule = await import('./lib/cron');
        cronModule.startConflictCheckCron();
        console.log('[Instrumentation] Cron jobs initialized successfully');
      } catch (error: any) {
        console.error('[Instrumentation] Error initializing cron jobs:', error);
      }
    }).catch(error => {
      console.error('[Instrumentation] Error in cron initialization promise:', error);
    });
  } else {
    console.log('[Instrumentation] Skipping cron jobs in development mode');
  }
}

