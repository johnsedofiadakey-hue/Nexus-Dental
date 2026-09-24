"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

function problems(pw: string): string[] {
    const out: string[] = [];
    if (pw.length < 8) out.push("at least 8 characters");
    if (!/[A-Z]/.test(pw)) out.push("an uppercase letter");
    if (!/[a-z]/.test(pw)) out.push("a lowercase letter");
    if (!/[0-9]/.test(pw)) out.push("a number");
    if (!/[!@#$%^&*()_+\-=[\]{};':"|,.<>?/]/.test(pw)) out.push("a special character");
    return out;
}

function ResetPasswordContent() {
    const token = useSearchParams().get("token") ?? "";
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");

    const missing = problems(password);
    const canSubmit = !!token && missing.length === 0 && password === confirm && !loading;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canSubmit) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });
            const data = await res.json();
            if (data.success) {
                setDone(true);
            } else {
                setError(data.error || "This reset link is invalid or has expired.");
            }
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    const input =
        "w-full h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-slate-50 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
                            <ShieldCheck className="text-white h-5 w-5" />
                        </div>
                        <span className="font-bold text-xl text-slate-900">Nexus Dental</span>
                    </Link>
                </div>

                <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-100 p-8">
                    {!token ? (
                        <div className="text-center py-4">
                            <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
                            <h1 className="text-xl font-bold text-slate-900 mb-2">Invalid link</h1>
                            <p className="text-sm text-slate-500">This reset link is missing its token.</p>
                            <Link href="/auth/forgot-password" className="inline-block mt-5 text-sm font-medium text-teal-600 hover:underline">
                                Request a new link
                            </Link>
                        </div>
                    ) : done ? (
                        <div className="text-center py-4">
                            <CheckCircle2 className="w-10 h-10 text-teal-600 mx-auto mb-3" />
                            <h1 className="text-xl font-bold text-slate-900 mb-2">Password updated</h1>
                            <p className="text-sm text-slate-500">You can now sign in with your new password.</p>
                            <Link href="/auth/staff" className="inline-block mt-5 w-full h-11 leading-[2.75rem] rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700">
                                Go to sign in
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} noValidate>
                            <h1 className="text-2xl font-bold text-slate-900 mb-1">Choose a new password</h1>
                            <p className="text-sm text-slate-500 mb-5">Pick something you don&apos;t use anywhere else.</p>
                            <input
                                type="password"
                                autoComplete="new-password"
                                className={`${input} mb-2`}
                                placeholder="New password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            {password.length > 0 && missing.length > 0 && (
                                <p className="text-xs text-amber-600 mb-2">Needs {missing.join(", ")}.</p>
                            )}
                            <input
                                type="password"
                                autoComplete="new-password"
                                className={`${input} mb-1`}
                                placeholder="Confirm new password"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                            />
                            {confirm.length > 0 && confirm !== password && (
                                <p className="text-xs text-red-600 mb-2">Passwords do not match.</p>
                            )}
                            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
                            <button
                                type="submit"
                                disabled={!canSubmit}
                                className="mt-4 w-full h-11 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                            >
                                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Update password"}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={null}>
            <ResetPasswordContent />
        </Suspense>
    );
}
