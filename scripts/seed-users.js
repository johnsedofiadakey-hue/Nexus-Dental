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

    // Delete audit logs first (foreign key dependency)
    await client.query(`DELETE FROM audit_logs WHERE "userId" IN ('sys-admin', 'owner-airport-hills', 'staff-receptionist');`);

    // Delete old users to avoid conflicts (in case email changed)
    await client.query(`
      DELETE FROM users WHERE id IN ('sys-admin', 'owner-airport-hills', 'staff-receptionist');
    `);
    console.log('Cleared old user accounts...');

    // 2. Create System Owner (Developer Account)
    const hashedDevPassword = await bcrypt.hash('dev123', 10);
    await client.query(`
      INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role, status, "createdAt", "updatedAt")
      VALUES ('sys-admin', 'dev@nexusdental.com', $1, 'Developer', 'Admin', 'SYSTEM_OWNER', 'ACTIVE', NOW(), NOW());
    `, [hashedDevPassword]);
    console.log('Created/Verified System Owner: dev@nexusdental.com');

    // 3. Create Clinic Owner (Clinic Administrator)
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role, status, "tenantId", "createdAt", "updatedAt")
      VALUES ('owner-airport-hills', 'admin@nexusdental.com', $1, 'Clinic', 'Administrator', 'CLINIC_OWNER', 'ACTIVE', 'airport-hills-dental', NOW(), NOW());
    `, [hashedAdminPassword]);
    console.log('Created/Verified Clinic Owner: admin@nexusdental.com');

    // 4. Create Receptionist (Sample Staff)
    const hashedStaffPassword = await bcrypt.hash('staff123', 10);
    await client.query(`
      INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role, status, "tenantId", "createdAt", "updatedAt")
      VALUES ('staff-receptionist', 'sarah@airporthills.com', $1, 'Sarah', 'Johnson', 'RECEPTIONIST', 'ACTIVE', 'airport-hills-dental', NOW(), NOW());
    `, [hashedStaffPassword]);
    console.log('Created/Verified Receptionist: sarah@airporthills.com');

    console.log('\n✅ Seed complete! Default credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('System Owner (Developer): dev@nexusdental.com / dev123');
    console.log('Clinic Owner (Admin):     admin@nexusdental.com / admin123');
    console.log('Receptionist (Staff):     sarah@airporthills.com / staff123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (err) {
    console.error('Seed execution failed:', err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
