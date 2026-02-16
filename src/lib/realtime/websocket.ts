// ============================================
// NEXUS DENTAL — WebSocket Service
// Real-time alerts and notifications
// ============================================

import { Server } from "socket.io";
import type { Server as HTTPServer } from "http";

let io: Server | null = null;

/**
 * Initialize WebSocket server.
 * In a Next.js environment, this typically happens in a custom server (server.ts).
 */
export function initWebSocket(server: HTTPServer) {
    if (io) return io;

    io = new Server(server, {
        path: "/api/socketio",
        addTrailingSlash: false,
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });

    io.on("connection", (socket) => {
        console.log(`[Socket] New connection: ${socket.id}`);

        // Join tenant-specific channel for scoped updates
        socket.on("join-tenant", (tenantId: string) => {
            socket.join(`tenant-${tenantId}`);
            console.log(`[Socket] ${socket.id} joined tenant-${tenantId}`);
        });

        // Join patient-specific channel
        socket.on("join-patient", (patientId: string) => {
            socket.join(`patient-${patientId}`);
            console.log(`[Socket] ${socket.id} joined patient-${patientId}`);
        });

        socket.on("disconnect", () => {
            console.log(`[Socket] Disconnected: ${socket.id}`);
        });
    });

    return io;
}

/**
 * Get the global Socket.io instance.
 */
export function getIO() {
    return io;
}

/**
 * Broadcast an alert to a specific tenant.
 */
export function broadcastTenantAlert(tenantId: string, event: string, data: any) {
    if (!io) {
        console.warn("[Socket] Attempted to broadcast alert before initialization");
        return;
    }
    io.to(`tenant-${tenantId}`).emit(event, data);
}

/**
 * Send a direct real-time notification to a patient.
 */
export function notifyPatientRealtime(patientId: string, data: any) {
    if (!io) return;
    io.to(`patient-${patientId}`).emit("patient-notification", data);
}
