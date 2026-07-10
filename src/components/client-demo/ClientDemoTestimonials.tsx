"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Quote, Star } from "lucide-react";
import type { ClientData } from "@/lib/client-demo/config";

export default function ClientDemoTestimonials({ client }: { client: ClientData }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-80px" });

    if (!client.testimonials.length) return null;
    const primary = client.colors.primary;

    return (
        <section className="section-padding bg-white" ref={ref}>
            <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.55 }}
                    className="mb-12 max-w-2xl"
                >
                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide" style={{ backgroundColor: `${primary}18`, color: primary }}>
                        Patient stories
                    </span>
                    <h2 className="mt-4 font-[family-name:var(--font-heading)] text-4xl leading-tight tracking-[-0.025em] sm:text-5xl" style={{ color: client.colors.text }}>
                        What patients say about {client.name}.
                    </h2>
                </motion.div>

                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {client.testimonials.map((testimonial, index) => (
                        <motion.div
                            key={testimonial.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={isInView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.45, delay: index * 0.06 }}
                            className="flex h-full flex-col rounded-3xl border border-border-light bg-bg/60 p-7"
                        >
                            <Quote className="h-6 w-6" style={{ color: `${primary}66` }} />
                            <p className="mt-4 flex-1 text-sm leading-7 text-text-secondary">&ldquo;{testimonial.text}&rdquo;</p>
                            <div className="mt-6 flex items-center justify-between">
                                <span className="text-sm font-bold text-secondary">{testimonial.author}</span>
                                <div className="flex items-center gap-0.5">
                                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                                        <Star key={i} className="h-3.5 w-3.5" style={{ fill: primary, color: primary }} />
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
