export interface ClientService {
    id: string;
    name: string;
    description: string;
    icon: string;
    image?: string;
}

export interface ClientServiceCategory {
    id: string;
    label: string;
    services: ClientService[];
}

export interface ClientTestimonial {
    id: string;
    author: string;
    text: string;
    rating: number;
}

export interface ClientStat {
    id: string;
    label: string;
    value: string;
}

export interface ClientFeature {
    id: string;
    title: string;
    icon: string;
}

export interface ClientFaq {
    id: string;
    question: string;
    answer: string;
}

export interface ClientBranch {
    name: string;
}

export interface ClientContact {
    email: string;
    phone: string;
    website: string;
    address: string;
    branches: ClientBranch[];
    social?: Record<string, string>;
}

export interface ClientData {
    id: string;
    name: string;
    tagline: string;
    description: string;
    aboutText: string;
    mission: string;
    vision: string;
    heroImage: string;
    logo: string;
    reviewBadge: string;
    colors: {
        primary: string;
        accent: string;
        text: string;
    };
    featuredServices: ClientService[];
    serviceCategories: ClientServiceCategory[];
    testimonials: ClientTestimonial[];
    stats: ClientStat[];
    comfortIntro: string;
    comfortFeatures: ClientFeature[];
    faqs: ClientFaq[];
    insurancePartners: string[];
    contact: ClientContact;
    sourceUrl: string;
}

const CLIENTS: Record<string, ClientData> = {
    dentocdental: {
        id: "dentocdental",
        name: "Dentoc Dental Clinic",
        tagline: "Your smile, our priority.",
        description:
            "Dentoc Dental Clinic is a leading provider of comprehensive dental care in Ghana, offering a wide range of services with state-of-the-art technology and a team of highly skilled professionals — from general dentistry to advanced implants and root canals.",
        aboutText:
            "Dentoc Dental Clinic is a private dental clinic based in Accra, offering high quality dental services across General Dentistry, Advanced Dentistry, and Cosmetic Dentistry. We take great pride in the professionalism and innovation of our highly skilled team and in the quality of the treatments we deliver to our patients. At the heart of our treatment is the need for you to leave with the best positive experience.",
        mission:
            "To provide exceptional and comprehensive dental care to our patients in a welcoming and professional environment, while educating and encouraging them towards a state of optimal oral health.",
        vision:
            "To deliver an exceptional personal experience in dental care predicated on good quality service and to promote a relationship built on trust.",
        heroImage: "/client-demos/dentocdental/images/T8.jpg",
        logo: "/client-demos/dentocdental/images/Logo_dentoc_new.png",
        reviewBadge: "/client-demos/dentocdental/images/dentoc_reviews.png",
        colors: {
            primary: "#FF9700",
            accent: "#FF9700",
            text: "#004551",
        },
        featuredServices: [
            {
                id: "teeth-whitening",
                name: "Teeth Whitening",
                description:
                    "Designed to brighten your smile. We remove stains caused by food, drinks, and aging, using professional-grade whitening products that deliver safe and effective results.",
                icon: "Sparkles",
                image: "/client-demos/dentocdental/images/whitening.jpg",
            },
            {
                id: "periodontal",
                name: "Periodontal",
                description:
                    "Healthy gums are key to overall oral health. Our periodontal treatments address gum diseases like gingivitis or periodontitis, with deep cleaning that helps restore gum health and prevent tooth loss.",
                icon: "ShieldPlus",
                image: "/client-demos/dentocdental/images/gum_dentoc.jpg",
            },
            {
                id: "orthodontics",
                name: "Orthodontics",
                description:
                    "Whether you go with traditional braces or prefer the discreet option of Invisalign, our orthodontic treatments will straighten your teeth and improve your bite for a healthier smile.",
                icon: "SmilePlus",
                image: "/client-demos/dentocdental/images/dentoc_serv.jpg",
            },
            {
                id: "extractions",
                name: "Tooth Extractions",
                description:
                    "Sometimes a tooth can't be saved. Our extraction service ensures severely damaged or decayed teeth are gently removed, helping prevent further issues.",
                icon: "Cross",
                image: "/client-demos/dentocdental/images/Tooth.jpg",
            },
            {
                id: "implants",
                name: "Dental Implants",
                description:
                    "Our dental implants are the perfect solution for missing teeth. We place a titanium post into the jawbone to support a crown or bridge, creating a natural-looking, permanent replacement.",
                icon: "Stethoscope",
                image: "/client-demos/dentocdental/images/cosmeti_dentoc.jpg",
            },
        ],
        serviceCategories: [
            {
                id: "general",
                label: "General & Preventive",
                services: [
                    { id: "checkups", name: "Routine Check-ups & Cleanings", description: "Examination for signs of issues plus a professional clean to remove plaque and tartar, keeping your smile fresh and healthy.", icon: "Stethoscope" },
                    { id: "cavity-fillings", name: "Cavity Fillings", description: "Durable, tooth-colored materials that blend seamlessly with your natural teeth for a discreet solution.", icon: "ShieldPlus" },
                    { id: "preventive-care", name: "Preventive Care", description: "Tips, treatments, and exams to help you avoid cavities, gum disease, and other oral health issues long-term.", icon: "ShieldPlus" },
                    { id: "digital-xrays", name: "Digital X-rays", description: "Fast, accurate assessment of teeth and gums with clear imaging that helps diagnose problems early while minimizing radiation exposure.", icon: "Stethoscope" },
                    { id: "fluoride", name: "Fluoride Treatments", description: "Strengthen teeth and prevent cavities — an easy, effective way to protect your smile if you're at higher risk of decay.", icon: "Sparkles" },
                    { id: "sealants", name: "Sealants", description: "A protective coating applied to the chewing surfaces of your molars, shielding hard-to-reach teeth from decay.", icon: "ShieldPlus" },
                ],
            },
            {
                id: "cosmetic",
                label: "Cosmetic Dentistry",
                services: [
                    { id: "teeth-whitening-2", name: "Teeth Whitening", description: "Professional-grade whitening that removes stains from food, drinks, and aging for a brighter smile.", icon: "Sparkles" },
                    { id: "veneers", name: "Veneers", description: "Thin shells placed over teeth to correct discoloration, chips, or misalignment for a flawless, natural look.", icon: "SmilePlus" },
                    { id: "bonding", name: "Bonding", description: "Tooth-colored resin applied to repair small chips or gaps, giving teeth a smoother, more uniform appearance.", icon: "SmilePlus" },
                    { id: "invisalign", name: "Invisalign", description: "Discreet, comfortable, custom-made clear aligners that gradually shift teeth into place without traditional braces.", icon: "SmilePlus" },
                    { id: "smile-makeovers", name: "Smile Makeovers", description: "Multiple cosmetic treatments tailored to your needs — whitening, veneers, and more — for your dream smile.", icon: "Sparkles" },
                    { id: "contouring", name: "Contouring & Reshaping", description: "A quick procedure that addresses minor imperfections and makes your teeth look more balanced.", icon: "SmilePlus" },
                ],
            },
            {
                id: "restorative",
                label: "Advanced & Restorative",
                services: [
                    { id: "implants-2", name: "Dental Implants", description: "A permanent solution for missing teeth — a titanium post supports a crown, bridge, or denture that feels just like your own teeth.", icon: "Stethoscope" },
                    { id: "crowns", name: "Crowns", description: "Restore strength and function to a damaged tooth with a crown matched to the color and shape of your natural teeth.", icon: "ShieldPlus" },
                    { id: "bridges", name: "Bridges", description: "Fill the gap from missing teeth by anchoring artificial teeth to adjacent natural teeth or implants.", icon: "ShieldPlus" },
                    { id: "root-canals", name: "Root Canals", description: "Remove infected tissue, clean, and seal a damaged tooth to save it and restore function, preventing extraction.", icon: "Cross" },
                    { id: "dentures", name: "Partial & Full Dentures", description: "Custom-made dentures that restore your smile and make it easier to eat and speak, with a natural look and feel.", icon: "SmilePlus" },
                    { id: "fillings-2", name: "Fillings", description: "Durable, tooth-colored fillings that restore the integrity of teeth affected by cavities or minor decay.", icon: "ShieldPlus" },
                ],
            },
        ],
        testimonials: [
            {
                id: "t1",
                author: "Nana Owusuaa Antwi-Boasiako",
                text: "I had a great experience. They are very professional as well. Totally recommend it.",
                rating: 5,
            },
            {
                id: "t2",
                author: "Janet Ama Okyere",
                text: "Best dental clinic in Adjiringanor. I was given very warm customer service from when I called to book my appointment to the completion of my session. A good location with a very neat environment and up to date technology.",
                rating: 5,
            },
            {
                id: "t3",
                author: "Monica Cofie",
                text: "Very good service with friendly staff. I did teeth cleaning and my son also had his tooth filled. The process was smooth and the quality is good.",
                rating: 5,
            },
            {
                id: "t4",
                author: "Rehana Yusif",
                text: "Dr. Emmanuel took his time to explain everything to me and made sure that I was well taken care of. Everyone was very professional and friendly. My results were more than what I expected.",
                rating: 5,
            },
            {
                id: "t5",
                author: "nana ama",
                text: "It was a good experience, and I got exactly what I wanted — perfect results.",
                rating: 5,
            },
            {
                id: "t6",
                author: "Bashiru Tahiru",
                text: "My first time booking an appointment, I was served very nicely and they recommended a mouth wash. I liked their service so much I'll be coming around more often.",
                rating: 5,
            },
            {
                id: "t7",
                author: "Linda Abena",
                text: "I came in for a swollen gum and the dentist was amazing — he took his time to explain everything, then scheduled me to fix other issues he noticed. Service was 10/10, very friendly and professional.",
                rating: 5,
            },
        ],
        stats: [
            { id: "referrals", label: "Patient Referrals", value: "325+" },
            { id: "success", label: "Successful Treatments", value: "98%" },
            { id: "doctors", label: "Active Doctors", value: "15+" },
        ],
        comfortIntro:
            "From the moment you walk in, we prioritize your comfort, offering a calming atmosphere designed to reduce anxiety. Our treatment rooms are equipped with the latest technology, which helps make procedures smoother and less invasive.",
        comfortFeatures: [
            { id: "satisfaction", title: "Customer Satisfaction", icon: "Sparkles" },
            { id: "personalized", title: "Personalized Care", icon: "HeartHandshake" },
            { id: "support", title: "Post-Treatment Support", icon: "ShieldCheck" },
        ],
        faqs: [
            {
                id: "faq1",
                question: "What services does Dentoc Dental Clinic offer?",
                answer: "A wide range including general dentistry (check-ups, cleanings, fillings), advanced dentistry (root canals, implants), cosmetic dentistry (veneers, whitening, smile makeovers), and specialized treatments like crowns, bridges, dentures, and night guards.",
            },
            {
                id: "faq2",
                question: "How do I book an appointment?",
                answer: "Call any of our branches directly, message us on social media, or use the Book Appointment button on this site to request a time that works for you.",
            },
            {
                id: "faq3",
                question: "Do you accept insurance, and which providers are covered?",
                answer: "Yes — we partner with major providers including GHIC, Glico, Acacia, Nationwide, ACE, Star, Premier, Phoenix, Metro, and Equity. Bring your insurance ID to your visit.",
            },
            {
                id: "faq4",
                question: "Is Dentoc Dental Clinic a good option for cosmetic dentistry?",
                answer: "Yes — our cosmetic services include whitening, veneers, bonding, Invisalign, and full smile makeovers, tailored to your goals.",
            },
            {
                id: "faq5",
                question: "What should I do if I have a dental emergency?",
                answer: "Call your nearest branch right away — we prioritize emergency cases such as severe pain, trauma, swelling, or broken teeth.",
            },
            {
                id: "faq6",
                question: "What are your clinic hours?",
                answer: "Hours vary slightly by branch — contact your nearest location directly for exact opening times.",
            },
        ],
        insurancePartners: [
            "/client-demos/dentocdental/images/acacia.png",
            "/client-demos/dentocdental/images/GHIC.png",
            "/client-demos/dentocdental/images/glico.png",
            "/client-demos/dentocdental/images/nationwide.png",
            "/client-demos/dentocdental/images/ace.png",
            "/client-demos/dentocdental/images/star.png",
            "/client-demos/dentocdental/images/premier.png",
            "/client-demos/dentocdental/images/phoenix.png",
            "/client-demos/dentocdental/images/metro.png",
            "/client-demos/dentocdental/images/equity.png",
        ],
        contact: {
            email: "contact@dentocdental.com",
            phone: "+233244881961",
            website: "www.dentocdental.com",
            address: "Numo Tetteh Kwao St, Adjiringanor, East Legon, Accra, Ghana",
            branches: [
                { name: "East Legon Branch" },
                { name: "Ashiaman Branch" },
                { name: "Weija Branch" },
                { name: "Nkawkaw Branch" },
                { name: "Sunyani Branch" },
            ],
            social: {
                facebook: "https://facebook.com/dentocdentalclinic",
                instagram: "https://instagram.com/dentocdentalclinic",
            },
        },
        sourceUrl: "https://dentocdental.com",
    },
};

export function getClientData(clientId: string): ClientData | null {
    return CLIENTS[clientId] ?? null;
}

export function getAllClientIds(): string[] {
    return Object.keys(CLIENTS);
}
