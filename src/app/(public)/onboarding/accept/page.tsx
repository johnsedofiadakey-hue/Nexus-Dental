"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Loader2, XCircle, CheckCircle2, Building2 } from "lucide-react";
import { toast } from "sonner";

// Window.google is declared in src/app/(public)/auth/staff/page.tsx

interface InviteInfo {
    email: string;
    role: string;
    clinic: { id: string; name: string; logo?: string };
    invitedBy: string;
    expiresAt: string;
}

function roleLabel(r: string) {
    return r.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function AcceptInvitePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [invite, setInvite] = useState<InviteInfo | null>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "signing-in" | "error" | "expired">("loading");
    const [errorMsg, setErrorMsg] = useState("");
    const googleBtnRef = useRef<HTMLDivElement>(null);

    // Load invite details
    useEffect(() => {
        if (!token) { setStatus("error"); setErrorMsg("No invite token found."); return; }

        fetch(`/api/staff/invite/${token}`)
            .then(r => r.json())
            .then(json => {
                if (json.success) {
                    setInvite(json.data);
                    setStatus("ready");
                } else {
                    setStatus(json.error?.includes("expired") ? "expired" : "error");
                    setErrorMsg(json.error || "Invalid invite.");
                }
            })
            .catch(() => { setStatus("error"); setErrorMsg("Failed to load invite."); });
    }, [token]);

    const handleGoogleCredential = useCallback(async (credential: string) => {
        setStatus("signing-in");
        try {
            const res = await fetch("/api/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ idToken: credential, inviteToken: token }),
            });
            const data = await res.json();

            if (data.success) {
                toast.success(`Welcome to ${data.data.user.clinicName}, ${data.data.user.firstName}!`);
                router.push("/dashboard");
            } else {
                setStatus("ready");
                toast.error(data.error || "Sign-in failed. Try again.");
            }
        } catch {
            setStatus("ready");
            toast.error("Network error. Please try again.");
        }
    }, [token, router]);

    // Render Google button once invite is confirmed ready
    useEffect(() => {
        if (status !== "ready") return;
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        if (!clientId || !googleBtnRef.current) return;

        const init = () => {
            window.google?.accounts.id.initialize({
                client_id: clientId,
                callback: (r) => handleGoogleCredential(r.credential),
            });
            if (googleBtnRef.current) {
                window.google?.accounts.id.renderButton(googleBtnRef.current, {
                    type: "standard",
                    shape: "rectangular",
                    theme: "outline",
                    text: "continue_with",
                    size: "large",
                    logo_alignment: "left",
                    width: "100%",
                });
            }
        };

        if (window.google) { init(); return; }

        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = init;
        document.body.appendChild(script);
        return () => { document.body.removeChild(script); };
    }, [status, handleGoogleCredential]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-slate-50 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md">

                {/* Brand */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
                            <ShieldCheck className="text-white h-5 w-5" />
                        </div>
                        <span className="font-bold text-xl text-slate-900">Nexus Dental</span>
                    </Link>
                </div>

                <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-100 p-8">

                    {/* Loading */}
                    {status === "loading" && (
                        <div className="flex flex-col items-center py-8 gap-4">
                            <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                            <p className="text-slate-500 text-sm">Validating your invitation…</p>
                        </div>
                    )}

                    {/* Error */}
                    {(status === "error" || status === "expired") && (
                        <div className="flex flex-col items-center py-8 gap-4 text-center">
                            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                                <XCircle className="w-7 h-7 text-red-500" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 mb-2">
                                    {status === "expired" ? "Invitation Expired" : "Invalid Invitation"}
                                </h2>
                                <p className="text-slate-500 text-sm leading-relaxed">{errorMsg}</p>
                                {status === "expired" && (
                                    <p className="text-slate-400 text-sm mt-2">
                                        Contact your clinic admin to send a new invite.
                                    </p>
                                )}
                            </div>
                            <Link href="/auth/staff" className="text-teal-600 text-sm font-medium hover:underline">
                                Go to staff login
                            </Link>
                        </div>
                    )}

                    {/* Ready to accept */}
                    {(status === "ready" || status === "signing-in") && invite && (
                        <>
                            {/* Clinic info */}
                            <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-teal-50 ring-1 ring-teal-100">
                                <div className="w-12 h-12 rounded-xl bg-teal-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                    {invite.clinic.logo
                                        ? <img src={invite.clinic.logo} alt="" className="w-12 h-12 rounded-xl object-cover" />
                                        : <Building2 className="w-6 h-6" />}
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900">{invite.clinic.name}</p>
                                    <p className="text-xs text-teal-700">Invited by {invite.invitedBy}</p>
                                </div>
                            </div>

                            <h1 className="text-2xl font-bold text-slate-900 mb-2">Accept your invitation</h1>
                            <p className="text-slate-500 text-sm mb-1">
                                You've been invited to join as a{" "}
                                <span className="font-semibold text-teal-700">{roleLabel(invite.role)}</span>.
                            </p>
                            <p className="text-slate-400 text-xs mb-6">
                                Sign in with the Google account for <strong>{invite.email}</strong>.
                            </p>

                            {status === "signing-in" ? (
                                <div className="flex items-center justify-center gap-3 h-11 rounded-xl border border-slate-200 text-sm text-slate-500">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Setting up your account…
                                </div>
                            ) : (
                                <div ref={googleBtnRef} className="w-full flex justify-center" />
                            )}

                            <p className="text-center text-xs text-slate-400 mt-4">
                                You must use the Google account for <strong>{invite.email}</strong>.
                                <br />Invitation expires {new Date(invite.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
