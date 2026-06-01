import { Loader2 } from "lucide-react";

export default function SystemLoading() {
    return (
        <div className="flex h-screen items-center justify-center bg-slate-950">
            <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
        </div>
    );
}
