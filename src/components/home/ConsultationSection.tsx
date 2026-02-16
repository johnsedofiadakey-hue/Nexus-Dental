"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { Video, Shield, FileText, ArrowRight, Clock, CheckCircle } from "lucide-react";

const features = [
    {
        icon: Video,
        title: "HD Video Consultations",
        description: "Crystal-clear video calls with our dental specialists from the comfort of your home.",
    },
    {
        icon: Shield,
        title: "HIPAA Compliant",
        description: "End-to-end encrypted sessions ensuring your medical data stays private and secure.",
    },
    {
        icon: FileText,
        title: "Digital Prescriptions",
        description: "Receive prescriptions and treatment plans digitally right after your session.",
    },
    {
        icon: Clock,
        title: "No Wait Times",
        description: "Skip the waiting room. Connect with a dentist at your scheduled time instantly.",
    },
];

export default function ConsultationSection() {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-100px" });

    return (
        <section className="section-padding bg-white" ref={ref}>
            <div className="mx-auto max-w-7xl">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    {/* Visual */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={isInView ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.7 }}
                        className="relative"
                    >
                        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary to-secondary p-10 aspect-square flex items-center justify-center">
                            {/* Decorative Circles */}
                            <div className="absolute top-6 right-6 w-24 h-24 rounded-full border-2 border-white/10" />
                            <div className="absolute bottom-10 left-10 w-32 h-32 rounded-full border-2 border-white/5" />

                            <div className="text-center text-white relative z-10">
                                <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6 border-2 border-white/20">
                                    <Video className="h-12 w-12 text-white" />
                                </div>
                                <h3 className="font-[family-name:var(--font-heading)] text-2xl mb-3">
                                    Virtual Dental Care
                                </h3>
                                <p className="text-white/70 text-sm max-w-xs mx-auto mb-6">
                                    Professional dental consultations from anywhere, anytime.
                                </p>
                                <div className="flex items-center justify-center gap-3">
                                    <div className="flex -space-x-2">
                                        {[1, 2, 3, 4].map((i) => (
                                            <div
                                                key={i}
                                                className="w-8 h-8 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center"
                                            >
                                                <span className="text-xs">👨‍⚕️</span>
                                            </div>
                                        ))}
                                    </div>
                                    <span className="text-sm text-white/80">12 Doctors Online</span>
                                </div>
                            </div>
                        </div>

                        {/* Floating Badge */}
                        <motion.div
                            animate={{ y: [0, -6, 0] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute -bottom-4 -right-4 glass rounded-2xl p-4 shadow-hero"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center">
                                    <CheckCircle className="h-5 w-5 text-success" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-secondary">Instant Access</p>
                                    <p className="text-xs text-text-muted">Connect in minutes</p>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* Content */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        animate={isInView ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.7, delay: 0.2 }}
                    >
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                            <Video className="h-4 w-4" />
                            Telehealth Available
                        </span>

                        <h2 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl text-secondary mb-4">
                            Expert Dental Advice From{" "}
                            <span className="text-primary">Anywhere</span>
                        </h2>

                        <p className="text-text-secondary leading-relaxed mb-8">
                            Can&apos;t make it to the clinic? No problem. Our online consultation
                            service connects you with qualified dental professionals via secure,
                            HD video calls. Get diagnoses, treatment plans, prescriptions, and
                            referrals — all from the comfort of your home.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                            {features.map((feature, i) => {
                                const Icon = feature.icon;
                                return (
                                    <div
                                        key={i}
                                        className="flex items-start gap-3 p-4 rounded-xl bg-bg"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <Icon className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-secondary mb-1">
                                                {feature.title}
                                            </h4>
                                            <p className="text-xs text-text-muted leading-relaxed">
                                                {feature.description}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <Link href="/consultation" className="btn-primary no-underline">
                            Start Virtual Consultation
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
