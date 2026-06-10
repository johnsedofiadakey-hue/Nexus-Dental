require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    console.log('Connected to database for seeding...');

    // 1. Create Tenant (Airport Hills Dental)
    const tenant = await prisma.tenant.upsert({
      where: { id: 'airport-hills-dental' },
      update: {},
      create: {
        id: 'airport-hills-dental',
        name: 'Airport Hills Dental',
        slug: 'airport-hills',
        status: 'ACTIVE',
      },
    });
    console.log('Created/Verified Tenant: airport-hills-dental');

    // Clear old data for a fresh seed
    await prisma.supportTicket.deleteMany({});
    await prisma.inventoryItem.deleteMany({});
    await prisma.patient.deleteMany({});
    await prisma.appointmentTransition.deleteMany({});
    await prisma.appointment.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.service.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.userRoleMapping.deleteMany({ where: { user: { id: { in: ['sys-admin', 'owner-airport-hills', 'staff-receptionist', 'doc-1', 'doc-2'] } } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: ['sys-admin', 'owner-airport-hills', 'staff-receptionist', 'doc-1', 'doc-2'] } } });
    await prisma.user.deleteMany({ where: { id: { in: ['sys-admin', 'owner-airport-hills', 'staff-receptionist', 'doc-1', 'doc-2'] } } });

    console.log('Cleared old user accounts and services...');

    // 2. Create System Owner
    const hashedDevPassword = await bcrypt.hash('dev123', 12);
    await prisma.user.create({
      data: {
        id: 'sys-admin',
        email: 'dev@nexusdental.com',
        passwordHash: hashedDevPassword,
        firstName: 'Developer',
        lastName: 'Admin',
        status: 'ACTIVE',
        roles: { create: { systemRole: 'SYSTEM_OWNER' } }
      }
    });
    console.log('Created System Owner: dev@nexusdental.com');

    // 3. Create Clinic Owner
    const hashedAdminPassword = await bcrypt.hash('admin123', 12);
    await prisma.user.create({
      data: {
        id: 'owner-airport-hills',
        email: 'admin@nexusdental.com',
        passwordHash: hashedAdminPassword,
        firstName: 'Clinic',
        lastName: 'Administrator',
        status: 'ACTIVE',
        tenantId: tenant.id,
        roles: { create: { systemRole: 'CLINIC_OWNER' } }
      }
    });
    console.log('Created Clinic Owner: admin@nexusdental.com');

    // 4. Create Receptionist
    const hashedStaffPassword = await bcrypt.hash('staff123', 12);
    await prisma.user.create({
      data: {
        id: 'staff-receptionist',
        email: 'sarah@airporthills.com',
        passwordHash: hashedStaffPassword,
        firstName: 'Sarah',
        lastName: 'Johnson',
        status: 'ACTIVE',
        tenantId: tenant.id,
        roles: { create: { systemRole: 'RECEPTIONIST' } }
      }
    });
    console.log('Created Receptionist: sarah@airporthills.com');

    // 5. Create Doctors
    const hashedDocPassword = await bcrypt.hash('doc123', 12);
    await prisma.user.create({
      data: {
        id: 'doc-1',
        email: 'kwame@airporthills.com',
        passwordHash: hashedDocPassword,
        firstName: 'Kwame',
        lastName: 'Asante',
        specialty: 'General Dentistry',
        status: 'ACTIVE',
        tenantId: tenant.id,
        roles: { create: { systemRole: 'DOCTOR' } }
      }
    });

    await prisma.user.create({
      data: {
        id: 'doc-2',
        email: 'ama@airporthills.com',
        passwordHash: hashedDocPassword,
        firstName: 'Ama',
        lastName: 'Mensah',
        specialty: 'Cosmetic Dentistry',
        status: 'ACTIVE',
        tenantId: tenant.id,
        roles: { create: { systemRole: 'DOCTOR' } }
      }
    });
    console.log('Created Doctors: Kwame Asante, Ama Mensah');

    // 6. Create Services
    const services = [
      { name: "Dental Check-up & Cleaning", description: "Comprehensive oral examination with professional cleaning", category: "GENERAL", price: 150, duration: 30 },
      { name: "Teeth Whitening", description: "Professional in-office teeth whitening treatment", category: "COSMETIC", price: 450, duration: 60 },
      { name: "Root Canal Treatment", description: "Endodontic therapy to save damaged teeth", category: "RESTORATIVE", price: 800, duration: 90 },
      { name: "Dental Implant Consultation", description: "Assessment and planning for dental implants", category: "RESTORATIVE", price: 200, duration: 45 },
      { name: "Orthodontic Assessment", description: "Complete orthodontic evaluation with treatment planning", category: "ORTHODONTICS", price: 250, duration: 45 },
      { name: "Emergency Dental Care", description: "Urgent treatment for dental emergencies", category: "EMERGENCY", price: 300, duration: 30 },
      { name: "Pediatric Dental Visit", description: "Gentle dental care designed for children", category: "PEDIATRIC", price: 120, duration: 30 },
      { name: "Online Consultation", description: "Virtual dental consultation with our specialists", category: "CONSULTATION", price: 100, duration: 30 }
    ];

    for (const service of services) {
      await prisma.service.create({
        data: { ...service, tenantId: tenant.id, isActive: true }
      });
    }
    console.log('Created Services.');

    // 7. Create TenantSettings and TenantContent
    await prisma.tenantSettings.upsert({
      where: { tenantId: tenant.id },
      update: {},
      create: {
        tenantId: tenant.id,
        primaryColor: '#008080',
        secondaryColor: '#FFD700',
      }
    });

    await prisma.tenantContent.upsert({
      where: { tenantId: tenant.id },
      update: {},
      create: {
        tenantId: tenant.id,
        aboutPage: 'Airport Hills Dental provides world-class dental care in a comfortable, modern environment.',
      }
    });
    console.log('Created Tenant Settings and Content.');

    // 8. Create Dummy Patients (OTP-based auth — no passwordHash on Patient model)
    const patient1 = await prisma.patient.create({
      data: {
        id: 'patient-1',
        tenantId: tenant.id,
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+233241111111',
        dateOfBirth: new Date('1990-05-15'),
        gender: 'MALE',
        isVerified: true,
      }
    });
    const patient2 = await prisma.patient.create({
      data: {
        id: 'patient-2',
        tenantId: tenant.id,
        email: 'jane.smith@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+233242222222',
        dateOfBirth: new Date('1985-10-22'),
        gender: 'FEMALE',
        isVerified: true,
      }
    });
    console.log('Created Dummy Patients: John Doe, Jane Smith');

    // 9. Create Inventory Items
    await prisma.inventoryItem.create({
      data: {
        id: 'inv-1',
        tenantId: tenant.id,
        name: 'Amoxicillin 500mg',
        sku: 'AMX-500',
        quantity: 100,
        unit: 'capsules',
        threshold: 20,
      }
    });
    await prisma.inventoryItem.create({
      data: {
        id: 'inv-2',
        tenantId: tenant.id,
        name: 'Dental Syringe',
        sku: 'SYR-100',
        quantity: 50,
        unit: 'pieces',
        threshold: 10,
      }
    });
    console.log('Created Inventory Items.');

    // 10. Create Support Ticket
    await prisma.supportTicket.create({
      data: {
        id: 'ticket-1',
        tenantId: tenant.id,
        patientId: patient1.id,
        subject: 'Inquiry about teeth whitening',
        description: 'Hello, I would like to know how much the teeth whitening procedure costs and how long it takes.',
        issueType: 'INQUIRY',
        status: 'OPEN',
        severity: 'LOW',
        messages: {
          create: {
            senderId: patient1.id,
            senderRole: 'PATIENT',
            content: 'Hello, I would like to know how much the teeth whitening procedure costs and how long it takes.',
          }
        }
      }
    });
    console.log('Created Support Ticket.');

    console.log('\n✅ Seed complete! Default credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('System Owner:  dev@nexusdental.com     / dev123');
    console.log('Clinic Admin:  admin@nexusdental.com   / admin123');
    console.log('Receptionist:  sarah@airporthills.com  / staff123');
    console.log('Doctors:       kwame@airporthills.com  / doc123');
    console.log('               ama@airporthills.com    / doc123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
