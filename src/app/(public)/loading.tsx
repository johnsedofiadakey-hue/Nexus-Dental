import { Loader2 } from "lucide-react";

export default function PublicLoading() {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
        </div>
    );
}
