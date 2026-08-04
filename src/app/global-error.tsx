"use client";

// Catches errors thrown while rendering the root layout — the one place
// a normal error.tsx boundary can't reach. Reports to Sentry, then shows
// a minimal fallback (deliberately dependency-light: if the root layout
// itself is broken, this page can't lean on anything that might also be broken).

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html lang="en">
            <body
                style={{
                    fontFamily:
                        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif",
                    display: "flex",
                    minHeight: "100vh",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "24px",
                    background: "#FAFAF8",
                    color: "#16191C",
                }}
            >
                <div style={{ maxWidth: "420px", textAlign: "center" }}>
                    <h1 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
                        Something went wrong
                    </h1>
                    <p style={{ fontSize: "14px", color: "#525A5F", marginBottom: "20px" }}>
                        We&apos;ve been notified and are looking into it. Try reloading the page.
                    </p>
                    <button
                        onClick={() => reset()}
                        style={{
                            fontSize: "14px",
                            fontWeight: 600,
                            padding: "10px 20px",
                            borderRadius: "8px",
                            border: "none",
                            background: "#0E6B5C",
                            color: "#fff",
                            cursor: "pointer",
                        }}
                    >
                        Try again
                    </button>
                </div>
            </body>
        </html>
    );
}
