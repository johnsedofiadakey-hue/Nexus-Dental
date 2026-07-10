"use client";

import { useState } from "react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ChevronDown } from "lucide-react";
import type { ClientData } from "@/lib/client-demo/config";

export default function ClientDemoFAQ({ client }: { client: ClientData }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-80px" });
    const [openId, setOpenId] = useState<string | null>(client.faqs[0]?.id ?? null);
    const primary = client.colors.primary;

    if (!client.faqs.length) return null;

    return (
        <section className="section-padding bg-white" ref={ref}>
            <div className="mx-auto max-w-4xl px-5 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.55 }}
                    className="mb-10 text-center"
                >
                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide" style={{ backgroundColor: `${primary}18`, color: primary }}>
                        FAQs
                    </span>
                    <h2 className="mt-4 font-[family-name:var(--font-heading)] text-4xl leading-tight tracking-[-0.025em] sm:text-5xl" style={{ color: client.colors.text }}>
                        Common questions.
                    </h2>
                </motion.div>

                <div className="grid gap-3">
                    {client.faqs.map((faq, index) => {
                        const open = openId === faq.id;
                        return (
                            <motion.div
                                key={faq.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={isInView ? { opacity: 1, y: 0 } : {}}
                                transition={{ duration: 0.4, delay: index * 0.05 }}
                                className="overflow-hidden rounded-2xl border border-border-light"
                            >
                                <button
                                    type="button"
                                    onClick={() => setOpenId(open ? null : faq.id)}
                                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                                >
                                    <span className="text-sm font-bold text-secondary">{faq.question}</span>
                                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: primary }} />
                                </button>
                                {open && (
                                    <div className="px-5 pb-4 text-sm leading-6 text-text-secondary">{faq.answer}</div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
