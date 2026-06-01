// Google Identity Services (GSI) type declarations
// Shared across staff login page and invite accept page.

interface GoogleGSIButtonConfig {
    type?: "standard" | "icon";
    shape?: "rectangular" | "pill" | "circle" | "square";
    theme?: "outline" | "filled_blue" | "filled_black";
    text?: "signin_with" | "signup_with" | "continue_with" | "signin";
    size?: "large" | "medium" | "small";
    logo_alignment?: "left" | "center";
    width?: string | number;
    locale?: string;
}

declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: {
                        client_id: string;
                        callback: (response: { credential: string }) => void;
                        auto_select?: boolean;
                        cancel_on_tap_outside?: boolean;
                    }) => void;
                    renderButton: (element: HTMLElement, config: GoogleGSIButtonConfig) => void;
                    prompt: () => void;
                };
            };
        };
    }
}

export {};
