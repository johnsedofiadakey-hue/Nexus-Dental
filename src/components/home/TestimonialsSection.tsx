"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Star, ChevronLeft, ChevronRight, Quote, Loader2 } from "lucide-react";

interface Testimonial {
    name: string;
    role: string;
    content: string;
    rating: number;
    treatment?: string;
}

const defaultTestimonials = [
    {
        name: "Sarah Johnson",
        role: "Marketing Executive",
        content:
            "Nexus Dental transformed my smile completely. The team was incredibly professional, and the results exceeded my expectations. I finally have the confidence to smile openly!",
        rating: 5,
        treatment: "Cosmetic Veneers",
    },
    {
        name: "Michael Chen",
        role: "Software Engineer",
        content:
            "The online consultation service is a game-changer. I got professional dental advice without leaving my home. The doctor was thorough and the follow-up was exceptional.",
        rating: 5,
        treatment: "Online Consultation",
    },
    {
        name: "Amara Osei",
        role: "Teacher",
        content:
            "My daughter used to be terrified of dentists. The pediatric team here made her feel so comfortable — she actually looks forward to her check-ups now!",
        rating: 5,
        treatment: "Pediatric Care",
    },
];

export default function TestimonialsSection() {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-100px" });
    const [current, setCurrent] = useState(0);
    const [testimonialsList, setTestimonialsList] = useState<Testimonial[]>(defaultTestimonials);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchContent = async () => {
            try {
                // In a real multi-tenant scenario, tenantId would come from hostname or context
                // For demo/dev, we try to fetch from any active tenant or use defaults
                const res = await fetch("/api/public/clinic/content?tenantId=global-test"); // placeholder
                const data = await res.json();

                if (data.success && data.data.testimonials && data.data.testimonials.length > 0) {
                    setTestimonialsList(data.data.testimonials);
                }
            } catch (error) {
                console.error("Failed to load dynamic testimonials:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchContent();
    }, []);

    useEffect(() => {
        if (testimonialsList.length === 0) return;
        const timer = setInterval(() => {
            setCurrent((prev) => (prev + 1) % testimonialsList.length);
        }, 8000);
        return () => clearInterval(timer);
    }, [testimonialsList]);

    const prev = () =>
        setCurrent((c) => (c - 1 + testimonialsList.length) % testimonialsList.length);
    const next = () =>
        setCurrent((c) => (c + 1) % testimonialsList.length);

    if (testimonialsList.length === 0 && !loading) return null;

    return (
        <section className="section-padding" ref={ref}>
            <div className="mx-auto max-w-7xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6 }}
                >
                    <h2 className="section-title">What Our Patients Say</h2>
                    <p className="section-subtitle">
                        Real stories from real patients who trust us with their dental health
                        and smile transformations.
                    </p>
                </motion.div>

                {/* Carousel */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="relative max-w-3xl mx-auto"
                >
                    <div className="bg-white rounded-3xl p-8 sm:p-12 border border-border-light shadow-[var(--shadow-card)] relative overflow-hidden min-h-[400px] flex flex-col justify-center">
                        {/* Quote Mark */}
                        <div className="absolute top-6 right-8 opacity-5">
                            <Quote className="h-24 w-24 text-primary" />
                        </div>

                        {loading ? (
                            <div className="flex justify-center items-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <>
                                {/* Stars */}
                                <div className="flex gap-1 mb-6">
                                    {Array.from({ length: testimonialsList[current].rating || 5 }).map((_, i) => (
                                        <Star
                                            key={i}
                                            className="h-5 w-5 text-accent fill-accent"
                                        />
                                    ))}
                                </div>

                                {/* Quote */}
                                <blockquote className="font-[family-name:var(--font-heading)] text-xl sm:text-2xl text-secondary leading-relaxed mb-8">
                                    &ldquo;{testimonialsList[current].content}&rdquo;
                                </blockquote>

                                {/* Author */}
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                        <span className="text-lg font-bold text-primary">
                                            {testimonialsList[current].name.charAt(0)}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-secondary">
                                            {testimonialsList[current].name}
                                        </p>
                                        <p className="text-sm text-text-muted">
                                            {testimonialsList[current].role} {testimonialsList[current].treatment && `· ${testimonialsList[current].treatment}`}
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center justify-center gap-4 mt-8">
                        <button
                            onClick={prev}
                            className="w-10 h-10 rounded-xl bg-white border border-border flex items-center justify-center hover:bg-bg transition-colors"
                            aria-label="Previous testimonial"
                        >
                            <ChevronLeft className="h-5 w-5 text-text-secondary" />
                        </button>

                        <div className="flex gap-2">
                            {testimonialsList.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrent(i)}
                                    className={`h-2 rounded-full transition-all duration-300 ${i === current
                                        ? "w-8 bg-primary"
                                        : "w-2 bg-border hover:bg-text-muted"
                                        }`}
                                    aria-label={`Go to testimonial ${i + 1}`}
                                />
                            ))}
                        </div>

                        <button
                            onClick={next}
                            className="w-10 h-10 rounded-xl bg-white border border-border flex items-center justify-center hover:bg-bg transition-colors"
                            aria-label="Next testimonial"
                        >
                            <ChevronRight className="h-5 w-5 text-text-secondary" />
                        </button>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
