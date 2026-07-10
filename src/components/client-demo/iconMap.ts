import {
    Cross,
    ShieldPlus,
    SmilePlus,
    Sparkles,
    Stethoscope,
    type LucideIcon,
} from "lucide-react";

export const CLIENT_ICON_MAP: Record<string, LucideIcon> = {
    Sparkles,
    ShieldPlus,
    SmilePlus,
    Cross,
    Stethoscope,
};

export function getClientIcon(name: string): LucideIcon {
    return CLIENT_ICON_MAP[name] ?? Stethoscope;
}
