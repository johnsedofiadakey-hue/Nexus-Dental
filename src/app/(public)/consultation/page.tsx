import { Video, ClipboardCheck, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConsultationPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <section className="py-24 bg-bg flex-grow">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <span className="inline-block px-4 py-1.5 mb-6 text-xs font-semibold tracking-wider text-primary uppercase bg-primary/10 rounded-full">
                            Virtual Care
                        </span>
                        <h1 className="text-4xl md:text-5xl font-heading text-secondary mb-6">Online Consultation</h1>
                        <p className="text-lg text-text-secondary">
                            Distance shouldn't be a barrier to elite dental advice. Speak with our experts from the comfort of your home.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: ClipboardCheck,
                                title: "1. Digital Assessment",
                                desc: "Fill out our clinical assessment form and upload clear photos of your concern."
                            },
                            {
                                icon: Video,
                                title: "2. Expert Review",
                                desc: "Our senior dentists review your data and schedule a high-definition video session."
                            },
                            {
                                icon: ShieldCheck,
                                title: "3. Treatment Plan",
                                desc: "Receive a comprehensive digital diagnosis and estimated treatment roadmap."
                            }
                        ].map((step, i) => (
                            <div key={i} className="bg-white p-10 rounded-3xl border border-border shadow-soft">
                                <div className="w-14 h-14 rounded-2xl bg-bg flex items-center justify-center text-primary mb-8">
                                    <step.icon className="h-7 w-7" />
                                </div>
                                <h3 className="text-xl font-heading text-secondary mb-4">{step.title}</h3>
                                <p className="text-sm text-text-secondary leading-relaxed mb-6">{step.desc}</p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-16 bg-secondary rounded-[2.5rem] p-12 text-center text-white overflow-hidden relative">
                        <div className="relative z-10">
                            <h2 className="text-3xl font-heading mb-6">Ready to start your digital triage?</h2>
                            <p className="text-slate-400 max-w-xl mx-auto mb-10">
                                Secure, HIPAA-compliant, and professional. Initial assessment takes less than 5 minutes.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Button className="h-12 px-8 rounded-xl bg-primary hover:bg-primary-dark">
                                    Start Virtual Triage
                                </Button>
                                <Button variant="outline" className="h-12 px-8 rounded-xl border-white/20 hover:bg-white/10 text-white">
                                    Learn How it Works
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
