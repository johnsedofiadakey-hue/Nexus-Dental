"use client";

import { useSocket } from "@/lib/hooks/use-socket";
import { toast } from "sonner";
import { useEffect } from "react";

/**
 * Global Real-time Listener Component.
 * Can be dropped into Dashboards to handle global socket events.
 */
export function RealTimeListener({ tenantId }: { tenantId?: string }) {
    const { isConnected } = useSocket(tenantId);

    useEffect(() => {
        if (isConnected) {
            console.log("[Live] Real-time channel active");
        }
    }, [isConnected]);

    return null;
}
