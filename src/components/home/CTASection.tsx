"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { Calendar, ArrowRight, Sparkles } from "lucide-react";

export default function CTASection() {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-100px" });

    return (
        <section className="section-padding" ref={ref}>
            <div className="mx-auto max-w-7xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.7 }}
                    className="relative rounded-3xl overflow-hidden"
                >
                    {/* Background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-dark to-secondary" />

                    {/* Decorative */}
                    <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 blur-2xl" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-accent/10 blur-2xl" />

                    {/* Content */}
                    <div className="relative py-16 sm:py-20 px-8 sm:px-16 text-center">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={isInView ? { opacity: 1, scale: 1 } : {}}
                            transition={{ delay: 0.2, duration: 0.5 }}
                        >
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/90 text-sm font-medium mb-8 border border-white/10">
                                <Sparkles className="h-4 w-4" />
                                Start Your Journey Today
                            </div>

                            <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl lg:text-5xl text-white mb-6 max-w-2xl mx-auto leading-tight">
                                Your Perfect Smile{" "}
                                <span className="text-accent-light">Awaits</span>
                            </h2>

                            <p className="text-lg text-white/70 max-w-lg mx-auto mb-10 leading-relaxed">
                                Take the first step towards the smile you&apos;ve always wanted.
                                Book your appointment today and experience world-class dental care.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <Link
                                    href="/booking"
                                    className="btn-primary text-base px-8 py-4 no-underline"
                                >
                                    <Calendar className="h-5 w-5" />
                                    Book Your Appointment
                                    <ArrowRight className="h-5 w-5" />
                                </Link>
                                <Link
                                    href="/contact"
                                    className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium transition-colors no-underline"
                                >
                                    Or contact us for questions
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>
                        </motion.div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
