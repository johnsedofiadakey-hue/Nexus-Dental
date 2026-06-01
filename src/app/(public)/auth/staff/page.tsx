"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// Window.google is declared in src/types/google-gsi.d.ts

function redirectByRole(role: string, router: ReturnType<typeof useRouter>) {
    if (role === "SYSTEM_OWNER") router.push("/system/dashboard");
    else if (role === "DOCTOR" || role === "NURSE") router.push("/clinical");
    else if (role === "BILLING_STAFF") router.push("/finance");
    else if (role === "INVENTORY_MANAGER") router.push("/inventory");
    else router.push("/dashboard");
}

export default function StaffLoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [formData, setFormData] = useState({ email: "", password: "" });

    // Handle the Google credential callback
    const handleGoogleCredential = useCallback(async (credential: string) => {
        setGoogleLoading(true);
        try {
            const res = await fetch("/api/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ idToken: credential }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Welcome, ${data.data.user.firstName}`);
                redirectByRole(data.data.user.role, router);
            } else {
                toast.error(data.error || "Google sign-in failed");
            }
        } catch {
            toast.error("Google sign-in failed. Try again.");
        } finally {
            setGoogleLoading(false);
        }
    }, [router]);

    // Load Google Identity Services script and initialize
    useEffect(() => {
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        if (!clientId) return; // Google not configured — silently hide the button

        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => {
            window.google?.accounts.id.initialize({
                client_id: clientId,
                callback: (response) => handleGoogleCredential(response.credential),
                cancel_on_tap_outside: true,
            });

            const btn = document.getElementById("google-signin-btn");
            if (btn) {
                window.google?.accounts.id.renderButton(btn, {
                    type: "standard",
                    shape: "rectangular",
                    theme: "outline",
                    text: "signin_with",
                    size: "large",
                    logo_alignment: "left",
                    width: "100%",
                });
            }
        };
        document.body.appendChild(script);
        return () => { document.body.removeChild(script); };
    }, [handleGoogleCredential]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Welcome back, ${data.user.firstName}`);
                redirectByRole(data.user.role, router);
            } else {
                toast.error(data.error || "Authentication failed");
            }
        } catch {
            toast.error("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    const googleConfigured = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md space-y-8">
                {/* Branding */}
                <div className="text-center space-y-2">
                    <Link href="/" className="inline-flex items-center gap-2 no-underline mb-4">
                        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                            <ShieldCheck className="text-white h-6 w-6" />
                        </div>
                        <span className="text-2xl font-heading text-secondary font-bold tracking-tight">Nexus Internal</span>
                    </Link>
                    <h1 className="text-3xl font-heading text-secondary">Staff Access</h1>
                    <p className="text-slate-500">Sign in to the clinical management system.</p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-hero"
                >
                    {/* Google Sign-In */}
                    {googleConfigured && (
                        <>
                            <div className="mb-6">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 text-center">
                                    Sign in with your work account
                                </p>
                                {googleLoading ? (
                                    <div className="h-11 flex items-center justify-center rounded-2xl border border-slate-200 text-sm text-slate-500">
                                        Signing in…
                                    </div>
                                ) : (
                                    <div id="google-signin-btn" className="w-full flex justify-center" />
                                )}
                            </div>

                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-100" />
                                </div>
                                <div className="relative flex justify-center text-xs">
                                    <span className="bg-white px-3 text-slate-400 font-medium">or sign in with password</span>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Email / Password form */}
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Work Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="name@yourclinic.com"
                                    className="pl-12 h-14 rounded-2xl bg-slate-50 border-none shadow-inner focus-visible:ring-secondary"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    type="password"
                                    required
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="••••••••"
                                    className="pl-12 h-14 rounded-2xl bg-slate-50 border-none shadow-inner focus-visible:ring-secondary"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-14 rounded-2xl bg-secondary hover:bg-secondary/90 text-white text-lg font-semibold group mt-4 transition-all hover:shadow-lg shadow-secondary/20"
                            disabled={loading}
                        >
                            {loading ? "Authenticating..." : "Sign In to Clinic"}
                            {!loading && <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />}
                        </Button>
                    </form>

                    <div className="mt-10 pt-6 border-t border-slate-100 flex justify-between items-center text-xs">
                        <Link href="/contact" className="text-slate-500 hover:text-secondary font-medium">Forgot password?</Link>
                        <span className="text-slate-300">|</span>
                        <Link href="/onboarding" className="text-teal-600 hover:text-teal-700 font-medium">Register your clinic →</Link>
                    </div>
                </motion.div>

                <p className="text-center text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">
                    Authorized Personnel Only • Secure 256-bit Encryption
                </p>
            </div>
        </div>
    );
}
