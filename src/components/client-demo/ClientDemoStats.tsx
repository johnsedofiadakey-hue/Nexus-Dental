"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import type { ClientData } from "@/lib/client-demo/config";

export default function ClientDemoStats({ client }: { client: ClientData }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-80px" });

    if (!client.stats.length) return null;

    return (
        <section className="py-14" style={{ backgroundColor: client.colors.text }} ref={ref}>
            <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 sm:grid-cols-3 sm:px-6 lg:px-8">
                {client.stats.map((stat, index) => (
                    <motion.div
                        key={stat.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={isInView ? { opacity: 1, y: 0 } : {}}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="text-center"
                    >
                        <p className="font-[family-name:var(--font-heading)] text-5xl text-white" style={{ color: client.colors.primary }}>
                            {stat.value}
                        </p>
                        <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-white/70">{stat.label}</p>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
