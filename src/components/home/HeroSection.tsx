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

                    {/* Hero Visual - Right Side */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="relative hidden lg:block"
                    >
                        <div className="relative w-full aspect-square rounded-3xl overflow-hidden bg-gradient-to-br from-cyan-400 via-teal-500 to-teal-700 shadow-2xl border border-teal-400/30">
                            {/* Dental Chair Illustration Area */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                {/* Animated Background Circles */}
                            <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 6, repeat: Infinity }}
                                className="absolute inset-0 opacity-20"
                            >
                                <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-white/30 blur-3xl" />
                                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-white/20 blur-3xl" />
                            </motion.div>

                                {/* Main Visual - Dental Chair Representation */}
                                <div className="relative flex flex-col items-center justify-center z-10 h-full">
                                    {/* Premium Circular Design */}
                                    <div className="mb-12 relative">
                                        {/* Outer Ring */}
                                        <div className="absolute inset-0 w-56 h-56 rounded-full border-2 border-white/40 blur-sm" />

                                        {/* Middle Ring */}
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                            className="absolute inset-0 w-56 h-56 rounded-full border border-white/20"
                                        />

                                        {/* Inner Circle with Tooth */}
                                        <div className="relative w-56 h-56 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/30">
                                            <span className="text-8xl drop-shadow-lg">🦷</span>
                                        </div>
                                    </div>

                                    {/* Text Content */}
                                    <h3 className="font-[family-name:var(--font-heading)] text-3xl text-white text-center mb-4 font-bold drop-shadow-lg">
                                        Modern Dental Care
                                    </h3>
                                    <p className="text-white/90 text-base text-center max-w-sm leading-relaxed drop-shadow">
                                        Advanced technology meets compassionate care
                                    </p>
                                </div>
                            </div>

                            {/* Feature Cards - Floating with Enhanced Styling */}
                            <motion.div
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute -left-8 top-16 bg-white rounded-2xl p-6 shadow-2xl border border-white/80 z-20 backdrop-blur-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <svg className="w-7 h-7 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-secondary">Modern UI</p>
                                        <p className="text-xs text-text-muted">Clean & intuitive</p>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                animate={{ y: [0, 10, 0] }}
                                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
                                className="absolute -right-8 top-1/3 bg-white rounded-2xl p-6 shadow-2xl border border-white/80 z-20 backdrop-blur-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-gradient-to-br from-amber-100 to-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <svg className="w-7 h-7 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-secondary">Booking Ready</p>
                                        <p className="text-xs text-text-muted">Simple & fast</p>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                animate={{ y: [0, -8, 0] }}
                                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.4 }}
                                className="absolute -bottom-10 right-8 bg-white rounded-2xl p-6 shadow-2xl border border-white/80 z-20 backdrop-blur-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-gradient-to-br from-rose-100 to-rose-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <svg className="w-7 h-7 text-rose-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-secondary">Trust Focused</p>
                                        <p className="text-xs text-text-muted">Your care matters</p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
