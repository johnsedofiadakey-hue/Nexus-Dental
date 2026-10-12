import type { Env } from "@/lib/config/deployment";

/** Distinctive sentinels so tests can prove a value never leaks into any output. */
export const SECRETS = {
    DATABASE_URL: "postgresql://sentinel_user:SENTINEL-DB-PASSWORD-9f3a@db.sentinel.example:5432/sentinel_db",
    JWT_SECRET: "SENTINEL-JWT-SECRET-0123456789abcdef0123456789abcdef",
    REDIS_URL: "rediss://default:SENTINEL-REDIS-PASSWORD-77b1@redis.sentinel.example:6380",
    PAYSTACK_SECRET_KEY: "sk_test_SENTINEL_PAYSTACK_SECRET_4c2d",
    HUBTEL_CLIENT_SECRET: "SENTINEL-HUBTEL-SECRET-5e8f",
    RESEND_API_KEY: "re_SENTINEL_RESEND_KEY_1a2b",
    NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSENTINELFIREBASEKEY0000000000000000",
} as const;

/** A fully valid single-clinic environment matching clients/example/clinic.yaml. */
export function validEnv(overrides: Env = {}): Env {
    return {
        NODE_ENV: "production",
        DEPLOYMENT_MODE: "single_clinic",
        DATABASE_URL: SECRETS.DATABASE_URL,
        JWT_SECRET: SECRETS.JWT_SECRET,
        CLINIC_ID: "example-dental-clinic",
        REDIS_URL: SECRETS.REDIS_URL,
        NEXT_PUBLIC_APP_URL: "https://app.example-dental.test",
        NEXT_PUBLIC_FIREBASE_API_KEY: SECRETS.NEXT_PUBLIC_FIREBASE_API_KEY,
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "example-dental-rehearsal.firebaseapp.com",
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: "example-dental-rehearsal",
        NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789:web:abcdef",
        FIREBASE_STORAGE_BUCKET: "example-dental-rehearsal.appspot.com",
        ENABLED_FEATURES: "paystack,hubtel,resend",
        PAYSTACK_SECRET_KEY: SECRETS.PAYSTACK_SECRET_KEY,
        NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: "pk_test_sentinel_public",
        HUBTEL_CLIENT_ID: "sentinel-hubtel-id",
        HUBTEL_CLIENT_SECRET: SECRETS.HUBTEL_CLIENT_SECRET,
        HUBTEL_SENDER_ID: "ExampleDental",
        RESEND_API_KEY: SECRETS.RESEND_API_KEY,
        EMAIL_FROM: "Example Dental <noreply@example-dental.test>",
        ...overrides,
    };
}

/** Remove keys (set to undefined) from an env. */
export function without(env: Env, ...keys: string[]): Env {
    const copy = { ...env };
    for (const k of keys) delete copy[k];
    return copy;
}
