"use client";

import { useEffect, useState } from "react";
import { Quote, Star } from "lucide-react";

interface Testimonial {
    name: string;
    role?: string;
    content: string;
    rating?: number;
    treatment?: string;
}

export default function TestimonialsSection() {
    const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

    useEffect(() => {
        let active = true;

        const fetchTestimonials = async () => {
            try {
                const response = await fetch("/api/public/clinic/content");
                const payload = await response.json();
                const published = payload?.success && Array.isArray(payload?.data?.testimonials)
                    ? payload.data.testimonials
                    : [];

                if (active) setTestimonials(published);
            } catch {
                if (active) setTestimonials([]);
            }
        };

        fetchTestimonials();
        return () => {
            active = false;
        };
    }, []);

    if (testimonials.length === 0) return null;

    return (
        <section className="section-padding bg-bg">
            <div className="mx-auto max-w-7xl">
                <div className="mx-auto mb-12 max-w-2xl text-center">
                    <span className="eyebrow">Patient experiences</span>
                    <h2 className="section-title mt-4">Words from our patients</h2>
                    <p className="section-subtitle !mb-0">Published feedback from people who have chosen our care.</p>
                </div>

                <div className="grid gap-5 lg:grid-cols-3">
                    {testimonials.slice(0, 3).map((testimonial, index) => (
                        <article key={`${testimonial.name}-${index}`} className="surface-card relative rounded-3xl p-7">
                            <Quote className="absolute right-6 top-6 h-10 w-10 text-primary/10" />
                            <div className="mb-5 flex gap-1" aria-label={`${testimonial.rating || 5} out of 5 stars`}>
                                {Array.from({ length: Math.min(testimonial.rating || 5, 5) }).map((_, star) => (
                                    <Star key={star} className="h-4 w-4 fill-accent text-accent" />
                                ))}
                            </div>
                            <blockquote className="text-sm leading-7 text-text-secondary">“{testimonial.content}”</blockquote>
                            <div className="mt-6 border-t border-border-light pt-5">
                                <p className="font-bold text-secondary">{testimonial.name}</p>
                                {(testimonial.role || testimonial.treatment) && (
                                    <p className="mt-1 text-xs text-text-muted">
                                        {[testimonial.role, testimonial.treatment].filter(Boolean).join(" · ")}
                                    </p>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}
