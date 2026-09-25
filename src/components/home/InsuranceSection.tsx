"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { BadgeCheck, ClipboardCheck, ReceiptText } from "lucide-react";

const support = [
    {
        icon: BadgeCheck,
        title: "Policy guidance",
        text: "Bring your membership details and our team will help you understand the verification steps.",
    },
    {
        icon: ClipboardCheck,
        title: "Claim documentation",
        text: "We can prepare the clinical and billing information normally required for an eligible claim.",
    },
    {
        icon: ReceiptText,
        title: "Clear estimates",
        text: "Review expected fees before treatment. Final reimbursement remains subject to your insurer's approval.",
    },
];

export default function InsuranceSection() {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-80px" });

    return (
        <section className="section-padding bg-white" ref={ref}>
            <div className="mx-auto grid max-w-7xl gap-10 rounded-[2rem] bg-secondary p-7 text-white sm:p-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14 lg:p-14">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.55 }}
                >
                    <span className="eyebrow !text-primary-light">Insurance support</span>
                    <h2 className="mt-4 font-[family-name:var(--font-heading)] text-4xl leading-tight sm:text-5xl">
                        Less paperwork. More clarity.
                    </h2>
                    <p className="mt-5 max-w-lg text-sm leading-7 text-slate-300 sm:text-base">
                        Coverage differs by provider and plan. We help you gather the right information without making promises your insurer must confirm.
                    </p>
                </motion.div>

                <div className="grid gap-4 sm:grid-cols-3">
                    {support.map((item, index) => (
                        <motion.div
                            key={item.title}
                            initial={{ opacity: 0, y: 18 }}
                            animate={isInView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.45, delay: index * 0.09 }}
                            className="rounded-2xl border border-white/10 bg-white/[0.06] p-5"
                        >
                            <item.icon className="mb-5 h-6 w-6 text-primary-light" />
                            <h3 className="text-lg text-white">{item.title}</h3>
                            <p className="mt-3 text-xs leading-6 text-slate-300">{item.text}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
