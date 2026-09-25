export default function TermsPage() {
    return (
        <div className="bg-[linear-gradient(180deg,#edf8f6_0%,#ffffff_18rem)] px-5 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="surface-card mx-auto max-w-3xl rounded-[2rem] p-7 sm:p-10">
                <span className="eyebrow">Using our services</span>
                <h1 className="mt-4 text-4xl font-heading text-secondary mb-8">Terms of service</h1>
                <div className="max-w-none space-y-6 text-text-secondary">
                    <p className="text-sm">Last Updated: February 16, 2026</p>

                    <h2 className="text-xl font-heading text-secondary mt-10">1. Acceptance of Terms</h2>
                    <p>
                        By accessing and using Nexus Dental’s digital platform, you agree to comply with
                        and be bound by these Terms of Service.
                    </p>

                    <h2 className="text-xl font-heading text-secondary mt-10">2. Clinical Disclaimer</h2>
                    <p>
                        Online consultations and triage results are for informational purposes and
                        do not constitute a final diagnosis. A physical examination is always required
                        for comprehensive dental treatment planning.
                    </p>

                    <h2 className="text-xl font-heading text-secondary mt-10">3. Patient Responsibilities</h2>
                    <p>
                        Patients must provide accurate medical histories. Nexus Dental is not liable
                        for complications arising from withheld or incorrect clinical information.
                    </p>

                    <h2 className="text-xl font-heading text-secondary mt-10">4. Cancellation Policy</h2>
                    <p>
                        Appointments cancelled less than 24 hours in advance may be subject
                        to a rescheduling fee at the discretion of the clinic.
                    </p>
                </div>
            </div>
        </div>
    );
}
