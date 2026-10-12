// ============================================
// NEXUS DENTAL — Worker health endpoint
// GET /healthz  -> the process is up (liveness)
// GET /readyz   -> Redis and the database answer within 1.5 s (readiness)
// Carries no data, so it is safe to expose to the platform's probe.
// ============================================

import http from "http";
import { withTimeout } from "@/lib/queue/heartbeat";

export function startHealthServer(port: number, ready: () => Promise<void>): http.Server {
    const server = http.createServer(async (req, res) => {
        const send = (code: number, body: object) => {
            res.writeHead(code, { "Content-Type": "application/json" });
            res.end(JSON.stringify(body));
        };
        if (req.url === "/healthz") return send(200, { status: "ok" });
        if (req.url === "/readyz") {
            try {
                await withTimeout(ready(), 1500, "readiness");
                return send(200, { status: "ready" });
            } catch {
                return send(503, { status: "not-ready" });
            }
        }
        return send(404, { status: "not-found" });
    });
    server.listen(port);
    return server;
}
