"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
    HeartHandshake,
    MessagesSquare,
    ScanLine,
    ShieldCheck,
} from "lucide-react";

const carePromises = [
    {
        icon: ShieldCheck,
        title: "Safety by design",
        description: "Thoughtful clinical protocols and careful attention to hygiene at every visit.",
    },
    {
        icon: MessagesSquare,
        title: "Clear communication",
        description: "Understand your options, expected costs, and next steps before treatment begins.",
    },
    {
        icon: HeartHandshake,
        title: "A gentler experience",
        description: "Unhurried conversations and comfort-led care for children, adults, and anxious patients.",
    },
    {
        icon: ScanLine,
        title: "Modern diagnostics",
        description: "Digital tools support precise assessment and more informed treatment planning.",
    },
];

export default function TrustSection() {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-80px" });

    return (
        <section className="section-padding bg-white" ref={ref}>
            <div className="mx-auto max-w-7xl">
                <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.55 }}
                    className="mx-auto mb-12 max-w-2xl text-center"
                >
                    <span className="eyebrow">Why patients choose us</span>
                    <h2 className="section-title mt-4">Care that earns your trust</h2>
                    <p className="section-subtitle !mb-0">
                        Professional dental care should feel understandable, respectful, and reassuring from the first conversation.
                    </p>
                </motion.div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {carePromises.map((item, index) => (
                        <motion.article
                            key={item.title}
                            initial={{ opacity: 0, y: 20 }}
                            animate={isInView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.45, delay: index * 0.08 }}
                            className="group rounded-3xl border border-border-light bg-bg/70 p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[var(--shadow-card)]"
                        >
                            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-105">
                                <item.icon className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl text-secondary">{item.title}</h3>
                            <p className="mt-3 text-sm leading-6 text-text-secondary">{item.description}</p>
                        </motion.article>
                    ))}
                </div>
            </div>
        </section>
    );
}
