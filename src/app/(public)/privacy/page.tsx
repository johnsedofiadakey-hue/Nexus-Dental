export default function PrivacyPage() {
    return (
        <div className="bg-[linear-gradient(180deg,#edf8f6_0%,#ffffff_18rem)] px-5 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="surface-card mx-auto max-w-3xl rounded-[2rem] p-7 sm:p-10">
                <span className="eyebrow">Your information</span>
                <h1 className="mt-4 text-4xl font-heading text-secondary mb-8">Privacy policy</h1>
                <div className="max-w-none space-y-6 text-text-secondary">
                    <p className="text-sm">Last updated: November 16, 2026</p>

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

                    <h2 className="text-xl font-heading text-secondary mt-10">3. Product Enquiries and Advertising Lead Forms</h2>
                    <p>
                        If you request a Nexus Dental demonstration, trial, or product information through our
                        website or a Meta lead form, we may receive your name, work email, phone or WhatsApp
                        number, clinic name, role, clinic location, preferred demonstration time, and the answers
                        you provide in the form. Please do not submit patient information or medical records in a
                        product-enquiry form.
                    </p>
                    <p>
                        We use product-enquiry information to respond to your request, assess trial eligibility,
                        arrange a demonstration, and follow up about Nexus Dental. We will use your information for
                        unrelated or ongoing direct marketing only where you have separately agreed to receive it.
                        You can withdraw that marketing consent at any time.
                    </p>
                    <p>
                        When you submit a form on Facebook or Instagram, Meta Platforms also processes information
                        under its own terms and privacy policy before making the lead available to us. We may use
                        service providers for secure lead storage, email, messaging, scheduling, and customer
                        relationship management. We do not sell lead information.
                    </p>

                    <h2 className="text-xl font-heading text-secondary mt-10">4. Patient and Clinic Data Usage</h2>
                    <p>
                        Patient and clinic data is used for authorised clinical treatment, appointment scheduling,
                        patient communication, billing, and support. A clinic using Nexus Dental is responsible for
                        the patient information it enters and for giving its patients the notices required by law.
                    </p>

                    <h2 className="text-xl font-heading text-secondary mt-10">5. Retention and Security</h2>
                    <p>
                        We retain product-enquiry information only for as long as reasonably necessary to respond,
                        manage the requested demonstration or trial, meet legal obligations, and maintain appropriate
                        business records. We use reasonable administrative and technical safeguards, but no online
                        transmission or storage method is completely risk-free.
                    </p>

                    <h2 className="text-xl font-heading text-secondary mt-10">6. Your Rights and Choices</h2>
                    <p>
                        Subject to applicable law, you may ask to access or correct your information, request deletion
                        of eligible non-clinical information, object to or restrict certain processing, or withdraw
                        marketing consent. Withdrawing marketing consent does not affect a demonstration or service
                        request you have already made.
                    </p>

                    <h2 className="text-xl font-heading text-secondary mt-10">7. Contact</h2>
                    <p>
                        For privacy questions, lead-data requests, or to stop marketing messages, email{" "}
                        <a className="font-semibold text-primary-dark underline" href="mailto:john@stormglide.io">
                            john@stormglide.io
                        </a>
                        . Please do not send patient records or other sensitive medical information by ordinary email.
                    </p>
                </div>
            </div>
        </div>
    );
}
