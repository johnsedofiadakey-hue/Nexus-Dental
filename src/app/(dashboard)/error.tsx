"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex h-screen items-center justify-center bg-slate-50">
            <div className="text-center max-w-md px-6">
                <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
                <p className="text-sm text-slate-500 mb-6">{error.message || "An unexpected error occurred."}</p>
                <Button onClick={reset} className="bg-teal-600 hover:bg-teal-700">Try again</Button>
            </div>
        </div>
    );
}
