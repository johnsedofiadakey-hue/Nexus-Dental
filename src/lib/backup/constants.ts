// ============================================
// NEXUS DENTAL — Backup constants
//
// Dependency-free on purpose: the web app (callback route, health checks) and the
// backup/restore scripts must agree on exactly what a valid backup record looks
// like, and the web bundle must not have to pull in the encryption library to do it.
// ============================================

/** Bump when the stored layout changes. Records of any other version never count as healthy. */
export const BACKUP_FORMAT_VERSION = 1;

/** Dumps are held in memory while being encrypted; refuse sizes Node cannot hold safely. */
export const MAX_BACKUP_BYTES = 1_500_000_000;

/** A real clinic dump is never this small, and ciphertext is never smaller than its plaintext. */
export const MIN_BACKUP_BYTES = 2048;

/** age adds ~0.03% (a 16-byte tag per 64 KiB) plus a small header; 64 MiB is a generous ceiling. */
export const MAX_ENCRYPTED_BACKUP_BYTES = MAX_BACKUP_BYTES + 64 * 1024 * 1024;

export const SHA256_HEX = /^[a-f0-9]{64}$/;

/**
 * The only object keys the backup job ever writes (see backupKeys() in pipeline.ts):
 *   daily/YYYY-MM-DD/nexus-YYYY-MM-DD-<epoch ms>.dump.age
 *   monthly/YYYY-MM/nexus-YYYY-MM-DD-<epoch ms>.dump.age
 */
export const BACKUP_OBJECT_KEY = /^(?:daily\/\d{4}-\d{2}-\d{2}|monthly\/\d{4}-\d{2})\/nexus-\d{4}-\d{2}-\d{2}-\d{10,16}\.dump\.age$/;

/** Tolerated clock difference between the machine that ran a job and the app that records it. */
export const CLOCK_SKEW_MS = 5 * 60 * 1000;
