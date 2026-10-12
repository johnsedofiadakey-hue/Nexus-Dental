/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles are intentionally loosely typed */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
    BackupError,
    decryptBytes,
    generateKeyPair,
    parseRecipients,
    sha256Hex,
} from "@/lib/backup/crypto";
import { GcsDestination, LocalDestination, type BackupDestination } from "@/lib/backup/destinations";
import { backupKeys, runBackup, scrub, MIN_DUMP_BYTES, type BackupResult } from "@/lib/backup/pipeline";

const MARKER = "PLAINTEXT-MARKER-patient-Ama-Mensah-0244000000";
let work: string;
let dest: string;
let keys: { identity: string; recipient: string };

const fakeDump = (bytes = 5000) => async (_url: string, out: string) => {
    fs.writeFileSync(out, Buffer.concat([Buffer.from(MARKER), Buffer.alloc(bytes, 7)]));
};
const okValidate = async () => {};
const env = (over: Record<string, string | undefined> = {}) => ({ DATABASE_URL: "postgresql://u:pw@db.example:5432/x", BACKUP_AGE_RECIPIENT: keys.recipient, ...over });
const listAll = (dir: string): string[] =>
    fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listAll(path.join(dir, e.name)) : [path.join(dir, e.name)])) : [];

beforeEach(async () => {
    work = fs.mkdtempSync(path.join(os.tmpdir(), "bk-test-work-"));
    dest = fs.mkdtempSync(path.join(os.tmpdir(), "bk-test-dest-"));
    keys = await generateKeyPair();
});
afterEach(() => {
    fs.rmSync(work, { recursive: true, force: true });
    fs.rmSync(dest, { recursive: true, force: true });
});

const run = (over: Partial<Parameters<typeof runBackup>[0]> = {}) =>
    runBackup({ env: env(), destination: new LocalDestination(dest), dump: fakeDump(), validateDump: okValidate, tmpRoot: work, now: new Date("2026-10-05T03:00:00Z"), ...over });
const noTempLeft = () => expect(fs.readdirSync(work)).toEqual([]);
const nothingUploaded = () => expect(listAll(dest)).toEqual([]);

describe("recipients", () => {
    it("requires at least one public key and rejects anything else - never echoing it back", async () => {
        expect(() => parseRecipients(undefined)).toThrow(/unencrypted/);
        expect(() => parseRecipients("   ")).toThrow(BackupError);
        try {
            parseRecipients(keys.identity); // a private key pasted by mistake
            throw new Error("should have thrown");
        } catch (e: any) {
            expect(e.code).toBe("BAD_RECIPIENT");
            expect(e.message).not.toContain(keys.identity);
        }
        expect(parseRecipients(`${keys.recipient}, ${keys.recipient}`)).toHaveLength(2);
    });
});

describe("a successful run", () => {
    it("stores only ciphertext: the plaintext marker appears nowhere in the destination", async () => {
        const r = await run();
        expect(r.status).toBe("COMPLETED");
        const files = listAll(dest);
        expect(files.length).toBe(2); // backup + manifest
        for (const f of files) expect(fs.readFileSync(f).includes(Buffer.from(MARKER))).toBe(false);
    });

    it("the private key recovers the exact dump; the checksum describes the stored file", async () => {
        const r = await run();
        const stored = fs.readFileSync(path.join(dest, r.key!));
        expect(sha256Hex(stored)).toBe(r.sha256);
        expect(stored.byteLength).toBe(r.size);
        const plain = Buffer.from(await decryptBytes(stored, keys.identity));
        expect(plain.subarray(0, MARKER.length).toString()).toBe(MARKER);
    });

    it("a different private key cannot read it", async () => {
        const r = await run();
        const other = await generateKeyPair();
        await expect(decryptBytes(fs.readFileSync(path.join(dest, r.key!)), other.identity)).rejects.toMatchObject({ code: "DECRYPT_FAILED" });
    });

    it("writes a manifest with fingerprints but no key material, and daily/monthly layout", async () => {
        const first = await run({ now: new Date("2026-11-01T03:00:00Z") }); // 1st of month => monthly copy too
        const manifest = JSON.parse(fs.readFileSync(path.join(dest, `${first.key}.json`), "utf8"));
        expect(manifest).toMatchObject({ formatVersion: 1, sha256: first.sha256, encryption: "age" });
        expect(JSON.stringify(manifest)).not.toContain(keys.recipient);
        const all = listAll(dest).map((f) => path.relative(dest, f));
        expect(all.some((f) => f.startsWith("daily/2026-11-01/"))).toBe(true);
        expect(all.some((f) => f.startsWith("monthly/2026-11/"))).toBe(true);
        expect(backupKeys(new Date("2026-11-02T03:00:00Z")).monthly).toBeNull();
    });

    it("the plaintext dump is already gone from disk by the time anything is uploaded", async () => {
        const seen: string[][] = [];
        const spy: BackupDestination = {
            put: async (_key, filePath) => { seen.push(listAll(work).map((f) => path.basename(f))); return { size: fs.statSync(filePath).size }; },
            describe: () => "spy",
        };
        await run({ destination: spy });
        expect(seen.length).toBeGreaterThan(0);
        for (const files of seen) {
            expect(files).not.toContain("plain.dump");
            expect(files).toContain("backup.dump.age");
        }
    });

    it("leaves no temp files and reports exactly once", async () => {
        const report = vi.fn(async (result: BackupResult) => { void result; });
        await run({ report });
        noTempLeft();
        expect(report).toHaveBeenCalledTimes(1);
        expect(report.mock.calls[0][0].status).toBe("COMPLETED");
    });
});

describe("fail closed - nothing readable is ever uploaded", () => {
    const failure = async (over: Partial<Parameters<typeof runBackup>[0]>, code: string) => {
        const report = vi.fn(async (result: BackupResult) => { void result; });
        const r = await run({ report, ...over });
        expect(r.status).toBe("FAILED");
        expect(r.errorCode).toBe(code);
        expect(report).toHaveBeenCalledTimes(1);
        expect(report.mock.calls[0][0].status).toBe("FAILED");
        nothingUploaded();
        noTempLeft();
        return r;
    };

    it("no recipient configured: refuses BEFORE even making a dump", async () => {
        const dump = vi.fn(fakeDump());
        await failure({ env: env({ BACKUP_AGE_RECIPIENT: undefined }), dump }, "NO_RECIPIENT");
        expect(dump).not.toHaveBeenCalled();
    });

    it("bad recipient", async () => {
        await failure({ env: env({ BACKUP_AGE_RECIPIENT: "not-a-key" }) }, "BAD_RECIPIENT");
    });

    it("pg_dump fails", async () => {
        await failure({ dump: async () => { throw new BackupError("DUMP_FAILED", "boom"); } }, "DUMP_FAILED");
    });

    it("pg_dump produces nothing", async () => {
        await failure({ dump: async () => {} }, "DUMP_FAILED");
    });

    it("a near-empty dump is not accepted as a backup", async () => {
        await failure({ dump: fakeDump(10) }, "DUMP_TOO_SMALL");
        expect(MIN_DUMP_BYTES).toBeGreaterThan(100);
    });

    it("an invalid archive is rejected", async () => {
        await failure({ validateDump: async () => { throw new BackupError("DUMP_INVALID", "bad"); } }, "DUMP_INVALID");
    });

    it("upload failure", async () => {
        const broken: BackupDestination = { put: async () => { throw new Error("network down postgresql://u:secret@h/db"); }, describe: () => "broken" };
        const r = await failure({ destination: broken }, "UPLOAD_FAILED");
        expect(r.errorMessage).not.toContain("secret");
    });

    it("a store that confirms a different size than we sent fails verification (no read access needed to notice)", async () => {
        const lying: BackupDestination = { put: async () => ({ size: 1 }), describe: () => "lying" };
        await failure({ destination: lying }, "VERIFY_FAILED");
    });

    it("a failing report callback does not turn a stored backup into a failure", async () => {
        const r = await run({ report: async () => { throw new Error("app down"); } });
        expect(r.status).toBe("COMPLETED");
    });

    it("never falls back to plaintext when encryption fails", async () => {
        vi.resetModules();
        vi.doMock("@/lib/backup/crypto", async (orig) => {
            const real = await orig<typeof import("@/lib/backup/crypto")>();
            return { ...real, encryptBytes: async () => { throw new real.BackupError("ENCRYPT_FAILED", "x"); } };
        });
        const { runBackup: runMocked } = await import("@/lib/backup/pipeline");
        const r = await runMocked({ env: env(), destination: new LocalDestination(dest), dump: fakeDump(), validateDump: okValidate, tmpRoot: work });
        vi.doUnmock("@/lib/backup/crypto");
        expect(r.errorCode).toBe("ENCRYPT_FAILED");
        nothingUploaded();
        noTempLeft();
    });
});

describe("upload credential boundary", () => {
    it("the destination interface can only create: no get, size, list or delete exists on either implementation", () => {
        for (const impl of [LocalDestination.prototype, GcsDestination.prototype]) {
            const methods = Object.getOwnPropertyNames(impl).filter((n) => n !== "constructor");
            for (const forbidden of ["get", "size", "list", "download", "delete", "remove", "read", "exists"]) {
                expect(methods, `${impl.constructor.name}.${forbidden}`).not.toContain(forbidden);
            }
            expect(methods).toContain("put");
        }
    });

    it("a backup completes and is verified with ONLY put() available", async () => {
        const putOnly: BackupDestination = { put: async (_k, f) => ({ size: fs.statSync(f).size }), describe: () => "put-only" };
        expect((await run({ destination: putOnly })).status).toBe("COMPLETED");
    });

    it("never overwrites an existing backup", async () => {
        const local = new LocalDestination(dest);
        const f = path.join(work, "x.bin");
        fs.writeFileSync(f, "one");
        await local.put("daily/2026-10-05/a.dump.age", f);
        await expect(local.put("daily/2026-10-05/a.dump.age", f)).rejects.toThrow();
    });
});

describe("helpers", () => {
    it("scrub removes connection strings from messages", () => {
        expect(scrub("failed postgresql://user:pw@host:5432/db now")).toBe("failed <url> now");
    });

    it("LocalDestination refuses a key that escapes its root", async () => {
        await expect(new LocalDestination(dest).put("../evil", __filename)).rejects.toMatchObject({ code: "UPLOAD_FAILED" });
    });
});
