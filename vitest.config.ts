import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    resolve: {
        alias: { "@": path.resolve(__dirname, "src") },
    },
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        // Required at import time by src/lib/auth/jwt.ts and src/lib/clinic.ts
        // (both deliberately throw when unset). Test-only values.
        env: {
            JWT_SECRET: "test-only-secret-not-used-anywhere-else",
            CLINIC_ID: "tenant-a",
        },
    },
});
