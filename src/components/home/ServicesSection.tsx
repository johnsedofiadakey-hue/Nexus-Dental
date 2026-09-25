"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
    ArrowRight,
    Baby,
    Cross,
    ShieldPlus,
    SmilePlus,
    Sparkles,
    Stethoscope,
} from "lucide-react";

const services = [
    {
        icon: Stethoscope,
        title: "General dentistry",
        description: "Check-ups, professional cleaning, fillings, and preventive care for lasting oral health.",
        href: "/services#general",
        tone: "bg-teal-50 text-primary-dark",
    },
    {
        icon: Sparkles,
        title: "Cosmetic dentistry",
        description: "Thoughtful whitening, bonding, veneers, and smile planning designed for natural-looking results.",
        href: "/services#cosmetic",
        tone: "bg-amber-50 text-amber-700",
    },
    {
        icon: SmilePlus,
        title: "Orthodontics",
        description: "Modern alignment options for children and adults, with clear guidance throughout treatment.",
        href: "/services#orthodontics",
        tone: "bg-sky-50 text-sky-700",
    },
    {
        icon: ShieldPlus,
        title: "Restorative care",
        description: "Crowns, bridges, root canal care, implants, and practical solutions that restore comfort and function.",
        href: "/services#restorative",
        tone: "bg-indigo-50 text-indigo-700",
    },
    {
        icon: Baby,
        title: "Children's dentistry",
        description: "Friendly, age-appropriate visits that help younger patients build healthy habits with confidence.",
        href: "/services#pediatric",
        tone: "bg-rose-50 text-rose-600",
    },
    {
        icon: Cross,
        title: "Urgent dental care",
        description: "Prompt assessment for dental pain, trauma, swelling, broken teeth, and other urgent concerns.",
        href: "/services#emergency",
        tone: "bg-red-50 text-red-600",
    },
];

export default function ServicesSection() {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-80px" });

    return (
        <section className="section-padding bg-bg" ref={ref}>
            <div className="mx-auto max-w-7xl">
                <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.55 }}
                    className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
                >
                    <div className="max-w-2xl">
                        <span className="eyebrow">Complete dental care</span>
                        <h2 className="mt-4 font-[family-name:var(--font-heading)] text-4xl leading-tight tracking-[-0.025em] text-secondary sm:text-5xl">
                            Everything your smile needs, in one place.
                        </h2>
                    </div>
                    <Link href="/services" className="inline-flex items-center gap-2 text-sm font-bold text-primary-dark no-underline hover:text-primary">
                        Explore all services
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </motion.div>

                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {services.map((service, index) => (
                        <motion.article
                            key={service.title}
                            initial={{ opacity: 0, y: 20 }}
                            animate={isInView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.45, delay: index * 0.07 }}
                        >
                            <Link
                                href={service.href}
                                className="group flex h-full flex-col rounded-3xl border border-border-light bg-white p-7 no-underline transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[var(--shadow-elevated)]"
                            >
                                <div className={`mb-8 flex h-14 w-14 items-center justify-center rounded-2xl ${service.tone}`}>
                                    <service.icon className="h-7 w-7" />
                                </div>
                                <h3 className="text-2xl text-secondary">{service.title}</h3>
                                <p className="mt-3 flex-1 text-sm leading-7 text-text-secondary">{service.description}</p>
                                <span className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-primary-dark">
                                    Learn more
                                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </span>
                            </Link>
                        </motion.article>
                    ))}
                </div>
            </div>
        </section>
    );
}
