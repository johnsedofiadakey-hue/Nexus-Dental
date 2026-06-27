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
        title: "Trusted by 1,000+ Patients",
        color: "text-primary",
        bg: "bg-primary/10",
    },
    {
        icon: Award,
        title: "5-Star Patient Rated",
        color: "text-accent",
        bg: "bg-accent/10",
    },
    {
        icon: Users,
        title: "Expert Specialists",
        color: "text-primary",
        bg: "bg-primary/10",
    },
    {
        icon: Zap,
        title: "Painless Procedures",
        color: "text-success",
        bg: "bg-success/10",
    },
    {
        icon: HeartPulse,
        title: "Patient-Centered Care",
        color: "text-danger",
        bg: "bg-danger/10",
    },
    {
        icon: Clock,
        title: "Flexible Scheduling",
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
                    {trustReasons.map((reason, i) => {
                        const Icon = reason.icon;
                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={isInView ? { opacity: 1, y: 0 } : {}}
                                transition={{ duration: 0.5, delay: i * 0.08 }}
                                className="flex flex-col items-center text-center group cursor-default"
                            >
                                <div
                                    className={`w-16 h-16 ${reason.bg} rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
                                >
                                    <Icon className={`h-8 w-8 ${reason.color}`} />
                                </div>
                                <h3 className="text-lg font-semibold text-secondary">
                                    {reason.title}
                                </h3>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
