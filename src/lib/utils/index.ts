import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility for merging tailwind classes with dynamic logic
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
