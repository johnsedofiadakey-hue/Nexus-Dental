"use client";

import { motion } from "framer-motion";
import { Calendar, ArrowRight, CheckCircle2, Star, Shield } from "lucide-react";
import Link from "next/link";

export default function HeroSection() {
    return (
        <section className="relative bg-white">
            {/* Clean, minimal background */}
            <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full py-20 lg:py-32">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                    {/* Text Content - Left Side */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="flex flex-col justify-center"
                    >
                        {/* Eyebrow Text */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1, duration: 0.5 }}
                            className="text-sm font-semibold uppercase tracking-wider text-primary mb-4"
                        >
                            First Impression 🦷
                        </motion.div>

                        {/* Main Headline */}
                        <motion.h1
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.6 }}
                            className="font-[family-name:var(--font-heading)] text-5xl sm:text-6xl lg:text-7xl text-secondary leading-tight mb-6"
                        >
                            Healthy Smiles <br /> Start Here
                        </motion.h1>

                        {/* Subheading */}
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3, duration: 0.6 }}
                            className="text-lg lg:text-xl text-text-secondary leading-relaxed mb-10 max-w-xl"
                        >
                            Modern care, advanced technology, and a gentle approach — all in one place. Experience dentistry that builds trust instantly.
                        </motion.p>

                        {/* CTAs */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4, duration: 0.6 }}
                            className="flex flex-col sm:flex-row gap-4 mb-12"
                        >
                            <Link href="/booking" className="btn-primary no-underline inline-flex items-center justify-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Book Appointment
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link href="/consultation" className="btn-secondary no-underline inline-flex items-center justify-center gap-2">
                                Watch Our Video
                            </Link>
                        </motion.div>

                        {/* Trust Indicators - Horizontal Row */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5, duration: 0.6 }}
                            className="flex flex-col sm:flex-row gap-8 pt-8 border-t border-slate-200"
                        >
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-secondary">Trusted by 1,000+ Patients</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Star className="h-5 w-5 text-accent flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-secondary">5-Star Patient Rated</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Shield className="h-5 w-5 text-primary flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-secondary">We Accept Insurance</p>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* Hero Image/Visual - Right Side */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="relative hidden lg:block"
                    >
                        {/* Placeholder for Dental Chair Image */}
                        {/* In production, replace with: <Image src="/images/dental-chair.jpg" alt="Modern dental setup" ... /> */}
                        <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                            {/* Minimalist Placeholder */}
                            <div className="flex flex-col items-center justify-center text-center p-8">
                                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                                    <span className="text-6xl">🦷</span>
                                </div>
                                <p className="text-text-secondary text-sm">
                                    Modern dental chair imagery will display here
                                </p>
                            </div>

                            {/* Feature Cards - Floating */}
                            <motion.div
                                animate={{ y: [0, -6, 0] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute bottom-8 left-8 bg-white rounded-xl p-4 shadow-md border border-slate-200"
                            >
                                <p className="text-xs font-semibold text-secondary">Modern UI</p>
                                <p className="text-xs text-text-muted mt-1">Clean and intuitive</p>
                            </motion.div>

                            <motion.div
                                animate={{ y: [0, 6, 0] }}
                                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                                className="absolute top-8 right-8 bg-white rounded-xl p-4 shadow-md border border-slate-200"
                            >
                                <p className="text-xs font-semibold text-secondary">Booking Ready</p>
                                <p className="text-xs text-text-muted mt-1">Appointments made simple</p>
                            </motion.div>

                            <motion.div
                                animate={{ y: [0, -5, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                                className="absolute top-1/2 -right-4 bg-white rounded-xl p-4 shadow-md border border-slate-200"
                            >
                                <p className="text-xs font-semibold text-secondary">Trust Focused</p>
                                <p className="text-xs text-text-muted mt-1">Your confidence matters</p>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
