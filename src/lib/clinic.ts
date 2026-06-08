// Single-clinic configuration. Set CLINIC_ID in your .env to the tenant ID
// created when you first ran the seed script.
export function getClinicId(): string {
    const id = process.env.CLINIC_ID || "airport-hills-dental";
    return id;
}
