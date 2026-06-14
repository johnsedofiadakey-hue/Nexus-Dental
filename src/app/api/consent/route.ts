// ============================================
// NEXUS DENTAL — Consent Templates API
// GET  /api/consent?tenantId=X        — list templates (global + tenant)
// POST /api/consent                   — create custom template
// GET  /api/consent/patient?...       — list signed consents for a patient
// POST /api/consent/sign              — patient signs a consent
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
  requireAuth,
  apiError,
  apiSuccess,
} from "@/lib/auth";
import { getTenantIdFromUser } from "@/lib/clinic";

// ── GET /api/consent ─────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;
    const { user } = authResult;

    const tenantId = getTenantIdFromUser(user);

    // Return global templates (tenantId IS NULL) + tenant-specific ones
    const templates = await prisma.consentTemplate.findMany({
      where: {
        isActive: true,
        OR: [{ tenantId: null }, { tenantId }],
      },
      orderBy: [{ tenantId: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        tenantId: true,
        title: true,
        category: true,
        content: true,
        version: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return apiSuccess({ templates });
  } catch (err) {
    console.error("[GET /api/consent]", err);
    return apiError("Failed to fetch consent templates", 500);
  }
}

// ── POST /api/consent ─────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;
    const { user } = authResult;

    const body = await request.json() as {
      tenantId?: string;
      title?: string;
      category?: string;
      content?: string;
    };

    const tenantId = getTenantIdFromUser(user);
    const { title, category, content } = body;

    if (!title) return apiError("title is required", 400);
    if (!category) return apiError("category is required", 400);
    if (!content) return apiError("content is required", 400);

    const template = await prisma.consentTemplate.create({
      data: {
        tenantId,
        title,
        category,
        content,
        version: 1,
        isActive: true,
      },
    });

    return apiSuccess({ template }, 201);
  } catch (err) {
    console.error("[POST /api/consent]", err);
    return apiError("Failed to create consent template", 500);
  }
}
