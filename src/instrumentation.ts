export async function register() {
  // `next build` calls register() too. Nothing here may run then: no Redis,
  // no queue workers, no Sentry, no signal handlers, no config enforcement
  // (the build environment is not the runtime environment).
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return;
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Fail closed: in production a release with incomplete or inconsistent
    // deployment configuration must not start serving traffic. Reports variable
    // NAMES only, never values. Skipped during `next build`.
    //
    // Exit explicitly rather than just throwing: a throw here leaves the Node
    // process running (but not listening), which hides the failure. A non-zero
    // exit is unambiguous to the platform, the rollout and the operator.
    const { enforceStartupConfig, ConfigError } = await import('@/lib/config/validate');
    try {
      enforceStartupConfig(process.env);
    } catch (error) {
      if (error instanceof ConfigError) {
        console.error(`[Config] Refusing to start. ${error.message}`);
        process.exit(1);
      }
      throw error;
    }

    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      debug: false,
    });

    // Background workers do NOT run here. The web service scales to zero, so jobs
    // started in this process stop when the site is idle. They run in the separate
    // always-on worker process (src/worker/index.ts, `npm run worker`); the web
    // app only enqueues jobs.
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      debug: false,
    });
  }
}

export const onRequestError = async (...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>) => {
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(...args);
};
