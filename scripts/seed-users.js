const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
    const client = new Client({
        connectionString: "postgres://postgres:postgres@localhost:5432/nexusdental"
    });

    try {
        await client.connect();
        console.log('Connected to nexusdental database for seeding...');

        // 1. Create Tenant (Airport Hills Dental)
        // Settings field is used instead of branding based on schema.prisma
        await client.query(`
      INSERT INTO tenants (id, name, slug, status, settings, "createdAt", "updatedAt")
      VALUES ('airport-hills-dental', 'Airport Hills Dental', 'airport-hills', 'ACTIVE', '{"branding": {"primaryColor": "#008080", "secondaryColor": "#FFD700"}}', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `);
        console.log('Created/Verified Tenant: airport-hills-dental');

        // 2. Create System Owner
        const hashedAdminPassword = await bcrypt.hash('NexusAdmin2026!', 10);
        await client.query(`
      INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role, status, "createdAt", "updatedAt")
      VALUES ('sys-admin', 'admin@nexusdental.com', $1, 'Nexus', 'Admin', 'SYSTEM_OWNER', 'ACTIVE', NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET "passwordHash" = $1, status = 'ACTIVE';
    `, [hashedAdminPassword]);
        console.log('Created/Verified Admin: admin@nexusdental.com');

        // 3. Create Receptionist
        const hashedStaffPassword = await bcrypt.hash('StaffPass123', 10);
        await client.query(`
      INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role, status, "tenantId", "createdAt", "updatedAt")
      VALUES ('staff-receptionist', 'sarah@airporthills.com', $1, 'Sarah', 'Receptionist', 'RECEPTIONIST', 'ACTIVE', 'airport-hills-dental', NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET "passwordHash" = $1, status = 'ACTIVE';
    `, [hashedStaffPassword]);
        console.log('Created/Verified Staff: sarah@airporthills.com');

        console.log('Seed complete! Default credentials:');
        console.log('Admin: admin@nexusdental.com / NexusAdmin2026!');
        console.log('Staff: sarah@airporthills.com / StaffPass123');

    } catch (err) {
        console.error('Seed execution failed:', err);
    } finally {
        await client.end();
    }
}

main().catch(console.error);
