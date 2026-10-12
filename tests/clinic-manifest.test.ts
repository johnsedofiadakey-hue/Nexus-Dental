/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures and database mocks are intentionally loosely typed */
import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { load as loadYaml } from "js-yaml";
import { loadManifestFile, ManifestError, parseManifest } from "@/lib/config/manifest";

const EXAMPLE = path.resolve(__dirname, "../clients/example/clinic.yaml");
const example = () => loadYaml(fs.readFileSync(EXAMPLE, "utf8")) as Record<string, any>;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function issuesFor(mutate: (m: any) => void): string[] {
    const m = clone(example());
    mutate(m);
    try {
        parseManifest(m);
        return [];
    } catch (e) {
        return (e as ManifestError).issues;
    }
}

describe("the shipped example manifest", () => {
    it("is valid", () => {
        const m = loadManifestFile(EXAMPLE);
        expect(m.clinic.id).toBe("example-dental-clinic");
        expect(m.features).toEqual(["paystack", "hubtel", "resend"]);
        expect(m.services).toHaveLength(2);
    });

    it("applies defaults for optional sections", () => {
        const minimal = {
            schemaVersion: 1,
            clinic: { id: "tiny-clinic", slug: "tiny", name: "Tiny", timezone: "Africa/Accra" },
            deployment: { environment: "development", appUrl: "http://localhost:3000" },
            infrastructure: { firebaseProjectId: "p", storageBucket: "b" },
            owner: { email: "o@tiny.test" },
        };
        const m = parseManifest(minimal);
        expect(m.features).toEqual([]);
        expect(m.services).toEqual([]);
        expect(m.owner.inviteExpiryHours).toBe(72);
    });
});

describe("manifest validation", () => {
    it("rejects any unknown key — so a secret cannot be added by accident", () => {
        expect(issuesFor((m) => (m.password = "hunter2")).join()).toMatch(/password|Unrecognized/i);
        expect(issuesFor((m) => (m.clinic.apiKey = "abc")).join()).toMatch(/apiKey|Unrecognized/i);
        expect(issuesFor((m) => (m.owner.password = "x")).length).toBeGreaterThan(0);
    });

    it("never echoes a rejected value back in the error text", () => {
        const text = issuesFor((m) => {
            m.password = "SENTINEL-MANIFEST-SECRET-123";
            m.clinic.id = "BAD ID SENTINEL-ID-999";
        }).join("\n");
        expect(text).not.toContain("SENTINEL-MANIFEST-SECRET-123");
        expect(text).not.toContain("SENTINEL-ID-999");
    });

    it.each([
        ["an id with uppercase", (m: any) => (m.clinic.id = "Example")],
        ["an id that is too short", (m: any) => (m.clinic.id = "ab")],
        ["an id with spaces", (m: any) => (m.clinic.id = "my clinic")],
        ["a slug with underscores", (m: any) => (m.clinic.slug = "my_clinic")],
        ["an unknown time zone", (m: any) => (m.clinic.timezone = "Mars/Olympus")],
        ["an invalid owner email", (m: any) => (m.owner.email = "not-an-email")],
        ["an unsupported schema version", (m: any) => (m.schemaVersion = 2)],
        ["an unknown environment", (m: any) => (m.deployment.environment = "staging")],
        ["an unknown feature", (m: any) => (m.features = ["teleport"])],
        ["a duplicate feature", (m: any) => (m.features = ["paystack", "paystack"])],
        ["a bad colour", (m: any) => (m.branding.primaryColor = "teal")],
        ["an out-of-range invite expiry", (m: any) => (m.owner.inviteExpiryHours = 9999)],
        ["a negative price", (m: any) => (m.services[0].price = -1)],
        ["an unknown service category", (m: any) => (m.services[0].category = "MAGIC")],
        ["a zero-minute service", (m: any) => (m.services[0].durationMinutes = 0)],
        ["duplicate service names (case-insensitive)", (m: any) => (m.services[1].name = m.services[0].name.toUpperCase())],
        ["a malformed opening time", (m: any) => (m.hours.monday.open = "8am")],
    ])("rejects %s", (_label, mutate) => {
        expect(issuesFor(mutate).length).toBeGreaterThan(0);
    });

    it("requires https for a production app URL", () => {
        const issues = issuesFor((m) => {
            m.deployment.environment = "production";
            m.deployment.appUrl = "http://app.example-dental.test";
        });
        expect(issues.join()).toMatch(/https/);
    });
});

describe("loadManifestFile", () => {
    it("reports an unreadable file and invalid YAML without crashing", () => {
        expect(() => loadManifestFile("/definitely/not/here.yaml")).toThrow(ManifestError);
        const bad = path.join(os.tmpdir(), `bad-manifest-${Date.now()}.yaml`);
        fs.writeFileSync(bad, "clinic: [unclosed");
        try {
            expect(() => loadManifestFile(bad)).toThrow(/not valid YAML/);
        } finally {
            fs.rmSync(bad, { force: true });
        }
    });
});
