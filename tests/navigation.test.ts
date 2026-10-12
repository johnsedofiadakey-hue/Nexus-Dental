import { describe, expect, it } from "vitest";
import { buildMobileNavigation, buildNavigation } from "@/components/layout/navigation";

describe("role-aware navigation", () => {
    it("only exposes modules granted to a restricted receptionist", () => {
        const items = buildNavigation({
            roles: ["RECEPTIONIST"],
            permissions: ["appointments:view", "patients:view"],
        });
        const paths = items.map((item) => item.href);

        expect(paths).toContain("/dashboard");
        expect(paths).toContain("/appointments");
        expect(paths).toContain("/patients");
        expect(paths).toContain("/waitlist");
        expect(paths).not.toContain("/support");
        expect(paths).not.toContain("/finance");
        expect(paths).not.toContain("/dashboard/staff");
    });

    it("removes disabled clinic modules from every relevant role", () => {
        const staffItems = buildNavigation({
            roles: ["NURSE"],
            permissions: ["patients:view", "appointments:view", "inventory:view"],
            featureFlags: { enablePharmacy: false },
        });
        const patientItems = buildNavigation({
            roles: ["PATIENT"],
            featureFlags: { enablePharmacy: false, enableTelehealth: false },
        });

        expect(staffItems.map((item) => item.href)).not.toContain("/pharmacy");
        expect(patientItems.map((item) => item.href)).not.toContain("/portal/prescriptions");
        expect(patientItems.map((item) => item.href)).not.toContain("/portal/telehealth");
    });

    it("merges multiple staff roles without duplicating destinations", () => {
        const items = buildNavigation({
            roles: ["DOCTOR", "ADMIN"],
            permissions: undefined,
        });
        const paths = items.map((item) => item.href);

        expect(new Set(paths).size).toBe(paths.length);
        expect(paths).toContain("/doctor");
        expect(paths).toContain("/dashboard/staff");
    });

    it("keeps the mobile bar focused on four available high-frequency actions", () => {
        const items = buildNavigation({
            roles: ["BILLING_STAFF"],
            permissions: ["billing:view", "reports:view", "patients:view", "appointments:view"],
        });
        const mobileItems = buildMobileNavigation(items, "BILLING_STAFF");

        expect(mobileItems.map((item) => item.href)).toEqual([
            "/finance",
            "/finance/invoices",
            "/insurance",
            "/analytics",
        ]);
    });
});
