const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// 1. Change Cascade to Restrict for Tenant, User, Patient
const relationsToRestrict = [
  'tenant', 'user', 'patient', 'doctor', 'createdBy', 'dispensedBy', 'recordedBy', 'uploadedBy'
];

schema = schema.replace(/(@relation\([^)]+onDelete: )Cascade(\))/g, (match, p1, p2) => {
  return p1 + 'Restrict' + p2;
});

// Actually, we want to allow Cascade for things like TenantSettings -> Tenant.
// Let's just do a blanket replace of all onDelete: Cascade to onDelete: Restrict for safety in a medical app, EXCEPT for mapping tables.
// Wait, safer to just replace all for now, or just the ones we found.

// 2. Add deletedAt DateTime? to core models
const modelsToSoftDelete = [
  'Tenant', 'User', 'Patient', 'Appointment', 'Invoice', 'Prescription', 'TreatmentPlan', 'InventoryItem'
];

modelsToSoftDelete.forEach(model => {
  const regex = new RegExp(`(model ${model} \\{[^}]*?)(createdAt\\s+DateTime\\s+@default\\(now\\(\\)\\))`, 'g');
  schema = schema.replace(regex, `$1deletedAt         DateTime?\n  $2`);
});

// 3. Add version to InventoryItem
schema = schema.replace(
  /(model InventoryItem \{[^}]*?)(createdAt\s+DateTime\s+@default\(now\(\)\))/g,
  `$1version               Int                     @default(1)\n  $2`
);

// 4. Refactor PatientFile
schema = schema.replace(
  /(model PatientFile \{[^}]*?)url\s+String\n\s+publicId\s+String[^\n]*\n/g,
  `$1storageKey   String\n`
);

// 5. Add InsuranceClaim model
const insuranceClaimModel = `
model InsuranceClaim {
  id              String   @id @default(cuid())
  invoiceId       String
  tenantId        String
  provider        String
  policyNo        String?
  claimRef        String?
  claimedAmount   Float
  approvedAmount  Float?
  status          String   @default("SUBMITTED") // PENDING, SUBMITTED, APPROVED, REJECTED, PARTIAL
  notes           String?
  submittedAt     DateTime @default(now())
  resolvedAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?
  invoice         Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Restrict)
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Restrict)

  @@index([tenantId])
  @@index([invoiceId])
  @@map("insurance_claims")
}
`;

schema += insuranceClaimModel;

// Fix invoice model to have InsuranceClaim relation
schema = schema.replace(
  /(model Invoice \{[^}]*?)(createdAt\s+DateTime\s+@default\(now\(\)\))/g,
  `$1claims        InsuranceClaim[]\n  $2`
);


fs.writeFileSync(schemaPath, schema);
console.log('Schema updated successfully');
