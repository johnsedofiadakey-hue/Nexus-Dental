// ============================================
// NEXUS DENTAL — Queue Manager
// Centralized worker lifecycle management
// ============================================

import { Worker } from "bullmq";
import { queueRedisConnection } from "./redis";

/**
 * Registry of active workers
 * Prevents garbage collection, ensures workers stay alive
 */
const activeWorkers: Map<string, Worker> = new Map();

/**
 * Register a worker for lifecycle management
 */
export function registerWorker(name: string, worker: Worker) {
  if (!worker || typeof worker !== "object" || !("close" in worker)) {
    console.warn(`[Queue] Invalid worker registration: ${name}`);
    return;
  }

  activeWorkers.set(name, worker);
  console.log(`[Queue] Worker registered: ${name}`);

  // Track worker health
  worker.on("error", (error) => {
    console.error(`[Queue] Worker error (${name}):`, error);
  });

  worker.on("failed", (job, error) => {
    console.error(`[Queue] Job failed (${name}):`, job?.id, error.message);
  });

  worker.on("drained", () => {
    console.log(`[Queue] Worker drained (${name}) - waiting for more jobs`);
  });
}

/**
 * Graceful shutdown of all workers
 */
export async function shutdownWorkers() {
  console.log("[Queue] Shutting down workers...");
  for (const [name, worker] of activeWorkers) {
    try {
      await worker.close();
      console.log(`[Queue] Worker closed: ${name}`);
    } catch (error) {
      console.error(`[Queue] Error closing worker ${name}:`, error);
    }
  }
  activeWorkers.clear();
}

/**
 * Get worker status
 */
export function getWorkerStatus() {
  return {
    activeWorkers: Array.from(activeWorkers.keys()),
    count: activeWorkers.size,
    timestamp: new Date().toISOString(),
  };
}
