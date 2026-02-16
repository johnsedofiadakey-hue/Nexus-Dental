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
    Calendar,
    ArrowRight,
    CheckCircle,
} from "lucide-react";

const services = [
    {
        id: "general",
        icon: Stethoscope,
        title: "General Dentistry",
        tagline: "Foundation of Your Oral Health",
        description:
            "Our general dentistry services focus on the comprehensive care and maintenance of your oral health. We provide thorough examinations, professional cleanings, digital X-rays, and preventive treatments designed to catch problems before they become serious.",
        features: [
            "Comprehensive oral examinations",
            "Professional teeth cleaning & scaling",
            "Digital X-rays & diagnostics",
            "Dental fillings & sealants",
            "Gum disease prevention & treatment",
            "Oral cancer screening",
            "Fluoride treatments",
            "Night guards & mouth guards",
        ],
        color: "text-primary",
        bg: "bg-primary/10",
        gradient: "from-primary/5 to-transparent",
    },
    {
        id: "cosmetic",
        icon: Sparkles,
        title: "Cosmetic Dentistry",
        tagline: "Reveal Your Most Confident Smile",
        description:
            "Transform your smile with our advanced cosmetic dental procedures. From subtle enhancements to dramatic smile makeovers, our cosmetic specialists use the latest techniques and materials to create natural, stunning results.",
        features: [
            "Professional teeth whitening",
            "Porcelain & composite veneers",
            "Dental bonding",
            "Smile design & makeovers",
            "Gum contouring",
            "Tooth reshaping & recontouring",
            "Custom inlays & onlays",
            "Digital smile preview",
        ],
        color: "text-accent",
        bg: "bg-accent/10",
        gradient: "from-accent/5 to-transparent",
    },
    {
        id: "orthodontics",
        icon: SmilePlus,
        title: "Orthodontics",
        tagline: "Perfectly Aligned, Naturally Beautiful",
        description:
            "Achieve a perfectly aligned smile with our modern orthodontic solutions. We offer a range of treatment options for children, teens, and adults — from traditional braces to virtually invisible aligners.",
        features: [
            "Traditional metal braces",
            "Clear ceramic braces",
            "Invisalign clear aligners",
            "Lingual (hidden) braces",
            "Retainers & maintenance",
            "Early interceptive treatment",
            "Adult orthodontics",
            "3D treatment planning & monitoring",
        ],
        color: "text-primary",
        bg: "bg-primary/10",
        gradient: "from-primary/5 to-transparent",
    },
    {
        id: "restorative",
        icon: Wrench,
        title: "Restorative & Surgical",
        tagline: "Rebuild, Restore, Renew",
        description:
            "Our restorative and surgical services bring back the function, strength, and beauty of damaged or missing teeth. Using advanced technology and biocompatible materials, we provide lasting solutions.",
        features: [
            "Dental implants (single & full-arch)",
            "Crowns & bridges",
            "Root canal therapy",
            "Wisdom teeth extraction",
            "Dentures & partial dentures",
            "Bone grafting",
            "Oral surgery",
            "TMJ/TMD treatment",
        ],
        color: "text-secondary",
        bg: "bg-secondary/10",
        gradient: "from-secondary/5 to-transparent",
    },
    {
        id: "pediatric",
        icon: Baby,
        title: "Pediatric Dentistry",
        tagline: "Gentle Care for Little Smiles",
        description:
            "We create a fun, warm, and comfortable environment for children of all ages. Our pediatric specialists are trained to make dental visits enjoyable, building lifelong habits of great oral health.",
        features: [
            "First dental visit guidance",
            "Child-friendly examinations",
            "Preventive sealants",
            "Fluoride applications",
            "Space maintainers",
            "Early orthodontic evaluation",
            "Habit counseling",
            "Sedation for anxious children",
        ],
        color: "text-success",
        bg: "bg-success/10",
        gradient: "from-success/5 to-transparent",
    },
    {
        id: "emergency",
        icon: Siren,
        title: "Emergency Care",
        tagline: "Immediate Relief When You Need It Most",
        description:
            "Dental emergencies don't wait — and neither do we. Our emergency dental team provides immediate care for urgent dental situations, offering same-day appointments and after-hours availability.",
        features: [
            "Same-day emergency appointments",
            "Severe toothache relief",
            "Broken or chipped tooth repair",
            "Lost filling or crown replacement",
            "Dental abscess treatment",
            "Knocked-out tooth management",
            "Post-surgical complications",
            "After-hours emergency line",
        ],
        color: "text-danger",
        bg: "bg-danger/10",
        gradient: "from-danger/5 to-transparent",
    },
    {
        id: "consultation",
        icon: Video,
        title: "Online Consultation",
        tagline: "Expert Dental Care, Anywhere",
        description:
            "Connect with our dental professionals from the comfort of your home through our secure, HIPAA-compliant video consultation platform. Get professional advice, treatment plans, prescriptions, and referrals without stepping out.",
        features: [
            "Secure HD video consultations",
            "Digital prescriptions",
            "Treatment plan reviews",
            "Post-treatment follow-ups",
            "Second opinion consultations",
            "Emergency triage assessments",
            "Conversion to in-person visit",
            "Session summary PDF",
        ],
        color: "text-primary",
        bg: "bg-primary/10",
        gradient: "from-primary/5 to-transparent",
    },
];

export default function ServicesPage() {
    return (
        <>
            {/* Hero */}
            <section className="relative pt-32 pb-16 bg-gradient-to-br from-slate-50 via-white to-teal-50/30">
                <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
                <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                            <Stethoscope className="h-4 w-4" />
                            Complete Dental Care
                        </div>
                        <h1 className="font-[family-name:var(--font-heading)] text-4xl sm:text-5xl text-secondary mb-4">
                            Our <span className="text-primary">Services</span>
                        </h1>
                        <p className="text-lg text-text-secondary max-w-2xl mx-auto">
                            Comprehensive dental care under one roof — from routine preventive
                            care to advanced surgical procedures and virtual consultations.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Service Detail Cards */}
            <section className="section-padding">
                <div className="mx-auto max-w-7xl space-y-12">
                    {services.map((service, i) => (
                        <ServiceCard key={service.id} service={service} index={i} />
                    ))}
                </div>
            </section>

            {/* Bottom CTA */}
            <section className="section-padding bg-white">
                <div className="mx-auto max-w-3xl text-center">
                    <h2 className="font-[family-name:var(--font-heading)] text-3xl text-secondary mb-4">
                        Ready to Get Started?
                    </h2>
                    <p className="text-text-secondary mb-8">
                        Book an appointment today and experience the Nexus Dental difference.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link href="/booking" className="btn-primary no-underline">
                            <Calendar className="h-5 w-5" />
                            Book Appointment
                        </Link>
                        <Link href="/consultation" className="btn-secondary no-underline">
                            <Video className="h-5 w-5" />
                            Online Consultation
                        </Link>
                    </div>
                </div>
            </section>
        </>
    );
}

function ServiceCard({
    service,
    index,
}: {
    service: (typeof services)[0];
    index: number;
}) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-80px" });
    const Icon = service.icon;
    const isEven = index % 2 === 0;

    return (
        <motion.div
            ref={ref}
            id={service.id}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="scroll-mt-24"
        >
            <div
                className={`rounded-3xl bg-white border border-border-light p-8 sm:p-10 lg:p-12 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-card)] transition-shadow`}
            >
                <div
                    className={`grid lg:grid-cols-2 gap-10 items-center ${isEven ? "" : "lg:direction-rtl"
                        }`}
                >
                    {/* Info */}
                    <div className={isEven ? "" : "lg:order-2"}>
                        <div className="flex items-center gap-4 mb-6">
                            <div
                                className={`w-14 h-14 ${service.bg} rounded-2xl flex items-center justify-center`}
                            >
                                <Icon className={`h-7 w-7 ${service.color}`} />
                            </div>
                            <div>
                                <h3 className="font-[family-name:var(--font-heading)] text-2xl text-secondary">
                                    {service.title}
                                </h3>
                                <p className={`text-sm font-medium ${service.color}`}>
                                    {service.tagline}
                                </p>
                            </div>
                        </div>

                        <p className="text-text-secondary leading-relaxed mb-6">
                            {service.description}
                        </p>

                        <Link
                            href="/booking"
                            className="btn-primary text-sm no-underline inline-flex"
                        >
                            <Calendar className="h-4 w-4" />
                            Book This Service
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>

                    {/* Features List */}
                    <div className={isEven ? "" : "lg:order-1"}>
                        <div
                            className={`rounded-2xl bg-gradient-to-br ${service.gradient} p-8`}
                        >
                            <h4 className="font-semibold text-secondary mb-4 text-sm uppercase tracking-wider">
                                What&apos;s Included
                            </h4>
                            <ul className="space-y-3">
                                {service.features.map((feature, j) => (
                                    <li key={j} className="flex items-start gap-3">
                                        <CheckCircle
                                            className={`h-5 w-5 ${service.color} mt-0.5 shrink-0`}
                                        />
                                        <span className="text-sm text-text-secondary">
                                            {feature}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
