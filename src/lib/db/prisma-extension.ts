import { Prisma } from "@prisma/client";

export function withAuditLogging(client: any) {
  return client.$extends({
    name: "audit-logger",
    query: {
      $allModels: {
        async $allOperations({ operation, model, args, query }: any) {
          const result = await query(args);

          if (["create", "update", "delete", "createMany", "updateMany", "deleteMany"].includes(operation)) {
            // Only log for important models
            const auditedModels = ["Patient", "Appointment", "Invoice", "User", "Tenant", "TreatmentPlan", "Prescription"];
            if (auditedModels.includes(model)) {
              
              // In a real app, you would extract userId from async local storage (Next.js server context)
              // Here we do a best effort or leave userId as "system" if not provided in args
              const userId = null;
              const tenantId = args.data?.tenantId || (result && result.tenantId) || null;
              const entityId = result?.id || "multiple";

              // Don't await the audit log to avoid blocking the main query response
              client.auditLog.create({
                data: {
                  tenantId,
                  userId,
                  action: operation.toUpperCase(),
                  entity: model,
                  entityId,
                  newValue: operation !== "delete" ? JSON.stringify(result) : null,
                  ipAddress: "internal",
                }
              }).catch((e: any) => console.error("Audit log failed", e));
            }
          }
          return result;
        },
      },
    },
  });
}
