"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";

let socket: Socket | null = null;

/**
 * Hook to manage Socket.io connection and events.
 * Handles automatic re-connection and tenant-scoped channel joining.
 */
export function useSocket(tenantId?: string | null) {
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!socket) {
            socket = io({
                path: "/api/socketio",
                addTrailingSlash: false,
            });
        }

        function onConnect() {
            setIsConnected(true);
            console.log("[Socket] Connected to server");

            if (tenantId) {
                socket?.emit("join-tenant", tenantId);
            }
        }

        function onDisconnect() {
            setIsConnected(false);
            console.log("[Socket] Disconnected from server");
        }

        function onAlert(data: any) {
            toast.info(data.title || "New Alert", {
                description: data.content,
            });
        }

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("system-alert", onAlert);
        socket.on("tenant-alert", onAlert);

        return () => {
            socket?.off("connect", onConnect);
            socket?.off("disconnect", onDisconnect);
            socket?.off("system-alert", onAlert);
            socket?.off("tenant-alert", onAlert);
        };
    }, [tenantId]);

    return {
        socket,
        isConnected,
    };
}
