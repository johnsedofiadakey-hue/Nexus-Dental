"use client";

import React, { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  User,
  Phone,
  Stethoscope,
  Plus,
  Trash2,
  Search,
  CheckCircle,
  AlertCircle,
  Activity,
  Users,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ─── Date helpers (no date-fns dependency) ─────────────────────────────────

function todayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addDaysToDate(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function formatDateLong(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateMedium(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Format local date as YYYY-MM-DD */
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(dateTimeStr: string): string {
  return new Date(dateTimeStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

interface Appointment {
  id: string;
  dateTime: string;
  status: AppointmentStatus;
  notes: string | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  doctor: {
    firstName: string;
    lastName: string;
    specialty: string;
  };
  services: {
    id: string;
    name: string;
    duration: number;
  }[];
}

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes: string;
}

interface CompleteSessionForm {
  clinicalNotes: string;
  medications: Medication[];
  prescriptionInstructions: string;
  generateInvoice: boolean;
  discount: string;
  invoiceNotes: string;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  SCHEDULED: "bg-slate-100 text-slate-700 border-slate-200",
  CONFIRMED: "bg-blue-50 text-blue-700 border-blue-200",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  NO_SHOW: "bg-rose-50 text-rose-700 border-rose-200",
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
};

function emptyMedication(): Medication {
  return { name: "", dosage: "", frequency: "", duration: "", notes: "" };
}

// ─── API hooks ────────────────────────────────────────────────────────────────

function useAppointments(
  tenantId: string | null,
  doctorId: string | undefined,
  date: Date
) {
  const dateKey = formatLocalDate(date);
  const dateFrom = `${dateKey}T00:00:00.000Z`;
  const dateTo = `${dateKey}T23:59:59.999Z`;

  return useQuery<Appointment[]>({
    queryKey: ["doctor-appointments", tenantId, doctorId, dateKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tenantId) params.set("tenantId", tenantId);
      if (doctorId) params.set("doctorId", doctorId);
      params.set("dateFrom", dateFrom);
      params.set("dateTo", dateTo);
      const res = await fetch(`/api/appointments?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch appointments");
      const json = await res.json();
      return json.appointments ?? [];
    },
    enabled: !!tenantId && !!doctorId,
    refetchInterval: 60_000,
  });
}

function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      appointmentId,
      status,
    }: {
      appointmentId: string;
      status: AppointmentStatus;
    }) => {
      const res = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || "Failed to update status"
        );
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor-appointments"] });
    },
  });
}

function useCompleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      appointmentId: string;
      clinicalNotes: string;
      medications: Medication[];
      prescriptionInstructions: string;
      generateInvoice: boolean;
      discount?: number;
      invoiceNotes?: string;
    }) => {
      const res = await fetch("/api/clinical/session/complete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || "Failed to complete session"
        );
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor-appointments"] });
    },
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <Card className="flex-1 min-w-0">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`rounded-xl p-3 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-slate-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AppointmentCard({
  appointment,
  onConfirm,
  onStart,
  onComplete,
  onNoShow,
  isLoading,
}: {
  appointment: Appointment;
  onConfirm: () => void;
  onStart: () => void;
  onComplete: () => void;
  onNoShow: () => void;
  isLoading: boolean;
}) {
  const { patient, services, status, dateTime } = appointment;
  const isActionable =
    status === "SCHEDULED" || status === "CONFIRMED" || status === "IN_PROGRESS";

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Time + patient info */}
          <div className="flex gap-4 flex-1 min-w-0">
            <div className="flex flex-col items-center pt-1 min-w-[52px]">
              <Clock className="w-4 h-4 text-teal-600 mb-1" />
              <span className="text-xs font-semibold text-teal-700 whitespace-nowrap">
                {formatTime(dateTime)}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-slate-900 truncate">
                  {patient.firstName} {patient.lastName}
                </span>
                <Badge
                  className={`text-xs border ${STATUS_COLORS[status]} shrink-0`}
                  variant="outline"
                >
                  {STATUS_LABELS[status]}
                </Badge>
              </div>

              <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-1">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span>{patient.phone}</span>
              </div>

              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                <Stethoscope className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                <span className="truncate">{services.map(s => s.name).join(", ")}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500 whitespace-nowrap">
                  {services.reduce((total, s) => total + s.duration, 0)} min
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          {isActionable && (
            <div className="flex flex-col gap-2 shrink-0">
              {status === "SCHEDULED" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-blue-200 text-blue-700 hover:bg-blue-50"
                  onClick={onConfirm}
                  disabled={isLoading}
                >
                  Confirm
                </Button>
              )}
              {status === "CONFIRMED" && (
                <Button
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={onStart}
                  disabled={isLoading}
                >
                  Start Session
                </Button>
              )}
              {status === "IN_PROGRESS" && (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={onComplete}
                  disabled={isLoading}
                >
                  Complete Session
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 text-xs"
                onClick={onNoShow}
                disabled={isLoading}
              >
                No Show
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Complete Session Modal ───────────────────────────────────────────────────

function CompleteSessionModal({
  appointment,
  open,
  onClose,
}: {
  appointment: Appointment | null;
  open: boolean;
  onClose: () => void;
}) {
  const completeSession = useCompleteSession();

  const [form, setForm] = useState<CompleteSessionForm>({
    clinicalNotes: "",
    medications: [],
    prescriptionInstructions: "",
    generateInvoice: false,
    discount: "",
    invoiceNotes: "",
  });

  React.useEffect(() => {
    if (open) {
      setForm({
        clinicalNotes: "",
        medications: [],
        prescriptionInstructions: "",
        generateInvoice: false,
        discount: "",
        invoiceNotes: "",
      });
    }
  }, [open]);

  const addMedication = useCallback(() => {
    setForm((f) => ({ ...f, medications: [...f.medications, emptyMedication()] }));
  }, []);

  const removeMedication = useCallback((idx: number) => {
    setForm((f) => ({
      ...f,
      medications: f.medications.filter((_, i) => i !== idx),
    }));
  }, []);

  const updateMedication = useCallback(
    (idx: number, field: keyof Medication, value: string) => {
      setForm((f) => {
        const meds = [...f.medications];
        meds[idx] = { ...meds[idx], [field]: value };
        return { ...f, medications: meds };
      });
    },
    []
  );

  const handleSubmit = async () => {
    if (!appointment) return;
    try {
      await completeSession.mutateAsync({
        appointmentId: appointment.id,
        clinicalNotes: form.clinicalNotes,
        medications: form.medications.filter((m) => m.name.trim()),
        prescriptionInstructions: form.prescriptionInstructions,
        generateInvoice: form.generateInvoice,
        discount: form.discount ? parseFloat(form.discount) : undefined,
        invoiceNotes: form.invoiceNotes || undefined,
      });
      toast.success("Session completed successfully");
      onClose();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to complete session"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-900">
            Complete Session
          </DialogTitle>
          {appointment && (
            <p className="text-sm text-slate-500 mt-1">
              {appointment.patient.firstName} {appointment.patient.lastName} ·{" "}
              {appointment.services.map(s => s.name).join(", ")}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Clinical Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              Clinical Notes
            </Label>
            <Textarea
              placeholder="Describe findings, procedures performed, and clinical observations..."
              className="min-h-[100px] resize-none"
              value={form.clinicalNotes}
              onChange={(e) =>
                setForm((f) => ({ ...f, clinicalNotes: e.target.value }))
              }
            />
          </div>

          {/* Medications */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-slate-700">
                Medications
              </Label>
              <Button
                size="sm"
                variant="outline"
                onClick={addMedication}
                className="h-8 text-xs border-teal-200 text-teal-700 hover:bg-teal-50"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Medication
              </Button>
            </div>

            {form.medications.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-3 border border-dashed border-slate-200 rounded-lg">
                No medications prescribed
              </p>
            )}

            {form.medications.map((med, idx) => (
              <div
                key={idx}
                className="border border-slate-200 rounded-xl p-4 space-y-3 relative"
              >
                <button
                  onClick={() => removeMedication(idx)}
                  className="absolute top-3 right-3 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="grid grid-cols-2 gap-3 pr-8">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Drug Name *</Label>
                    <Input
                      placeholder="e.g. Amoxicillin"
                      value={med.name}
                      onChange={(e) =>
                        updateMedication(idx, "name", e.target.value)
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Dosage</Label>
                    <Input
                      placeholder="e.g. 500mg"
                      value={med.dosage}
                      onChange={(e) =>
                        updateMedication(idx, "dosage", e.target.value)
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Frequency</Label>
                    <Input
                      placeholder="e.g. 3x daily"
                      value={med.frequency}
                      onChange={(e) =>
                        updateMedication(idx, "frequency", e.target.value)
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Duration</Label>
                    <Input
                      placeholder="e.g. 7 days"
                      value={med.duration}
                      onChange={(e) =>
                        updateMedication(idx, "duration", e.target.value)
                      }
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Notes</Label>
                  <Input
                    placeholder="Special instructions..."
                    value={med.notes}
                    onChange={(e) =>
                      updateMedication(idx, "notes", e.target.value)
                    }
                    className="h-9"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Prescription Instructions */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              Prescription Instructions
            </Label>
            <Textarea
              placeholder="General instructions for the patient..."
              className="min-h-[80px] resize-none"
              value={form.prescriptionInstructions}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  prescriptionInstructions: e.target.value,
                }))
              }
            />
          </div>

          {/* Invoice toggle */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Generate Invoice
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Create a billing invoice for this session
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    generateInvoice: !f.generateInvoice,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                  form.generateInvoice ? "bg-teal-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    form.generateInvoice ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {form.generateInvoice && (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Discount (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0"
                    value={form.discount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, discount: e.target.value }))
                    }
                    className="h-9 max-w-[140px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Invoice Notes</Label>
                  <Textarea
                    placeholder="Billing notes..."
                    className="min-h-[60px] resize-none"
                    value={form.invoiceNotes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, invoiceNotes: e.target.value }))
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={completeSession.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={completeSession.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {completeSession.isPending ? "Completing..." : "Complete Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = ["upcoming", "in-progress", "completed"] as const;
type Tab = (typeof TABS)[number];

export default function DoctorDashboardPage() {
  const { data: user } = useCurrentUser();

  const [selectedDate, setSelectedDate] = useState<Date>(() => todayLocal());
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [completeTarget, setCompleteTarget] = useState<Appointment | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: appointments = [], isLoading } = useAppointments(
    user?.tenantId ?? null,
    user?.id,
    selectedDate
  );

  const updateStatus = useUpdateStatus();

  const handleStatusUpdate = async (
    appointmentId: string,
    status: AppointmentStatus,
    label: string
  ) => {
    try {
      await updateStatus.mutateAsync({ appointmentId, status });
      toast.success(`Appointment ${label}`);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : `Failed to update appointment`
      );
    }
  };

  // Stat counts
  const todayTotal = appointments.length;
  const waiting = appointments.filter((a) => a.status === "SCHEDULED").length;
  const inProgress = appointments.filter((a) => a.status === "IN_PROGRESS").length;
  const completed = appointments.filter((a) => a.status === "COMPLETED").length;
  const noShows = appointments.filter((a) => a.status === "NO_SHOW").length;

  // Tab groups
  const upcoming = appointments.filter(
    (a) => a.status === "SCHEDULED" || a.status === "CONFIRMED"
  );
  const inProgressList = appointments.filter((a) => a.status === "IN_PROGRESS");
  const completedList = appointments.filter((a) => a.status === "COMPLETED");

  const tabData: Record<Tab, Appointment[]> = {
    upcoming,
    "in-progress": inProgressList,
    completed: completedList,
  };

  const tabLabels: Record<Tab, string> = {
    upcoming: `Upcoming (${upcoming.length})`,
    "in-progress": `In Progress (${inProgressList.length})`,
    completed: `Completed (${completedList.length})`,
  };

  // Sidebar patient search
  const searchResults =
    searchQuery.trim().length > 0
      ? appointments.filter((a) => {
          const q = searchQuery.toLowerCase();
          return (
            a.patient.firstName.toLowerCase().includes(q) ||
            a.patient.lastName.toLowerCase().includes(q) ||
            a.patient.phone.includes(q)
          );
        })
      : [];

  const isUpdating = updateStatus.isPending;

  const sortedTab = [...tabData[activeTab]].sort(
    (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
  );

  const sortedUpcoming = [...upcoming].sort(
    (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
  );

  return (
    <DashboardLayout title="My Schedule">
      <div className="flex flex-col gap-6">
        {/* ── Stats Row ─────────────────────────────────────────────────── */}
        <div className="flex gap-4 flex-wrap">
          <StatCard
            icon={Calendar}
            label="Today's Appointments"
            value={todayTotal}
            color="bg-teal-50 text-teal-600"
          />
          <StatCard
            icon={Users}
            label="Patients Waiting"
            value={waiting}
            color="bg-slate-100 text-slate-600"
          />
          <StatCard
            icon={Activity}
            label="In Progress"
            value={inProgress}
            color="bg-amber-50 text-amber-600"
          />
          <StatCard
            icon={CheckCircle}
            label="Completed Today"
            value={completed}
            color="bg-emerald-50 text-emerald-600"
          />
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div className="flex gap-6 items-start">
          {/* ── Queue ─────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            {/* Date Navigator */}
            <Card>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setSelectedDate((d) => addDaysToDate(d, -1))
                  }
                  className="h-9 w-9"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <div className="text-center">
                  <p className="text-lg font-semibold text-slate-900">
                    {formatDateLong(selectedDate)}
                  </p>
                  {isSameDay(selectedDate, todayLocal()) && (
                    <p className="text-xs text-teal-600 font-medium">Today</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!isSameDay(selectedDate, todayLocal()) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedDate(todayLocal())}
                      className="h-9 text-xs border-teal-200 text-teal-700 hover:bg-teal-50"
                    >
                      Today
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setSelectedDate((d) => addDaysToDate(d, 1))
                    }
                    className="h-9 w-9"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                    activeTab === tab
                      ? "border-teal-600 text-teal-700 bg-teal-50/50"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {tabLabels[tab]}
                </button>
              ))}
            </div>

            {/* Appointment list */}
            <div className="flex flex-col gap-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-5">
                      <div className="flex gap-4">
                        <Skeleton className="w-12 h-12 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-32" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                        <Skeleton className="h-8 w-24 rounded-lg" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : sortedTab.length === 0 ? (
                <Card>
                  <CardContent className="p-12 flex flex-col items-center gap-3 text-center">
                    <div className="rounded-full bg-slate-100 p-4">
                      <AlertCircle className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="font-medium text-slate-600">
                      No appointments here
                    </p>
                    <p className="text-sm text-slate-400">
                      {activeTab === "upcoming"
                        ? "No upcoming appointments for this date."
                        : activeTab === "in-progress"
                        ? "No sessions currently in progress."
                        : "No completed appointments yet."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                sortedTab.map((appt) => (
                  <AppointmentCard
                    key={appt.id}
                    appointment={appt}
                    isLoading={isUpdating}
                    onConfirm={() =>
                      handleStatusUpdate(appt.id, "CONFIRMED", "confirmed")
                    }
                    onStart={() =>
                      handleStatusUpdate(appt.id, "IN_PROGRESS", "started")
                    }
                    onComplete={() => setCompleteTarget(appt)}
                    onNoShow={() =>
                      handleStatusUpdate(
                        appt.id,
                        "NO_SHOW",
                        "marked as no-show"
                      )
                    }
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Right Sidebar ─────────────────────────────────────────── */}
          <div className="w-72 shrink-0 flex flex-col gap-4">
            {/* Patient Search */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-slate-800">
                  Quick Lookup
                </CardTitle>
                <CardDescription>Search today&apos;s patients</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <Input
                    placeholder="Name or phone..."
                    className="pl-9 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {searchQuery.trim() && (
                  <div className="space-y-1">
                    {searchResults.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">
                        No patients found
                      </p>
                    ) : (
                      searchResults.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-default"
                        >
                          <div className="rounded-full bg-teal-100 p-1.5 shrink-0 mt-0.5">
                            <User className="w-3 h-3 text-teal-700" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {a.patient.firstName} {a.patient.lastName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {a.patient.phone}
                            </p>
                            <p className="text-xs text-teal-600 mt-0.5">
                              {formatTime(a.dateTime)} · {a.services?.map(s => s.name).join(", ") ?? "Appointment"}
                            </p>
                            <Badge
                              className={`text-[10px] mt-1 border ${STATUS_COLORS[a.status]}`}
                              variant="outline"
                            >
                              {STATUS_LABELS[a.status]}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Day Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-slate-800">
                  Day Summary
                </CardTitle>
                <CardDescription>
                  {formatDateMedium(selectedDate)}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-4 w-full" />
                    ))}
                  </div>
                ) : (
                  <>
                    {[
                      { label: "Total", value: todayTotal, dot: "bg-slate-400" },
                      { label: "Waiting", value: waiting, dot: "bg-slate-400" },
                      {
                        label: "In Progress",
                        value: inProgress,
                        dot: "bg-amber-400",
                      },
                      {
                        label: "Completed",
                        value: completed,
                        dot: "bg-emerald-500",
                      },
                      {
                        label: "No Shows",
                        value: noShows,
                        dot: "bg-rose-400",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${item.dot}`}
                          />
                          <span className="text-sm text-slate-600">
                            {item.label}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-slate-900">
                          {item.value}
                        </span>
                      </div>
                    ))}

                    {todayTotal > 0 && (
                      <div className="pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-slate-500">
                            Completion rate
                          </span>
                          <span className="text-xs font-semibold text-teal-700">
                            {Math.round((completed / todayTotal) * 100)}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-500 rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.round(
                                (completed / todayTotal) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Next Up */}
            {sortedUpcoming.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-slate-800">
                    Next Up
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-1">
                  {sortedUpcoming.slice(0, 5).map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-default"
                    >
                      <div className="text-center min-w-[48px]">
                        <span className="text-xs font-bold text-teal-700">
                          {formatTime(a.dateTime)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {a.patient.firstName} {a.patient.lastName}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {a.services?.map(s => s.name).join(", ") ?? "Appointment"}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Complete Session Modal */}
      <CompleteSessionModal
        appointment={completeTarget}
        open={!!completeTarget}
        onClose={() => setCompleteTarget(null)}
      />
    </DashboardLayout>
  );
}
