"use client";

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import {
    Shield,
    Users,
    Zap,
    Award,
    HeartPulse,
    Clock,
} from "lucide-react";

const trustReasons = [
    {
        icon: Shield,
        title: "Advanced Sterilization",
        description:
            "Hospital-grade sterilization protocols ensure the highest standards of hygiene and patient safety in every procedure.",
        color: "text-primary",
        bg: "bg-primary/10",
    },
    {
        icon: Users,
        title: "Expert Specialists",
        description:
            "Our team of board-certified dentists brings decades of combined experience across all dental specialties.",
        color: "text-accent",
        bg: "bg-accent/10",
    },
    {
        icon: Zap,
        title: "Painless Procedures",
        description:
            "Cutting-edge laser technology and sedation options make every treatment comfortable and anxiety-free.",
        color: "text-success",
        bg: "bg-success/10",
    },
    {
        icon: Award,
        title: "Award-Winning Care",
        description:
            "Recognized for excellence in patient care, clinical outcomes, and innovative treatment approaches.",
        color: "text-primary",
        bg: "bg-primary/10",
    },
    {
        icon: HeartPulse,
        title: "Patient-Centered",
        description:
            "Every treatment plan is personalized to your unique needs, preferences, and comfort level.",
        color: "text-danger",
        bg: "bg-danger/10",
    },
    {
        icon: Clock,
        title: "Flexible Scheduling",
        description:
            "Extended hours, same-day appointments, and online booking make dental care fit your busy lifestyle.",
        color: "text-warning",
        bg: "bg-warning/10",
    },
];

export default function TrustSection() {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-100px" });

    return (
        <section className="section-padding bg-white" ref={ref}>
            <div className="mx-auto max-w-7xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6 }}
                >
                    <h2 className="section-title">Why Patients Trust Us</h2>
                    <p className="section-subtitle">
                        Delivering exceptional dental experiences through innovation,
                        expertise, and genuine care for every patient.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {trustReasons.map((reason, i) => {
                        const Icon = reason.icon;
                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={isInView ? { opacity: 1, y: 0 } : {}}
                                transition={{ duration: 0.5, delay: i * 0.1 }}
                                className="card-hover group relative p-8 rounded-2xl bg-bg border border-border-light hover:border-primary/20 cursor-default"
                            >
                                <div
                                    className={`w-14 h-14 ${reason.bg} rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}
                                >
                                    <Icon className={`h-7 w-7 ${reason.color}`} />
                                </div>
                                <h3 className="font-[family-name:var(--font-heading)] text-xl text-secondary mb-3">
                                    {reason.title}
                                </h3>
                                <p className="text-sm text-text-secondary leading-relaxed">
                                    {reason.description}
                                </p>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
