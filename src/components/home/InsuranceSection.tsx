"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Shield } from "lucide-react";

const insurancePartners = [
    "MetLife",
    "Cigna",
    "Aetna",
    "Delta Dental",
    "BlueCross",
    "United Health",
    "Guardian",
    "Humana",
    "Sun Life",
    "Principal",
];

export default function InsuranceSection() {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-100px" });

    return (
        <section className="section-padding bg-white overflow-hidden" ref={ref}>
            <div className="mx-auto max-w-7xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-12"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                        <Shield className="h-4 w-4" />
                        Insurance Accepted
                    </div>
                    <h2 className="section-title">Trusted Insurance Partners</h2>
                    <p className="section-subtitle">
                        We work with leading insurance providers to make quality dental care
                        accessible and affordable for everyone.
                    </p>
                </motion.div>

                {/* Scrolling Ticker */}
                <div className="relative">
                    {/* Gradient Masks */}
                    <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-white to-transparent z-10" />
                    <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white to-transparent z-10" />

                    <div className="flex overflow-hidden">
                        <motion.div
                            animate={{ x: ["0%", "-50%"] }}
                            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                            className="flex gap-8 shrink-0"
                        >
                            {[...insurancePartners, ...insurancePartners].map((partner, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-center px-8 py-5 rounded-2xl bg-bg border border-border-light min-w-[180px] hover:border-primary/20 transition-colors"
                                >
                                    <span className="font-[family-name:var(--font-heading)] text-lg text-text-secondary whitespace-nowrap">
                                        {partner}
                                    </span>
                                </div>
                            ))}
                        </motion.div>
                    </div>
                </div>

                {/* Extra note */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={isInView ? { opacity: 1 } : {}}
                    transition={{ delay: 0.4 }}
                    className="text-center text-sm text-text-muted mt-8"
                >
                    Don&apos;t see your insurance? Contact us — we may still be able to help.
                </motion.p>
            </div>
        </section>
    );
}
