"use client";

import { AlertCircle } from "lucide-react";

export default function SystemError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex h-screen items-center justify-center bg-slate-950">
            <div className="text-center max-w-md px-6">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">System Error</h2>
                <p className="text-sm text-slate-400 mb-6">{error.message || "An unexpected error occurred in the system console."}</p>
                <button
                    onClick={reset}
                    className="px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
                >
                    Try again
                </button>
            </div>
        </div>
    );
}
