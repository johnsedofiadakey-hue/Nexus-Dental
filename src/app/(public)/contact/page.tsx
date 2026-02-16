import { MapPin, Phone, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ContactPage() {
    return (
        <div className="flex flex-col">
            <section className="py-24 bg-bg">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
                        {/* Contact Info */}
                        <div>
                            <span className="inline-block px-4 py-1.5 mb-6 text-xs font-semibold tracking-wider text-primary uppercase bg-primary/10 rounded-full">
                                Get in Touch
                            </span>
                            <h1 className="text-4xl md:text-5xl font-heading text-secondary leading-tight mb-8">
                                We're here to help you <br />
                                <span className="text-primary font-serif italic">perfect</span> your smile.
                            </h1>

                            <div className="space-y-8 mt-12">
                                {[
                                    { icon: MapPin, label: "Visit Us", value: "123 Dental Avenue, Suite 100, NY 10001" },
                                    { icon: Phone, label: "Call Us", value: "(123) 456-7890" },
                                    { icon: Mail, label: "Email Us", value: "info@nexusdental.com" },
                                    { icon: MessageSquare, label: "Live Chat", value: "Available Mon-Fri, 9am - 5pm" },
                                ].map((item, i) => (
                                    <div key={i} className="flex gap-6">
                                        <div className="w-12 h-12 shrink-0 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary">
                                            <item.icon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">{item.label}</p>
                                            <p className="text-secondary font-medium">{item.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Contact Form */}
                        <div className="bg-white rounded-[2rem] p-10 shadow-hero border border-border">
                            <h3 className="text-2xl font-heading text-secondary mb-8">Send us a message</h3>
                            <form className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">Full Name</label>
                                        <Input placeholder="John Doe" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">Email Address</label>
                                        <Input type="email" placeholder="john@example.com" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">Subject</label>
                                    <Input placeholder="General Inquiry" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">Message</label>
                                    <textarea
                                        className="flex min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                                        placeholder="How can we help you today?"
                                    />
                                </div>
                                <Button className="w-full h-12 rounded-xl text-base font-medium">
                                    Send Message
                                </Button>
                            </form>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
