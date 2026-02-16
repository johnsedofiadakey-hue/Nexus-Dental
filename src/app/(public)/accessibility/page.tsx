export default function AccessibilityPage() {
    return (
        <div className="py-24 bg-white">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl font-heading text-secondary mb-8">Accessibility Statement</h1>
                <div className="prose prose-slate max-w-none space-y-6 text-text-secondary">
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
                    <ul className="list-disc pl-5">
                        <li>Email: accessibility@nexusdental.com</li>
                        <li>Phone: (123) 456-7890</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
