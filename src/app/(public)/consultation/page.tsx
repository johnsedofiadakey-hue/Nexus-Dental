import Link from "next/link";
import {
    ArrowRight,
    CalendarDays,
    Camera,
    ClipboardCheck,
    LockKeyhole,
    Stethoscope,
} from "lucide-react";

const steps = [
    {
        icon: ClipboardCheck,
        number: "01",
        title: "Tell us what is happening",
        text: "Share your concern and any useful background before the consultation.",
    },
    {
        icon: Camera,
        number: "02",
        title: "Meet online",
        text: "Speak privately with the care team using a supported device and stable connection.",
    },
    {
        icon: Stethoscope,
        number: "03",
        title: "Understand the next step",
        text: "Receive guidance on urgency and whether an in-clinic examination is appropriate.",
    },
];

export default function ConsultationPage() {
    return (
        <div className="bg-white">
            <section className="relative overflow-hidden bg-secondary px-5 py-16 text-white sm:px-6 sm:py-20 lg:px-8 lg:py-24">
                <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
                <div className="absolute -bottom-36 -right-20 h-96 w-96 rounded-full border-[54px] border-white/[0.04]" />
                <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1fr_0.85fr]">
                    <div>
                        <span className="eyebrow !text-primary-light">Virtual dental care</span>
                        <h1 className="mt-5 max-w-3xl font-[family-name:var(--font-heading)] text-5xl leading-[1.02] tracking-[-0.035em] sm:text-6xl">
                            Start the conversation from wherever you are.
                        </h1>
                        <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
                            Online consultations can support initial guidance and follow-up conversations. They do not replace hands-on examination, imaging, or emergency care when those are needed.
                        </p>
                        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                            <Link href="/booking" className="btn-primary min-h-14 px-6 text-base no-underline">
                                <CalendarDays className="h-5 w-5" />
                                Book a consultation
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link href="/contact" className="inline-flex min-h-14 items-center justify-center rounded-xl border border-white/20 px-6 text-base font-bold text-white no-underline hover:bg-white/10">
                                Ask a question first
                            </Link>
                        </div>
                    </div>

                    <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 backdrop-blur sm:p-8">
                        <div className="mb-7 flex items-center gap-3">
                            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white">
                                <LockKeyhole className="h-5 w-5" />
                            </span>
                            <div>
                                <p className="font-bold">A private, consent-led experience</p>
                                <p className="text-xs text-slate-400">Prepare in a quiet space where you feel comfortable.</p>
                            </div>
                        </div>
                        <ul className="m-0 grid list-none gap-3 p-0 text-sm text-slate-300">
                            <li className="rounded-xl bg-white/[0.05] px-4 py-3">Use a phone or computer with a camera and microphone.</li>
                            <li className="rounded-xl bg-white/[0.05] px-4 py-3">Have any relevant prescriptions or records nearby.</li>
                            <li className="rounded-xl bg-white/[0.05] px-4 py-3">Expect an in-person visit if a physical examination is needed.</li>
                        </ul>
                    </div>
                </div>
            </section>

            <section className="section-padding bg-bg">
                <div className="mx-auto max-w-7xl">
                    <div className="mx-auto mb-12 max-w-2xl text-center">
                        <span className="eyebrow">How it works</span>
                        <h2 className="section-title mt-4">Three clear steps</h2>
                    </div>
                    <div className="grid gap-5 lg:grid-cols-3">
                        {steps.map((step) => (
                            <article key={step.title} className="surface-card rounded-3xl p-7">
                                <div className="mb-8 flex items-center justify-between">
                                    <span className="flex h-13 w-13 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                        <step.icon className="h-6 w-6" />
                                    </span>
                                    <span className="font-[family-name:var(--font-heading)] text-3xl text-primary/25">{step.number}</span>
                                </div>
                                <h3 className="text-2xl text-secondary">{step.title}</h3>
                                <p className="mt-3 text-sm leading-7 text-text-secondary">{step.text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
