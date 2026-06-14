export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Initializing workers...');

    try {
      // Import and register workers
      const appointmentWorker = await import('@/lib/queue/workers/appointment.worker');
      const notificationWorker = await import('@/lib/queue/workers/notification.worker');
      const recallWorker = await import('@/lib/queue/workers/recall.worker');
      const { registerWorker } = await import('@/lib/queue/manager');

      // Register workers for lifecycle management
      if (appointmentWorker.appointmentWorker) {
        registerWorker('appointment', appointmentWorker.appointmentWorker);
      }
      if (notificationWorker.notificationWorker) {
        registerWorker('notification', notificationWorker.notificationWorker);
      }
      if (recallWorker.recallWorker) {
        registerWorker('recall', recallWorker.recallWorker);
      }

      console.log('[Instrumentation] Workers initialized successfully');
    } catch (error) {
      console.error('[Instrumentation] Failed to initialize workers:', error);
      // Don't throw - allow app to start even if workers fail
      // Workers are optional for HTTP operations
    }

    // Graceful shutdown on process termination
    const handleShutdown = async (signal: string) => {
      console.log(`[Instrumentation] Received ${signal}, shutting down workers...`);
      const { shutdownWorkers } = await import('@/lib/queue/manager');
      await shutdownWorkers();
      process.exit(0);
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  }
}
