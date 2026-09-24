"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!email.trim()) return;
        setLoading(true);
        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            if (res.status === 429) {
                toast.error("Too many requests. Please try again later.");
            } else {
                // The server answers identically whether or not the account exists.
                setSent(true);
            }
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    }

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
                    {sent ? (
                        <div className="text-center py-4">
                            <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
                                <MailCheck className="w-7 h-7 text-teal-600" />
                            </div>
                            <h1 className="text-xl font-bold text-slate-900 mb-2">Check your email</h1>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                If an account exists for <strong>{email}</strong>, we&apos;ve sent a link to reset the
                                password. It works once and expires in 1 hour.
                            </p>
                            <Link href="/auth/staff" className="inline-block mt-6 text-sm font-medium text-teal-600 hover:underline">
                                Back to sign in
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <h1 className="text-2xl font-bold text-slate-900 mb-1">Forgot your password?</h1>
                            <p className="text-sm text-slate-500 mb-5">
                                Enter your work email and we&apos;ll send you a reset link.
                            </p>
                            <input
                                type="email"
                                required
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@yourclinic.com"
                                className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                            />
                            <button
                                type="submit"
                                disabled={loading}
                                className="mt-4 w-full h-11 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                            >
                                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : "Send reset link"}
                            </button>
                            <p className="text-center mt-4">
                                <Link href="/auth/staff" className="text-sm text-slate-500 hover:text-teal-700">
                                    Back to sign in
                                </Link>
                            </p>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
