"use client";

import { motion } from "framer-motion";
import { Calendar, Video, ArrowRight, Shield, Clock, Award } from "lucide-react";
import Link from "next/link";

export default function HeroSection() {
    return (
        <section className="relative min-h-screen flex items-center overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-teal-50/30" />

            {/* Decorative Elements */}
            <div className="absolute top-20 right-0 w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-accent/5 blur-3xl" />

            {/* Floating Medical Shapes */}
            <div className="absolute top-32 right-20 hidden lg:block">
                <motion.div
                    animate={{ y: [0, -15, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center"
                >
                    <Shield className="h-8 w-8 text-primary" />
                </motion.div>
            </div>
            <div className="absolute bottom-40 right-40 hidden lg:block">
                <motion.div
                    animate={{ y: [0, 12, 0] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                    className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center"
                >
                    <Award className="h-7 w-7 text-accent" />
                </motion.div>
            </div>
            <div className="absolute top-60 left-10 hidden lg:block">
                <motion.div
                    animate={{ y: [0, 10, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center"
                >
                    <Clock className="h-6 w-6 text-success" />
                </motion.div>
            </div>

            <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full pt-32 pb-20">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    {/* Text Content */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                        {/* Badge */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8"
                        >
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            Trusted by 10,000+ Patients
                        </motion.div>

                        <h1 className="font-[family-name:var(--font-heading)] text-4xl sm:text-5xl lg:text-6xl text-secondary leading-tight mb-6">
                            World-Class Dental Care.{" "}
                            <span className="text-primary">Exceptional Smiles.</span>
                        </h1>

                        <p className="text-lg text-text-secondary leading-relaxed mb-10 max-w-lg">
                            Modern, painless dentistry delivered with precision, comfort, and
                            care. Experience the difference of technology-driven dental
                            excellence.
                        </p>

                        {/* CTAs */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Link href="/booking" className="btn-primary no-underline">
                                <Calendar className="h-5 w-5" />
                                Book Appointment
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link href="/consultation" className="btn-secondary no-underline">
                                <Video className="h-5 w-5" />
                                Online Consultation
                            </Link>
                        </div>

                        {/* Trust Metrics */}
                        <div className="grid grid-cols-3 gap-6 mt-14 pt-8 border-t border-border">
                            {[
                                { value: "15+", label: "Years Experience" },
                                { value: "10K+", label: "Happy Patients" },
                                { value: "98%", label: "Success Rate" },
                            ].map((metric, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.6 + i * 0.1 }}
                                >
                                    <p className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl text-secondary">
                                        {metric.value}
                                    </p>
                                    <p className="text-xs sm:text-sm text-text-muted mt-1">
                                        {metric.label}
                                    </p>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Hero Visual */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="relative hidden lg:block"
                    >
                        <div className="relative w-full aspect-[4/5] rounded-3xl overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-dark to-secondary rounded-3xl" />
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-12">
                                <div className="w-32 h-32 rounded-full border-4 border-white/20 flex items-center justify-center mb-8">
                                    <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center">
                                        <span className="text-5xl">🦷</span>
                                    </div>
                                </div>
                                <h3 className="font-[family-name:var(--font-heading)] text-2xl text-center mb-3">
                                    Your Smile Journey
                                </h3>
                                <p className="text-sm text-white/70 text-center max-w-xs">
                                    State-of-the-art equipment, compassionate care, and
                                    a commitment to dental excellence.
                                </p>

                                {/* Floating Cards */}
                                <motion.div
                                    animate={{ y: [0, -8, 0] }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                    className="absolute -left-8 top-1/3 glass rounded-2xl p-4 shadow-hero"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center">
                                            <Shield className="h-5 w-5 text-success" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-secondary">100% Safe</p>
                                            <p className="text-xs text-text-muted">Sterilized Equipment</p>
                                        </div>
                                    </div>
                                </motion.div>

                                <motion.div
                                    animate={{ y: [0, 8, 0] }}
                                    transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                                    className="absolute -right-8 bottom-1/3 glass rounded-2xl p-4 shadow-hero"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                                            <Calendar className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-secondary">Easy Booking</p>
                                            <p className="text-xs text-text-muted">Book in 30 seconds</p>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
