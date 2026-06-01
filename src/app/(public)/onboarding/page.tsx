"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Building2, User, Lock, ChevronRight, ChevronLeft,
    CheckCircle2, Loader2, Eye, EyeOff, Check, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STEPS = [
    { id: 1, label: "Clinic Info",   icon: Building2 },
    { id: 2, label: "Owner Account", icon: User },
    { id: 3, label: "Secure",        icon: Lock },
];

function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function PasswordStrength({ password }: { password: string }) {
    const checks = [
        { label: "8+ characters", pass: password.length >= 8 },
        { label: "Uppercase letter", pass: /[A-Z]/.test(password) },
        { label: "Number", pass: /[0-9]/.test(password) },
    ];
    const score = checks.filter(c => c.pass).length;
    const colors = ["bg-red-400", "bg-amber-400", "bg-yellow-400", "bg-emerald-500"];
    return (
        <div className="mt-2 space-y-2">
            <div className="flex gap-1">
                {[0,1,2].map(i => (
                    <div key={i} className={cn("h-1 flex-1 rounded-full transition-colors",
                        i < score ? colors[score] : "bg-slate-200")} />
                ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
                {checks.map(c => (
                    <span key={c.label} className={cn("flex items-center gap-1 text-xs",
                        c.pass ? "text-emerald-600" : "text-slate-400")}>
                        {c.pass ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {c.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

interface SlugFieldProps {
    value: string;
    onChange: (v: string) => void;
    onAvailable: (ok: boolean) => void;
}

function SlugField({ value, onChange, onAvailable }: SlugFieldProps) {
    const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!value) { setStatus("idle"); return; }
        setStatus("checking");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/onboarding?slug=${value}`);
                const json = await res.json();
                const avail = json.data?.available === true;
                setStatus(avail ? "available" : "taken");
                onAvailable(avail);
            } catch {
                setStatus("idle");
            }
        }, 500);
    }, [value, onAvailable]);

    return (
        <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Clinic URL Slug</label>
            <div className="flex items-center rounded-md border border-input bg-background overflow-hidden">
                <span className="px-3 py-2 text-sm text-slate-400 border-r border-input bg-slate-50 whitespace-nowrap">
                    nexusdental.app/
                </span>
                <input
                    className="flex-1 px-3 py-2 text-sm outline-none bg-transparent"
                    placeholder="my-clinic"
                    value={value}
                    onChange={e => onChange(slugify(e.target.value))}
                />
                <span className="px-3">
                    {status === "checking" && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
                    {status === "available" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {status === "taken" && <X className="w-4 h-4 text-red-500" />}
                </span>
            </div>
            {status === "taken" && <p className="text-xs text-red-500 mt-1">This slug is already taken.</p>}
            {status === "available" && <p className="text-xs text-emerald-600 mt-1">Great, this URL is available!</p>}
            <p className="text-xs text-slate-400 mt-1">Only lowercase letters, numbers, and hyphens.</p>
        </div>
    );
}

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [slugAvailable, setSlugAvailable] = useState(false);

    const [form, setForm] = useState({
        clinicName: "",
        slug: "",
        email: "",
        phone: "",
        address: "",
        timezone: "Africa/Accra",
        ownerFirstName: "",
        ownerLastName: "",
        ownerEmail: "",
        ownerPhone: "",
        password: "",
        confirmPassword: "",
    });

    const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

    // Auto-derive slug from clinic name
    useEffect(() => {
        if (!form.slug || form.slug === slugify(form.clinicName.slice(0, -1))) {
            set("slug", slugify(form.clinicName));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.clinicName]);

    const canProceedStep1 = form.clinicName.length >= 2 && form.slug.length >= 2 && slugAvailable;
    const canProceedStep2 = form.ownerFirstName && form.ownerLastName && form.ownerEmail;
    const canProceedStep3 = form.password.length >= 8 && form.password === form.confirmPassword;

    async function handleSubmit() {
        setSubmitting(true);
        setError("");
        try {
            const res = await fetch("/api/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    clinicName: form.clinicName,
                    slug: form.slug,
                    email: form.email || undefined,
                    phone: form.phone || undefined,
                    address: form.address || undefined,
                    timezone: form.timezone,
                    ownerFirstName: form.ownerFirstName,
                    ownerLastName: form.ownerLastName,
                    ownerEmail: form.ownerEmail,
                    ownerPhone: form.ownerPhone || undefined,
                    password: form.password,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error || "Something went wrong. Please try again.");
                setSubmitting(false);
                return;
            }
            // Success — redirect to dashboard
            router.push("/dashboard");
        } catch {
            setError("Network error. Please check your connection.");
            setSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-slate-50 flex flex-col">
            {/* Header */}
            <div className="flex h-16 items-center px-8">
                <Link href="/" className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-xs">ND</div>
                    <span className="font-bold text-slate-900">Nexus Dental</span>
                </Link>
                <div className="ml-auto text-sm text-slate-500">
                    Already have an account?{" "}
                    <Link href="/auth/staff" className="text-teal-600 font-medium hover:underline">Sign in</Link>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-lg">
                    {/* Step indicator */}
                    <div className="flex items-center justify-center gap-0 mb-10">
                        {STEPS.map((s, i) => {
                            const Icon = s.icon;
                            const done = step > s.id;
                            const active = step === s.id;
                            return (
                                <div key={s.id} className="flex items-center">
                                    <div className="flex flex-col items-center gap-1">
                                        <div className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                            done  ? "bg-teal-600 text-white" :
                                            active ? "bg-teal-600 text-white ring-4 ring-teal-100" :
                                                    "bg-slate-100 text-slate-400"
                                        )}>
                                            {done ? <Check className="w-5 h-5" /> : <Icon className="w-4.5 h-4.5" />}
                                        </div>
                                        <span className={cn("text-xs font-medium hidden sm:block",
                                            active ? "text-teal-700" : done ? "text-teal-600" : "text-slate-400")}>
                                            {s.label}
                                        </span>
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div className={cn("w-16 sm:w-24 h-0.5 mx-2 mb-4",
                                            step > s.id ? "bg-teal-400" : "bg-slate-200")} />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Card */}
                    <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-100 p-8">

                        {/* Step 1 — Clinic Info */}
                        {step === 1 && (
                            <div className="space-y-5">
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-900">Set up your clinic</h1>
                                    <p className="text-slate-500 mt-1">Tell us about your dental practice.</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-1 block">Clinic Name <span className="text-red-500">*</span></label>
                                    <Input placeholder="e.g. Bright Smiles Dental" value={form.clinicName}
                                        onChange={e => set("clinicName", e.target.value)} />
                                </div>
                                <SlugField value={form.slug} onChange={v => set("slug", v)} onAvailable={setSlugAvailable} />
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-1 block">Clinic Email</label>
                                    <Input type="email" placeholder="clinic@example.com" value={form.email}
                                        onChange={e => set("email", e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 mb-1 block">Phone</label>
                                        <Input placeholder="+233 XX XXX XXXX" value={form.phone}
                                            onChange={e => set("phone", e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 mb-1 block">Timezone</label>
                                        <select value={form.timezone} onChange={e => set("timezone", e.target.value)}
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                            <option value="Africa/Accra">Africa/Accra (GMT+0)</option>
                                            <option value="Africa/Lagos">Africa/Lagos (GMT+1)</option>
                                            <option value="Africa/Nairobi">Africa/Nairobi (GMT+3)</option>
                                            <option value="UTC">UTC</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-1 block">Address</label>
                                    <Input placeholder="123 Main Street, Accra" value={form.address}
                                        onChange={e => set("address", e.target.value)} />
                                </div>
                                <Button className="w-full bg-teal-600 hover:bg-teal-700 mt-2"
                                    disabled={!canProceedStep1}
                                    onClick={() => setStep(2)}>
                                    Continue <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            </div>
                        )}

                        {/* Step 2 — Owner Account */}
                        {step === 2 && (
                            <div className="space-y-5">
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-900">Your account</h1>
                                    <p className="text-slate-500 mt-1">You'll be the clinic owner and admin.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 mb-1 block">First Name <span className="text-red-500">*</span></label>
                                        <Input placeholder="John" value={form.ownerFirstName}
                                            onChange={e => set("ownerFirstName", e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 mb-1 block">Last Name <span className="text-red-500">*</span></label>
                                        <Input placeholder="Mensah" value={form.ownerLastName}
                                            onChange={e => set("ownerLastName", e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-1 block">Email Address <span className="text-red-500">*</span></label>
                                    <Input type="email" placeholder="john@brightsmiles.com" value={form.ownerEmail}
                                        onChange={e => set("ownerEmail", e.target.value)} />
                                    <p className="text-xs text-slate-400 mt-1">You'll use this to log in.</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-1 block">Phone (optional)</label>
                                    <Input placeholder="+233 XX XXX XXXX" value={form.ownerPhone}
                                        onChange={e => set("ownerPhone", e.target.value)} />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button variant="outline" onClick={() => setStep(1)}>
                                        <ChevronLeft className="w-4 h-4 mr-1" /> Back
                                    </Button>
                                    <Button className="flex-1 bg-teal-600 hover:bg-teal-700"
                                        disabled={!canProceedStep2}
                                        onClick={() => setStep(3)}>
                                        Continue <ChevronRight className="w-4 h-4 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Step 3 — Password */}
                        {step === 3 && (
                            <div className="space-y-5">
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-900">Secure your account</h1>
                                    <p className="text-slate-500 mt-1">Choose a strong password for your clinic owner account.</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-1 block">Password <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <Input type={showPass ? "text" : "password"} placeholder="Min. 8 characters"
                                            value={form.password} onChange={e => set("password", e.target.value)} />
                                        <button type="button" onClick={() => setShowPass(!showPass)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    {form.password && <PasswordStrength password={form.password} />}
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-1 block">Confirm Password <span className="text-red-500">*</span></label>
                                    <Input type="password" placeholder="Repeat password"
                                        value={form.confirmPassword} onChange={e => set("confirmPassword", e.target.value)} />
                                    {form.confirmPassword && form.password !== form.confirmPassword && (
                                        <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
                                    )}
                                </div>

                                {/* Summary */}
                                <div className="rounded-xl bg-slate-50 p-4 text-sm space-y-2">
                                    <p className="font-semibold text-slate-700">Summary</p>
                                    <div className="flex justify-between text-slate-500">
                                        <span>Clinic</span>
                                        <span className="font-medium text-slate-900">{form.clinicName}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-500">
                                        <span>URL</span>
                                        <span className="font-medium text-slate-900">/{form.slug}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-500">
                                        <span>Owner</span>
                                        <span className="font-medium text-slate-900">{form.ownerFirstName} {form.ownerLastName}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-500">
                                        <span>Login email</span>
                                        <span className="font-medium text-slate-900">{form.ownerEmail}</span>
                                    </div>
                                </div>

                                {error && (
                                    <div className="p-3 rounded-lg bg-red-50 text-sm text-red-700">{error}</div>
                                )}

                                <div className="flex gap-3 pt-2">
                                    <Button variant="outline" onClick={() => setStep(2)} disabled={submitting}>
                                        <ChevronLeft className="w-4 h-4 mr-1" /> Back
                                    </Button>
                                    <Button className="flex-1 bg-teal-600 hover:bg-teal-700"
                                        disabled={!canProceedStep3 || submitting}
                                        onClick={handleSubmit}>
                                        {submitting
                                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Setting up…</>
                                            : <><CheckCircle2 className="w-4 h-4 mr-2" /> Launch My Clinic</>}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <p className="text-center text-xs text-slate-400 mt-6">
                        By signing up you agree to our Terms of Service and Privacy Policy.
                    </p>
                </div>
            </div>
        </div>
    );
}
