export default function PrivacyPage() {
    return (
        <div className="bg-[linear-gradient(180deg,#edf8f6_0%,#ffffff_18rem)] px-5 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="surface-card mx-auto max-w-3xl rounded-[2rem] p-7 sm:p-10">
                <span className="eyebrow">Your information</span>
                <h1 className="mt-4 text-4xl font-heading text-secondary mb-8">Privacy policy</h1>
                <div className="max-w-none space-y-6 text-text-secondary">
                    <p className="text-sm">Effective Date: February 16, 2026</p>

                    <h2 className="text-xl font-heading text-secondary mt-10">1. Commitment to Privacy</h2>
                    <p>
                        At Nexus Dental, we take your privacy and the security of your health information seriously.
                        This policy describes how we collect, use, and protect your personal and medical data
                        in line with applicable data-protection and health-record requirements.
                    </p>

                    <h2 className="text-xl font-heading text-secondary mt-10">2. Information Collection</h2>
                    <p>
                        We collect information you provide directly, including:
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>Identity data (Name, Date of Birth)</li>
                        <li>Contact data (Email, Phone Number, Address)</li>
                        <li>Medical history and clinical notes</li>
                        <li>Insurance information</li>
                    </ul>

                    <h2 className="text-xl font-heading text-secondary mt-10">3. Data Usage</h2>
                    <p>
                        Your data is used solely for clinical treatment, appointment scheduling,
                        billing, and responding to your support inquiries. We never sell your data
                        to third parties.
                    </p>

                    <h2 className="text-xl font-heading text-secondary mt-10">4. Your Rights</h2>
                    <p>
                        You have the right to request a copy of your records, correct inaccuracies,
                        and in certain cases, request deletion of non-clinical administrative data.
                    </p>
                </div>
            </div>
        </div>
    );
}
