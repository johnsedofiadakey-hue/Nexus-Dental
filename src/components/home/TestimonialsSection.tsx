"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Star, ChevronLeft, ChevronRight, Quote } from "lucide-react";

const testimonials = [
    {
        name: "Sarah Johnson",
        role: "Marketing Executive",
        quote:
            "Nexus Dental transformed my smile completely. The team was incredibly professional, and the results exceeded my expectations. I finally have the confidence to smile openly!",
        rating: 5,
        treatment: "Cosmetic Veneers",
    },
    {
        name: "Michael Chen",
        role: "Software Engineer",
        quote:
            "The online consultation service is a game-changer. I got professional dental advice without leaving my home. The doctor was thorough and the follow-up was exceptional.",
        rating: 5,
        treatment: "Online Consultation",
    },
    {
        name: "Amara Osei",
        role: "Teacher",
        quote:
            "My daughter used to be terrified of dentists. The pediatric team here made her feel so comfortable — she actually looks forward to her check-ups now!",
        rating: 5,
        treatment: "Pediatric Care",
    },
    {
        name: "James Rivera",
        role: "Entrepreneur",
        quote:
            "I had a dental emergency on a Saturday and they saw me within the hour. The care was outstanding and the pain relief was immediate. Cannot recommend enough.",
        rating: 5,
        treatment: "Emergency Care",
    },
    {
        name: "Fatima Al-Rashid",
        role: "Architect",
        quote:
            "The Invisalign treatment was seamless from start to finish. The progress tracking was transparent and the results are absolutely perfect.",
        rating: 5,
        treatment: "Orthodontics",
    },
];

export default function TestimonialsSection() {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-100px" });
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrent((prev) => (prev + 1) % testimonials.length);
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    const prev = () =>
        setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length);
    const next = () =>
        setCurrent((c) => (c + 1) % testimonials.length);

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
                    <div className="bg-white rounded-3xl p-8 sm:p-12 border border-border-light shadow-[var(--shadow-card)] relative overflow-hidden">
                        {/* Quote Mark */}
                        <div className="absolute top-6 right-8 opacity-5">
                            <Quote className="h-24 w-24 text-primary" />
                        </div>

                        {/* Stars */}
                        <div className="flex gap-1 mb-6">
                            {Array.from({ length: testimonials[current].rating }).map((_, i) => (
                                <Star
                                    key={i}
                                    className="h-5 w-5 text-accent fill-accent"
                                />
                            ))}
                        </div>

                        {/* Quote */}
                        <blockquote className="font-[family-name:var(--font-heading)] text-xl sm:text-2xl text-secondary leading-relaxed mb-8">
                            &ldquo;{testimonials[current].quote}&rdquo;
                        </blockquote>

                        {/* Author */}
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-lg font-bold text-primary">
                                    {testimonials[current].name.charAt(0)}
                                </span>
                            </div>
                            <div>
                                <p className="font-semibold text-secondary">
                                    {testimonials[current].name}
                                </p>
                                <p className="text-sm text-text-muted">
                                    {testimonials[current].role} · {testimonials[current].treatment}
                                </p>
                            </div>
                        </div>
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
                            {testimonials.map((_, i) => (
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
