"use client";

import { AlertCircle } from "lucide-react";

export default function PublicError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex min-h-screen items-center justify-center px-4">
            <div className="text-center max-w-sm">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h2 className="text-lg font-bold text-slate-900 mb-2">Page Error</h2>
                <p className="text-sm text-slate-500 mb-6">{error.message || "Something went wrong loading this page."}</p>
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
