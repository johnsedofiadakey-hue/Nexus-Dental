"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
    ArrowRight,
    HeartHandshake,
    Loader2,
    MessagesSquare,
    ScanLine,
    ShieldCheck,
} from "lucide-react";

const values = [
    { icon: ShieldCheck, title: "Safety first", text: "Careful clinical protocols and a consistent focus on patient wellbeing." },
    { icon: MessagesSquare, title: "Clarity always", text: "Plain-language explanations before decisions are made." },
    { icon: HeartHandshake, title: "Human care", text: "A calm, respectful experience shaped around the person—not just the procedure." },
    { icon: ScanLine, title: "Modern thinking", text: "Thoughtful use of digital tools to support accurate planning and continuity of care." },
];

export default function AboutPage() {
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState({
        aboutPage: "We combine modern dental practice with a warm, patient-centred approach to make each visit more comfortable and understandable.",
        mission: "To provide clear, respectful dental care that helps every patient make confident decisions about their health.",
        vision: "A community where professional dental care feels accessible, calm, and built around long-term wellbeing.",
    });

    useEffect(() => {
        let active = true;

        const fetchContent = async () => {
            try {
                const response = await fetch("/api/public/clinic/content");
                const payload = await response.json();
                if (active && payload.success && payload.data) {
                    setContent((current) => ({
                        aboutPage: payload.data.aboutPage || current.aboutPage,
                        mission: payload.data.mission || current.mission,
                        vision: payload.data.vision || current.vision,
                    }));
                }
            } catch {
                // The locally defined clinic copy remains available when content storage is offline.
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchContent();
        return () => {
            active = false;
        };
    }, []);

    return (
        <div className="bg-white">
            <section className="relative overflow-hidden bg-[linear-gradient(135deg,#f7fbfa,#edf8f6)] px-5 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
                <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
                    <div>
                        <span className="eyebrow">Our approach</span>
                        <h1 className="mt-5 font-[family-name:var(--font-heading)] text-5xl leading-[1.02] tracking-[-0.035em] text-secondary sm:text-6xl">
                            Dentistry built around <span className="text-primary">people.</span>
                        </h1>
                        {loading ? (
                            <Loader2 className="mt-8 h-7 w-7 animate-spin text-primary" />
                        ) : (
                            <p className="mt-7 max-w-xl text-lg leading-8 text-text-secondary">{content.aboutPage}</p>
                        )}
                        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                            <Link href="/booking" className="btn-primary min-h-13 px-6 no-underline">
                                Book a visit
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link href="/services" className="btn-secondary min-h-13 bg-white px-6 no-underline">Explore services</Link>
                        </div>
                    </div>

                    <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border-[6px] border-white shadow-[var(--shadow-hero)]">
                        <Image
                            src="/images/patient-consultation.jpg"
                            alt="Dentist having a calm consultation with a patient"
                            fill
                            sizes="(max-width: 1024px) 100vw, 50vw"
                            className="object-cover object-[68%_center]"
                        />
                    </div>
                </div>
            </section>

            <section className="section-padding">
                <div className="mx-auto max-w-7xl">
                    <div className="mx-auto mb-12 max-w-2xl text-center">
                        <span className="eyebrow">What guides us</span>
                        <h2 className="section-title mt-4">Professional care can still feel personal.</h2>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                        {values.map((value) => (
                            <article key={value.title} className="rounded-3xl border border-border-light bg-bg/60 p-6">
                                <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                    <value.icon className="h-6 w-6" />
                                </span>
                                <h3 className="text-xl text-secondary">{value.title}</h3>
                                <p className="mt-3 text-sm leading-7 text-text-secondary">{value.text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="section-padding bg-bg">
                <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-2">
                    <article className="rounded-[2rem] bg-secondary p-8 text-white sm:p-10">
                        <span className="eyebrow !text-primary-light">Our mission</span>
                        <p className="mt-5 font-[family-name:var(--font-heading)] text-3xl leading-snug">{content.mission}</p>
                    </article>
                    <article className="rounded-[2rem] border border-border bg-white p-8 sm:p-10">
                        <span className="eyebrow">Our vision</span>
                        <p className="mt-5 font-[family-name:var(--font-heading)] text-3xl leading-snug text-secondary">{content.vision}</p>
                    </article>
                </div>
            </section>
        </div>
    );
}
