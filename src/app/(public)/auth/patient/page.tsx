"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Phone, ArrowRight, MessageSquare, Mail, Github, Chrome } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function PatientLoginPage() {
    const [step, setStep] = useState<"PHONE" | "OTP">("PHONE");
    const [loading, setLoading] = useState(false);
    const [phone, setPhone] = useState("");
    const [otpValues, setOtpValues] = useState(["", "", "", "", "", ""]);
    const [tenantId, setTenantId] = useState("airport-hills-dental"); // Default for simulation

    const handleSendOTP = async () => {
        if (!phone) {
            toast.error("Please enter your phone number");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch("/api/auth/patient/otp/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone, tenantId }),
            });

            const data = await response.json();

            if (data.success) {
                setStep("OTP");
                toast.success("Verification code sent to your mobile");

                // In development, show the OTP directly for simulation
                if (data.data?.otp) {
                    toast.info(`[DEV MODE] Verification Code: ${data.data.otp}`, {
                        duration: 10000,
                    });
                }
            } else {
                toast.error(data.error || "Failed to send verification code");
            }
        } catch (error) {
            toast.error("An error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        const otp = otpValues.join("");
        if (otp.length !== 6) {
            toast.error("Please enter the 6-digit code");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch("/api/auth/patient/otp/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone, tenantId, otp }),
            });

            const data = await response.json();

            if (data.success) {
                toast.success("Login successful!");
                // Clear state
                setOtpValues(["", "", "", "", "", ""]);
                // Redirect to portal
                window.location.href = "/portal";
            } else {
                toast.error(data.error || "Invalid verification code");
            }
        } catch (error) {
            toast.error("An error occurred during verification.");
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;

        const newValues = [...otpValues];
        newValues[index] = value.slice(-1);
        setOtpValues(newValues);

        // Auto-focus next input
        if (value && index < 5) {
            const nextInput = document.getElementById(`otp-${index + 1}`);
            nextInput?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !otpValues[index] && index > 0) {
            const prevInput = document.getElementById(`otp-${index - 1}`);
            prevInput?.focus();
        }
    };


    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md space-y-8">
                {/* Branding */}
                <div className="text-center space-y-2">
                    <Link href="/" className="inline-flex items-center gap-2 no-underline mb-4">
                        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                            <span className="text-white font-bold text-xl">N</span>
                        </div>
                        <span className="text-2xl font-heading text-secondary font-bold tracking-tight">Nexus Dental</span>
                    </Link>
                    <h1 className="text-3xl font-heading text-secondary">Patient Portal</h1>
                    <p className="text-text-secondary">Access your records, appointments, and prescriptions securely.</p>
                </div>

                {/* Auth Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-bg p-8 rounded-[2rem] border border-border shadow-soft"
                >
                    {step === "PHONE" ? (
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-text-secondary ml-1">Clinic ID (Tenant)</label>
                                    <Input
                                        value={tenantId}
                                        onChange={(e) => setTenantId(e.target.value)}
                                        placeholder="airport-hills-dental"
                                        className="h-14 rounded-2xl bg-white border-none shadow-sm focus-visible:ring-primary"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-text-secondary ml-1">Phone Number</label>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                                        <Input
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="+233 XX XXX XXXX"
                                            className="pl-12 h-14 rounded-2xl bg-white border-none shadow-sm focus-visible:ring-primary"
                                        />
                                    </div>
                                </div>
                            </div>


                            <Button
                                onClick={handleSendOTP}
                                className="w-full h-14 rounded-2xl text-lg font-semibold group"
                                disabled={loading}
                            >
                                {loading ? "Sending Code..." : "Continue"}
                                {!loading && <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />}
                            </Button>

                            <div className="relative py-4">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-slate-200" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-bg px-4 text-text-muted font-bold tracking-widest">Or social login</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Button variant="outline" className="h-14 rounded-2xl bg-white border-none shadow-sm hover:bg-slate-50 transition-all">
                                    <Chrome className="mr-2 h-5 w-5 text-red-500" /> Google
                                </Button>
                                <Button variant="outline" className="h-14 rounded-2xl bg-white border-none shadow-sm hover:bg-slate-50 transition-all">
                                    <Github className="mr-2 h-5 w-5" /> Apple
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 text-center">
                            <div>
                                <p className="text-sm text-text-secondary mb-4">We sent a 6-digit code to your phone. Please enter it below.</p>
                                <div className="flex gap-2 justify-center">
                                    {otpValues.map((val, i) => (
                                        <input
                                            key={i}
                                            id={`otp-${i}`}
                                            type="text"
                                            maxLength={1}
                                            value={val}
                                            onChange={(e) => handleOtpChange(i, e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(i, e)}
                                            className="w-12 h-14 rounded-xl border-none shadow-sm text-center text-xl font-bold text-secondary focus:ring-2 focus:ring-primary"
                                        />
                                    ))}
                                </div>
                            </div>
                            <Button
                                onClick={handleVerifyOTP}
                                className="w-full h-14 rounded-2xl text-lg font-semibold"
                                disabled={loading}
                            >
                                {loading ? "Verifying..." : "Verify & Sign In"}
                            </Button>

                            <button
                                onClick={() => setStep("PHONE")}
                                className="text-sm font-medium text-primary hover:underline"
                            >
                                Didn&apos;t receive code? Resend
                            </button>
                        </div>
                    )}
                </motion.div>

                {/* Footer info */}
                <p className="text-center text-xs text-text-muted leading-relaxed max-w-[300px] mx-auto">
                    By continuing, you agree to our <Link href="/terms" className="text-secondary font-semibold hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-secondary font-semibold hover:underline">Privacy Policy</Link>.
                </p>
            </div>
        </div>
    );
}
