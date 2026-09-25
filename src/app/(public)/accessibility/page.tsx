import Link from "next/link";

export default function AccessibilityPage() {
    return (
        <div className="bg-[linear-gradient(180deg,#edf8f6_0%,#ffffff_18rem)] px-5 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="surface-card mx-auto max-w-3xl rounded-[2rem] p-7 sm:p-10">
                <span className="eyebrow">Inclusive access</span>
                <h1 className="mt-4 text-4xl font-heading text-secondary mb-8">Accessibility statement</h1>
                <div className="max-w-none space-y-6 text-text-secondary">
                    <h2 className="text-xl font-heading text-secondary mt-10">Our Commitment</h2>
                    <p>
                        Nexus Dental is committed to ensuring digital accessibility for people with disabilities.
                        We are continually improving the user experience for everyone and applying the relevant
                        accessibility standards.
                    </p>

                    <h2 className="text-xl font-heading text-secondary mt-10">Conformance Status</h2>
                    <p>
                        The Web Content Accessibility Guidelines (WCAG) defines requirements for designers and
                        developers to improve accessibility for people with disabilities. We aim for WCAG 2.1 Level AA conformance.
                    </p>

                    <h2 className="text-xl font-heading text-secondary mt-10">Feedback</h2>
                    <p>
                        We welcome your feedback on the accessibility of Nexus Dental. Please let us know if you
                        encounter accessibility barriers:
                    </p>
                    <p><Link href="/contact" className="font-semibold text-primary-dark">Use our contact page</Link> to report an accessibility barrier or request assistance.</p>
                </div>
            </div>
        </div>
    );
}
