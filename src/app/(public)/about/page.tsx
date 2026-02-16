import { Shield, Users, Award, Heart } from "lucide-react";

export default function AboutPage() {
    return (
        <div className="flex flex-col">
            {/* Hero Section */}
            <section className="relative py-24 bg-bg overflow-hidden">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="max-w-3xl">
                        <span className="inline-block px-4 py-1.5 mb-6 text-xs font-semibold tracking-wider text-primary uppercase bg-primary/10 rounded-full">
                            Our Story
                        </span>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading text-secondary leading-tight mb-8">
                            World-Class Dental Care. <br />
                            <span className="text-primary font-serif italic">Personalized</span> for You.
                        </h1>
                        <p className="text-lg text-text-secondary leading-relaxed mb-10">
                            Nexus Dental was founded with a single mission: to redefine the dental experience.
                            We combine cutting-edge technology with a human-centered approach to ensure
                            your comfort and precision in every procedure.
                        </p>
                    </div>
                </div>
            </section>

            {/* Values */}
            <section className="py-24 bg-white">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
                        {[
                            { icon: Shield, title: "Uncompromising Safety", desc: "Rigorous sterilization and the advanced clinical protocols." },
                            { icon: Award, title: "Elite Expertise", desc: "Our team of specialists brings decades of collective experience." },
                            { icon: Users, title: "Patient First", desc: "We listen, we care, and we tailor every treatment to your needs." },
                            { icon: Heart, title: "Compassion", desc: "Gentle techniques designed to eliminate dental anxiety." },
                        ].map((value, i) => (
                            <div key={i} className="flex flex-col">
                                <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary mb-6">
                                    <value.icon className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-heading text-secondary mb-4">{value.title}</h3>
                                <p className="text-sm text-text-secondary leading-relaxed">{value.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Team Preview Placeholder */}
            <section className="py-24 bg-bg">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-4xl font-heading text-secondary mb-6">Meet Our Specialists</h2>
                        <p className="text-text-secondary">
                            A dedicated team of experts committed to delivering the highest level of clinical excellence.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[1, 2, 3].map((id) => (
                            <div key={id} className="group overflow-hidden rounded-3xl bg-white border border-border shadow-soft hover:shadow-hover transition-all duration-500">
                                <div className="aspect-[4/5] bg-slate-100 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="p-8">
                                    <h4 className="text-xl font-heading text-secondary">Specialist {id}</h4>
                                    <p className="text-sm text-primary font-medium">Senior Clinician</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
