"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ArrowRight, ChevronLeft, Stethoscope } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function PatientLoginPage() {
    const router = useRouter();
    const [step, setStep] = useState<"PHONE" | "OTP">("PHONE");
    const [loading, setLoading] = useState(false);
    const [phone, setPhone] = useState("");
    const [otpValues, setOtpValues] = useState(["", "", "", "", "", ""]);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const handleSendOTP = async () => {
        if (!phone.trim()) { toast.error("Enter your phone number."); return; }

        let formattedPhone = phone.trim();
        if (formattedPhone.startsWith("0")) formattedPhone = formattedPhone.substring(1);
        if (!formattedPhone.startsWith("+233")) formattedPhone = `+233${formattedPhone}`;

        setLoading(true);
        try {
            const res = await fetch("/api/auth/patient/otp/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: formattedPhone }),
            });
            const data = await res.json();
            if (data.success) {
                setStep("OTP");
                toast.success("Verification code sent to your phone.");
            } else {
                toast.error(data.error || "Failed to send code.");
            }
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        const otp = otpValues.join("");
        if (otp.length !== 6) { toast.error("Enter the 6-digit code."); return; }

        let formattedPhone = phone.trim();
        if (formattedPhone.startsWith("0")) formattedPhone = formattedPhone.substring(1);
        if (!formattedPhone.startsWith("+233")) formattedPhone = `+233${formattedPhone}`;

        setLoading(true);
        try {
            const res = await fetch("/api/auth/patient/otp/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: formattedPhone, otp }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Welcome back, ${data.data.patient.firstName}!`);
                router.push("/portal");
            } else {
                toast.error(data.error || "Invalid code.");
                setOtpValues(["", "", "", "", "", ""]);
                inputRefs.current[0]?.focus();
            }
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;
        const next = [...otpValues];
        next[index] = value.slice(-1);
        setOtpValues(next);
        if (value && index < 5) inputRefs.current[index + 1]?.focus();
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !otpValues[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (pasted.length === 6) {
            setOtpValues(pasted.split(""));
            inputRefs.current[5]?.focus();
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-slate-50 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md space-y-8">
                {/* Branding */}
                <div className="text-center space-y-2">
                    <Link href="/" className="inline-flex items-center gap-2 no-underline mb-4">
                        <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
                            <Stethoscope className="text-white h-5 w-5" />
                        </div>
                        <span className="text-2xl font-bold text-slate-900 tracking-tight">Nexus Dental</span>
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900">Patient Portal</h1>
                    <p className="text-slate-500 text-sm">
                        {step === "PHONE"
                            ? "Enter your phone number to access your records and appointments."
                            : "Enter the 6-digit code sent to your phone."}
                    </p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-8 rounded-3xl shadow-xl ring-1 ring-slate-100"
                >
                    <AnimatePresence mode="wait">
                        {step === "PHONE" ? (
                            <motion.div
                                key="phone"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-5"
                            >
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        Phone Number
                                    </label>
                                    <div className="relative flex items-center">
                                        <div className="absolute left-4 z-10 flex items-center gap-2">
                                            <span className="text-lg">🇬🇭</span>
                                            <span className="text-sm font-semibold text-slate-600">+233</span>
                                            <div className="h-4 w-[1px] bg-slate-300 mx-1"></div>
                                        </div>
                                        <Input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
                                            placeholder="24 000 0000"
                                            className="pl-[100px] h-14 rounded-2xl bg-slate-50 border-none shadow-inner focus-visible:ring-teal-500 text-lg tracking-wide"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 ml-1">
                                        Use the number you registered with. We'll send a verification code via SMS.
                                    </p>
                                </div>

                                <Button
                                    onClick={handleSendOTP}
                                    disabled={loading}
                                    className="w-full h-14 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-base font-semibold group transition-all"
                                >
                                    {loading ? "Sending code…" : "Send Verification Code"}
                                    {!loading && <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />}
                                </Button>

                                <div className="text-center pt-2">
                                    <p className="text-sm text-slate-500">
                                        New patient?{" "}
                                        <Link href="/booking" className="text-teal-600 font-semibold hover:underline">
                                            Book an appointment
                                        </Link>
                                    </p>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="otp"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <button
                                    onClick={() => { setStep("PHONE"); setOtpValues(["", "", "", "", "", ""]); }}
                                    className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" /> Back
                                </button>

                                <div className="text-center space-y-1">
                                    <p className="font-semibold text-slate-900">Enter the 6-digit code</p>
                                    <p className="text-sm text-slate-500">Sent to <span className="font-medium text-slate-700">{phone}</span></p>
                                </div>

                                <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                                    {otpValues.map((val, i) => (
                                        <input
                                            key={i}
                                            ref={(el) => { inputRefs.current[i] = el; }}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={val}
                                            onChange={(e) => handleOtpChange(i, e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(i, e)}
                                            className="w-12 h-14 rounded-xl border border-slate-200 bg-slate-50 text-center text-2xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                                        />
                                    ))}
                                </div>

                                <Button
                                    onClick={handleVerifyOTP}
                                    disabled={loading}
                                    className="w-full h-14 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-base font-semibold transition-all"
                                >
                                    {loading ? "Verifying…" : "Sign In"}
                                </Button>

                                <div className="text-center">
                                    <button
                                        onClick={handleSendOTP}
                                        disabled={loading}
                                        className="text-sm text-teal-600 hover:underline font-medium disabled:opacity-50"
                                    >
                                        Didn&apos;t receive it? Resend code
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                <p className="text-center text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                    Secure Patient Access • Your data is protected
                </p>
            </div>
        </div>
    );
}
