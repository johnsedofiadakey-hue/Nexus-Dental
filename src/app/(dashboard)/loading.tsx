import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
    return (
        <div className="flex h-screen items-center justify-center bg-slate-50">
            <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
        </div>
    );
}
