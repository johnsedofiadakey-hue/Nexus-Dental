export default function TermsPage() {
    return (
        <div className="py-24 bg-white">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl font-heading text-secondary mb-8">Terms of Service</h1>
                <div className="prose prose-slate max-w-none space-y-6 text-text-secondary">
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
