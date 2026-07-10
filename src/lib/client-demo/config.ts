export interface ClientService {
    id: string;
    name: string;
    description: string;
    icon: string;
    image: string;
}

export interface ClientTestimonial {
    id: string;
    author: string;
    text: string;
    rating: number;
}

export interface ClientContact {
    email: string;
    phone: string;
    address: string;
    social?: Record<string, string>;
}

export interface ClientData {
    id: string;
    name: string;
    tagline: string;
    description: string;
    mission: string;
    vision: string;
    heroImage: string;
    logo: string;
    colors?: {
        primary?: string;
        accent?: string;
        text?: string;
    };
    services: ClientService[];
    testimonials: ClientTestimonial[];
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
        mission:
            "To provide exceptional and comprehensive dental care to our patients in a welcoming and professional environment.",
        vision:
            "To deliver an exceptional personal experience in dental care predicated on good quality service and to promote a relationship built on trust.",
        heroImage: "/client-demos/dentocdental/images/T8.jpg",
        logo: "/client-demos/dentocdental/images/Logo_dentoc_new.png",
        colors: {
            primary: "#FF9700",
            accent: "#FF9700",
            text: "#004551",
        },
        services: [
            {
                id: "teeth-whitening",
                name: "Teeth Whitening",
                description: "Designed to brighten your smile. We remove stains caused by food, drinks, and aging, using professional-grade whitening products that deliver safe and effective results.",
                icon: "Sparkles",
                image: "/client-demos/dentocdental/images/whitening.jpg",
            },
            {
                id: "periodontal",
                name: "Periodontal",
                description: "Healthy gums are key to overall oral health. Our periodontal treatments address gum diseases like gingivitis or periodontitis, with deep cleaning and other treatments that help restore gum health and prevent tooth loss.",
                icon: "ShieldPlus",
                image: "/client-demos/dentocdental/images/gum_dentoc.jpg",
            },
            {
                id: "orthodontics",
                name: "Orthodontics",
                description: "Whether you go with traditional braces or prefer the discreet option of Invisalign, our orthodontic treatments will straighten your teeth and improve your bite for a healthier, more beautiful smile.",
                icon: "SmilePlus",
                image: "/client-demos/dentocdental/images/dentoc_serv.jpg",
            },
            {
                id: "extractions",
                name: "Tooth Extractions",
                description: "Sometimes a tooth can't be saved. Our tooth extraction service ensures that any severely damaged or decayed teeth are gently removed, helping prevent further issues.",
                icon: "Cross",
                image: "/client-demos/dentocdental/images/Tooth.jpg",
            },
            {
                id: "implants",
                name: "Dental Implants",
                description: "Our dental implants are the perfect solution for missing teeth. We place a titanium post into the jawbone to support a crown or bridge, creating a natural-looking, permanent replacement.",
                icon: "Stethoscope",
                image: "/client-demos/dentocdental/images/cosmeti_dentoc.jpg",
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
        ],
        contact: {
            email: "contact@dentocdental.com",
            phone: "+233244881961",
            address: "Numo Tetteh Kwao St, Adjiringanor, East Legon, Accra, Ghana",
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
