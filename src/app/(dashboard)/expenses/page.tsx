"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus, Loader2, TrendingDown, TrendingUp, X, Receipt,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  vendor?: string | null;
  receiptUrl?: string | null;
  date: string;
  recordedBy: { firstName: string; lastName: string };
}

interface ExpensesResponse {
  expenses: Expense[];
  total: number;
  categoryTotals: Record<string, number>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Rent",
  "Utilities",
  "Dental Supplies",
  "Equipment",
  "Medications",
  "Marketing",
  "Staff Costs",
  "Other",
];

const CATEGORY_COLORS: Record<string, string> = {
  Rent: "bg-slate-100 text-slate-700",
  Utilities: "bg-blue-100 text-blue-700",
  "Dental Supplies": "bg-teal-100 text-teal-700",
  Equipment: "bg-purple-100 text-purple-700",
  Medications: "bg-amber-100 text-amber-700",
  Marketing: "bg-pink-100 text-pink-700",
  "Staff Costs": "bg-indigo-100 text-indigo-700",
  Other: "bg-gray-100 text-gray-700",
};

const CATEGORY_BAR_COLORS: Record<string, string> = {
  Rent: "bg-slate-400",
  Utilities: "bg-blue-400",
  "Dental Supplies": "bg-teal-500",
  Equipment: "bg-purple-400",
  Medications: "bg-amber-400",
  Marketing: "bg-pink-400",
  "Staff Costs": "bg-indigo-400",
  Other: "bg-gray-400",
};

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function fetchExpenses(month: number, year: number): Promise<ExpensesResponse> {
  const params = new URLSearchParams({ month: String(month), year: String(year) });
  const res = await fetch(`/api/expenses?${params}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch expenses");
  const json = await res.json();
  return json.data as ExpensesResponse;
}

async function fetchRevenue(tenantId: string): Promise<number> {
  const res = await fetch(`/api/analytics/clinic?tenantId=${tenantId}`, {
    credentials: "include",
  });
  if (!res.ok) return 0;
  const json = await res.json();
  return (json.data?.clinic?.totalRevenue as number) ?? 0;
}

async function createExpense(payload: {
  category: string;
  description: string;
  amount: number;
  vendor?: string;
  receiptUrl?: string;
  date: string;
}) {
  const res = await fetch("/api/expenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.message || "Failed to create expense");
  }
  return res.json();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─── Add Expense Modal ────────────────────────────────────────────────────────

interface AddExpenseModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function AddExpenseModal({ onClose, onCreated }: AddExpenseModalProps) {
  const [form, setForm] = useState({
    category: CATEGORIES[0],
    description: "",
    amount: "",
    vendor: "",
    receiptUrl: "",
    date: new Date().toISOString().slice(0, 10),
  });

  const mutation = useMutation({
    mutationFn: () =>
      createExpense({
        category: form.category,
        description: form.description,
        amount: Number(form.amount),
        vendor: form.vendor || undefined,
        receiptUrl: form.receiptUrl || undefined,
        date: form.date,
      }),
    onSuccess: () => {
      toast.success("Expense recorded");
      onCreated();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold text-slate-800 mb-5">Add Expense</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-600 block mb-1">Category</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600 block mb-1">Description</label>
            <Input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. Monthly rent payment"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1">Amount (GHS)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 block mb-1">Date</label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600 block mb-1">Vendor (optional)</label>
            <Input
              value={form.vendor}
              onChange={(e) => set("vendor", e.target.value)}
              placeholder="Vendor name"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600 block mb-1">Receipt URL (optional)</label>
            <Input
              value={form.receiptUrl}
              onChange={(e) => set("receiptUrl", e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.description || !form.amount}
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Save Expense
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useQuery<ExpensesResponse>({
    queryKey: ["expenses", month, year],
    queryFn: () => fetchExpenses(month, year),
    enabled: !!user,
  });

  const { data: revenue } = useQuery<number>({
    queryKey: ["revenue", user?.tenantId],
    queryFn: () => fetchRevenue(user!.tenantId!),
    enabled: !!user?.tenantId,
  });

  const expenses = data?.expenses ?? [];
  const total = data?.total ?? 0;
  const categoryTotals = data?.categoryTotals ?? {};
  const netProfit = (revenue ?? 0) - total;

  // Top 3 categories by spend
  const topCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  // All categories for bar chart
  const allCategoryEntries = Object.entries(categoryTotals).sort(
    ([, a], [, b]) => b - a
  );

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <DashboardLayout title="Expenses">
      {showModal && (
        <AddExpenseModal
          onClose={() => setShowModal(false)}
          onCreated={() =>
            queryClient.invalidateQueries({ queryKey: ["expenses"] })
          }
        />
      )}

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Expense Tracker</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Track and manage clinic operating expenses
            </p>
          </div>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => setShowModal(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
        </div>

        {/* Month / Year Selector */}
        <div className="flex items-center gap-3">
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Expenses */}
          <Card className="ring-1 ring-slate-100 border-none shadow-sm col-span-2 md:col-span-1">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                Total Expenses
              </p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {isLoading ? "—" : fmt(total)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {MONTHS[month - 1]} {year}
              </p>
            </CardContent>
          </Card>

          {/* Top 3 category cards */}
          {topCategories.map(([cat, amt]) => (
            <Card key={cat} className="ring-1 ring-slate-100 border-none shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide truncate">
                  {cat}
                </p>
                <p className="text-xl font-bold text-slate-800 mt-1">{fmt(amt)}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {total > 0 ? ((amt / total) * 100).toFixed(0) : 0}% of total
                </p>
              </CardContent>
            </Card>
          ))}

          {/* Fill empty slots if fewer than 3 categories */}
          {Array.from({ length: Math.max(0, 3 - topCategories.length) }).map(
            (_, i) => (
              <Card
                key={`empty-${i}`}
                className="ring-1 ring-slate-100 border-none shadow-sm opacity-40"
              >
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                    —
                  </p>
                  <p className="text-xl font-bold text-slate-300 mt-1">GHS 0</p>
                </CardContent>
              </Card>
            )
          )}
        </div>

        {/* P&L Card */}
        <Card className="ring-1 ring-slate-100 border-none shadow-sm">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">
              Profit & Loss — {MONTHS[month - 1]} {year}
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-500 mb-1">Revenue</p>
                <p className="text-lg font-bold text-teal-600">
                  {fmt(revenue ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Expenses</p>
                <p className="text-lg font-bold text-rose-500">{fmt(total)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Net Profit</p>
                <div className="flex items-center justify-center gap-1">
                  {netProfit >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-teal-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-rose-500" />
                  )}
                  <p
                    className={`text-lg font-bold ${
                      netProfit >= 0 ? "text-teal-600" : "text-rose-500"
                    }`}
                  >
                    {fmt(Math.abs(netProfit))}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown Bar Chart */}
        {allCategoryEntries.length > 0 && (
          <Card className="ring-1 ring-slate-100 border-none shadow-sm">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">
                Category Breakdown
              </h3>
              <div className="space-y-3">
                {allCategoryEntries.map(([cat, amt]) => {
                  const pct = total > 0 ? (amt / total) * 100 : 0;
                  const barColor =
                    CATEGORY_BAR_COLORS[cat] ?? "bg-slate-300";
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-xs text-slate-600 mb-1">
                        <span>{cat}</span>
                        <span>
                          {fmt(amt)} ({pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Expense List */}
        <Card className="ring-1 ring-slate-100 border-none shadow-sm">
          <CardContent className="p-0">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700">
                Expense Records
              </h3>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
              </div>
            ) : expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Receipt className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">No expenses recorded</p>
                <p className="text-xs mt-1">
                  Add your first expense to start tracking
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {expenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center px-5 py-3.5 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {exp.description}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {exp.vendor ? `${exp.vendor} · ` : ""}
                        {fmtDate(exp.date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <Badge
                        className={`text-xs ${
                          CATEGORY_COLORS[exp.category] ?? "bg-gray-100 text-gray-700"
                        } border-0`}
                      >
                        {exp.category}
                      </Badge>
                      <span className="text-sm font-semibold text-slate-800 tabular-nums">
                        {fmt(exp.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
