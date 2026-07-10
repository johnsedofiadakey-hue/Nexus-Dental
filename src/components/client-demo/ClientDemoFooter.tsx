import Link from "next/link";
import Image from "next/image";
import { Facebook, Instagram, Mail, MapPin, Phone, Sparkles } from "lucide-react";
import type { ClientData } from "@/lib/client-demo/config";

export default function ClientDemoFooter({ client }: { client: ClientData }) {
    const base = `/client-demo/${client.id}`;

    return (
        <footer className="bg-[#0d1f1f] text-white">
            <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
                <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <Image src={client.logo} alt={client.name} width={150} height={46} className="h-10 w-auto object-contain brightness-0 invert" />
                        <p className="mt-4 max-w-xs text-sm leading-6 text-white/60">{client.description}</p>
                        {client.contact.social && (
                            <div className="mt-5 flex gap-3">
                                {client.contact.social.facebook && (
                                    <a href={client.contact.social.facebook} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 transition-colors hover:bg-white/20" aria-label="Facebook">
                                        <Facebook className="h-4 w-4" />
                                    </a>
                                )}
                                {client.contact.social.instagram && (
                                    <a href={client.contact.social.instagram} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 transition-colors hover:bg-white/20" aria-label="Instagram">
                                        <Instagram className="h-4 w-4" />
                                    </a>
                                )}
                            </div>
                        )}
                    </div>

                    <div>
                        <h4 className="text-sm font-bold uppercase tracking-wide text-white/80">Quick links</h4>
                        <div className="mt-4 grid gap-2 text-sm text-white/60">
                            <Link href={base} className="no-underline hover:text-white">Home</Link>
                            <Link href={`${base}/about`} className="no-underline hover:text-white">About Us</Link>
                            <Link href={`${base}/services`} className="no-underline hover:text-white">Services</Link>
                            <Link href={`${base}/contact`} className="no-underline hover:text-white">Contact Us</Link>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-bold uppercase tracking-wide text-white/80">Our branches</h4>
                        <div className="mt-4 grid gap-2 text-sm text-white/60">
                            {client.contact.branches.map((b) => (
                                <span key={b.name}>{b.name}</span>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-bold uppercase tracking-wide text-white/80">Get in touch</h4>
                        <div className="mt-4 grid gap-3 text-sm text-white/60">
                            <span className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{client.contact.address}</span>
                            <span className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" />{client.contact.phone}</span>
                            <span className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0" />{client.contact.email}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-white/40 sm:flex-row">
                    <span>&copy; {new Date().getFullYear()} {client.name}. All Rights Reserved.</span>
                    <a
                        href="/"
                        className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 no-underline text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
                    >
                        <Sparkles className="h-3 w-3" />
                        Design demo built by Nexus Dental
                    </a>
                </div>
            </div>
        </footer>
    );
}
