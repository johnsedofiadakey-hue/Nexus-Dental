"use client";

import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import type { ClientData } from "@/lib/client-demo/config";

export default function ClientDemoInsurance({ client }: { client: ClientData }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-80px" });

    if (!client.insurancePartners.length) return null;

    return (
        <section className="border-y border-black/5 bg-white py-12" ref={ref}>
            <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={isInView ? { opacity: 1 } : {}}
                    transition={{ duration: 0.5 }}
                    className="mb-8 text-center text-xs font-bold uppercase tracking-widest text-black/40"
                >
                    We partner with major insurance providers
                </motion.p>
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="grid grid-cols-3 items-center gap-x-8 gap-y-8 sm:grid-cols-5"
                >
                    {client.insurancePartners.map((logo) => (
                        <div key={logo} className="relative h-10 w-full grayscale transition-all hover:grayscale-0">
                            <Image src={logo} alt="Insurance partner" fill className="object-contain" sizes="120px" />
                        </div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}
