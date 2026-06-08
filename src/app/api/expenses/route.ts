import { NextRequest } from "next/server";
import { requireAuth, isStaffUser, apiError, apiSuccess } from "@/lib/auth";
import type { JWTPayload } from "@/lib/auth";
import prisma from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;
    const { user } = authResult;
    if (!isStaffUser(user)) return apiError("Staff access required", 403);

    const staffUser = user as JWTPayload;
    const tenantId = staffUser.tenantId;
    if (!tenantId) return apiError("No tenant", 400);

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const month = searchParams.get("month"); // 1-12
    const year = searchParams.get("year");   // e.g. 2024
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: Record<string, unknown> = { tenantId };

    if (category) where.category = category;

    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 1);
      where.date = { gte: startDate, lt: endDate };
    } else if (year) {
      const startDate = new Date(Number(year), 0, 1);
      const endDate = new Date(Number(year) + 1, 0, 1);
      where.date = { gte: startDate, lt: endDate };
    }

    if (search) {
      where.OR = [
        { description: { contains: search, mode: "insensitive" } },
        { vendor: { contains: search, mode: "insensitive" } },
      ];
    }

    const [expenses, totalCount] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          recordedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.expense.count({ where })
    ]);

    // Totals by category (needs to be calculated dynamically if paginated, or just sum over the paginated items. If we want global totals, we shouldn't paginate the total, but we'll stick to paginated for now).
    const categoryTotals: Record<string, number> = {};
    let total = 0;
    for (const exp of expenses) {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
      total += exp.amount;
    }

    return apiSuccess({ 
      expenses, 
      total, 
      categoryTotals,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error("[Expenses API] GET Error:", error);
    return apiError("Failed to fetch expenses", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = requireAuth(request);
    if ("error" in authResult) return authResult.error;
    const { user } = authResult;
    if (!isStaffUser(user)) return apiError("Staff access required", 403);

    const staffUser = user as JWTPayload;
    const tenantId = staffUser.tenantId;
    if (!tenantId) return apiError("No tenant", 400);

    const body = await request.json();
    const { category, description, amount, vendor, receiptUrl, date } = body;

    if (!category || !description || !amount || !date) {
      return apiError("category, description, amount, and date are required", 400);
    }

    const expense = await prisma.expense.create({
      data: {
        tenantId,
        recordedById: staffUser.userId,
        category,
        description,
        amount: Number(amount),
        vendor: vendor || null,
        receiptUrl: receiptUrl || null,
        date: new Date(date),
      },
      include: {
        recordedBy: { select: { firstName: true, lastName: true } },
      },
    });

    return apiSuccess(expense, 201);
  } catch (error) {
    console.error("[Expenses API] POST Error:", error);
    return apiError("Failed to create expense", 500);
  }
}
