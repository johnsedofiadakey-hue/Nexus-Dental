export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@/lib/queue/workers/appointment.worker');
    await import('@/lib/queue/workers/notification.worker');
    await import('@/lib/queue/workers/recall.worker');
  }
}
