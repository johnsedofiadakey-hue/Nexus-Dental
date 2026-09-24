"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Loader2, XCircle, Building2 } from "lucide-react";
import { toast } from "sonner";

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

// Mirrors validatePasswordStrength() on the server so users get instant feedback.
function passwordProblems(pw: string): string[] {
    const problems: string[] = [];
    if (pw.length < 8) problems.push("at least 8 characters");
    if (!/[A-Z]/.test(pw)) problems.push("an uppercase letter");
    if (!/[a-z]/.test(pw)) problems.push("a lowercase letter");
    if (!/[0-9]/.test(pw)) problems.push("a number");
    if (!/[!@#$%^&*()_+\-=[\]{};':"|,.<>?/]/.test(pw)) problems.push("a special character");
    return problems;
}

function AcceptInviteContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [invite, setInvite] = useState<InviteInfo | null>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "submitting" | "error" | "expired">("loading");
    const [errorMsg, setErrorMsg] = useState("");

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");

    useEffect(() => {
        if (!token) { setStatus("error"); setErrorMsg("No invite token found."); return; }

        fetch(`/api/staff/invite/${encodeURIComponent(token)}`)
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

    const problems = passwordProblems(password);
    const mismatch = confirm.length > 0 && confirm !== password;
    const canSubmit =
        status === "ready" && firstName.trim() && lastName.trim() && problems.length === 0 && confirm === password;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canSubmit || !token) return;
        setStatus("submitting");
        try {
            const res = await fetch(`/api/staff/invite/${encodeURIComponent(token)}/accept`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ firstName, lastName, password }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Welcome to ${data.data.user.clinicName}, ${data.data.user.firstName}!`);
                router.push("/dashboard");
            } else {
                setStatus("ready");
                toast.error(data.error || "Could not create your account. Try again.");
            }
        } catch {
            setStatus("ready");
            toast.error("Network error. Please try again.");
        }
    }

    const inputClass =
        "w-full h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

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
                    {status === "loading" && (
                        <div className="flex flex-col items-center py-8 gap-4">
                            <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                            <p className="text-slate-500 text-sm">Validating your invitation…</p>
                        </div>
                    )}

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

                    {(status === "ready" || status === "submitting") && invite && (
                        <form onSubmit={handleSubmit} noValidate>
                            <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-teal-50 ring-1 ring-teal-100">
                                <div className="w-12 h-12 rounded-xl bg-teal-600 flex items-center justify-center text-white shrink-0">
                                    {invite.clinic.logo
                                        ? <img src={invite.clinic.logo} alt="" className="w-12 h-12 rounded-xl object-cover" />
                                        : <Building2 className="w-6 h-6" />}
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900">{invite.clinic.name}</p>
                                    <p className="text-xs text-teal-700">Invited by {invite.invitedBy}</p>
                                </div>
                            </div>

                            <h1 className="text-2xl font-bold text-slate-900 mb-1">Set up your account</h1>
                            <p className="text-slate-500 text-sm mb-1">
                                You&apos;ve been invited to join as a{" "}
                                <span className="font-semibold text-teal-700">{roleLabel(invite.role)}</span>.
                            </p>
                            <p className="text-slate-400 text-xs mb-5">
                                Signing up as <strong>{invite.email}</strong>. Invitation expires{" "}
                                {new Date(invite.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.
                            </p>

                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <input
                                    className={inputClass}
                                    placeholder="First name"
                                    autoComplete="given-name"
                                    value={firstName}
                                    onChange={e => setFirstName(e.target.value)}
                                />
                                <input
                                    className={inputClass}
                                    placeholder="Last name"
                                    autoComplete="family-name"
                                    value={lastName}
                                    onChange={e => setLastName(e.target.value)}
                                />
                            </div>
                            <input
                                className={`${inputClass} mb-2`}
                                type="password"
                                placeholder="Create a password"
                                autoComplete="new-password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                            {password.length > 0 && problems.length > 0 && (
                                <p className="text-xs text-amber-600 mb-2">Needs {problems.join(", ")}.</p>
                            )}
                            <input
                                className={`${inputClass} mb-1`}
                                type="password"
                                placeholder="Confirm password"
                                autoComplete="new-password"
                                value={confirm}
                                onChange={e => setConfirm(e.target.value)}
                            />
                            {mismatch && <p className="text-xs text-red-600 mb-2">Passwords do not match.</p>}

                            <button
                                type="submit"
                                disabled={!canSubmit}
                                className="mt-4 w-full h-11 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                            >
                                {status === "submitting" ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating your account…</>
                                ) : (
                                    "Create account"
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function AcceptInvitePage() {
    return (
        <Suspense fallback={null}>
            <AcceptInviteContent />
        </Suspense>
    );
}
