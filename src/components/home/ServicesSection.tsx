"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import {
    Stethoscope,
    Sparkles,
    SmilePlus,
    Wrench,
    Baby,
    Siren,
    Video,
    ArrowRight,
} from "lucide-react";

const services = [
    {
        icon: Stethoscope,
        title: "General Dentistry",
        description:
            "Comprehensive check-ups, cleanings, fillings, and preventive care to maintain your oral health and catch problems early.",
        color: "text-primary",
        bg: "bg-primary/10",
        href: "/services#general",
    },
    {
        icon: Sparkles,
        title: "Cosmetic Dentistry",
        description:
            "Transform your smile with teeth whitening, veneers, bonding, and smile makeovers designed for stunning, natural results.",
        color: "text-accent",
        bg: "bg-accent/10",
        href: "/services#cosmetic",
    },
    {
        icon: SmilePlus,
        title: "Orthodontics",
        description:
            "Straighten your teeth with modern braces, clear aligners, and retainers for children and adults of all ages.",
        color: "text-primary",
        bg: "bg-primary/10",
        href: "/services#orthodontics",
    },
    {
        icon: Wrench,
        title: "Restorative & Surgical",
        description:
            "Dental implants, crowns, bridges, root canals, and oral surgery to restore function and aesthetics to damaged teeth.",
        color: "text-secondary",
        bg: "bg-secondary/10",
        href: "/services#restorative",
    },
    {
        icon: Baby,
        title: "Pediatric Dentistry",
        description:
            "Gentle, fun, and specialized dental care for children in a warm, welcoming environment they'll love visiting.",
        color: "text-success",
        bg: "bg-success/10",
        href: "/services#pediatric",
    },
    {
        icon: Siren,
        title: "Emergency Care",
        description:
            "Immediate attention for dental emergencies — toothaches, broken teeth, lost fillings, and urgent dental trauma.",
        color: "text-danger",
        bg: "bg-danger/10",
        href: "/services#emergency",
    },
    {
        icon: Video,
        title: "Online Consultation",
        description:
            "Connect with our dentists from home via secure video. Get professional advice, prescriptions, and referrals conveniently.",
        color: "text-primary",
        bg: "bg-primary/10",
        href: "/consultation",
    },
];

export default function ServicesSection() {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-100px" });

    return (
        <section className="section-padding" ref={ref}>
            <div className="mx-auto max-w-7xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6 }}
                >
                    <h2 className="section-title">Our Services</h2>
                    <p className="section-subtitle">
                        Complete dental care under one roof — from routine check-ups to
                        advanced surgical procedures and virtual consultations.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {services.map((service, i) => {
                        const Icon = service.icon;
                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={isInView ? { opacity: 1, y: 0 } : {}}
                                transition={{ duration: 0.5, delay: i * 0.08 }}
                            >
                                <Link
                                    href={service.href}
                                    className="card-hover group block p-7 rounded-2xl bg-white border border-border-light hover:border-primary/20 no-underline h-full"
                                >
                                    <div
                                        className={`w-12 h-12 ${service.bg} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}
                                    >
                                        <Icon className={`h-6 w-6 ${service.color}`} />
                                    </div>
                                    <h3 className="font-[family-name:var(--font-heading)] text-lg text-secondary mb-2">
                                        {service.title}
                                    </h3>
                                    <p className="text-sm text-text-secondary leading-relaxed mb-4">
                                        {service.description}
                                    </p>
                                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary group-hover:gap-2.5 transition-all">
                                        Learn More
                                        <ArrowRight className="h-4 w-4" />
                                    </span>
                                </Link>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
