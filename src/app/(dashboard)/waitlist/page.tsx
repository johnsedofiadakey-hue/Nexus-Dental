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
  Plus, Loader2, X, Clock, Trash2, Bell, UserX,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WaitlistPatient {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface WaitlistEntry {
  id: string;
  patientId: string;
  serviceId?: string | null;
  doctorId?: string | null;
  preferredDates: string[];
  notes?: string | null;
  notifiedAt?: string | null;
  bookedAt?: string | null;
  createdAt: string;
  patient: WaitlistPatient;
  service?: { id: string; name: string } | null;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface Service {
  id: string;
  name: string;
}

interface StaffUser {
  id: string;
  firstName: string;
  lastName: string;
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function fetchWaitlist(): Promise<WaitlistEntry[]> {
  const res = await fetch("/api/waitlist", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch waitlist");
  const json = await res.json();
  return json.data as WaitlistEntry[];
}

async function fetchPatients(search: string): Promise<Patient[]> {
  const params = new URLSearchParams({ search, limit: "20" });
  const res = await fetch(`/api/patients?${params}`, { credentials: "include" });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data?.patients ?? []) as Patient[];
}

async function fetchServices(): Promise<Service[]> {
  const res = await fetch("/api/services", { credentials: "include" });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data ?? []) as Service[];
}

async function fetchDoctors(): Promise<StaffUser[]> {
  const res = await fetch("/api/staff?role=DOCTOR", { credentials: "include" });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data ?? []) as StaffUser[];
}

async function addToWaitlist(payload: {
  patientId: string;
  serviceId?: string;
  doctorId?: string;
  preferredDates: string[];
  notes?: string;
}) {
  const res = await fetch("/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.message || "Failed to add to waitlist");
  }
  return res.json();
}

async function patchWaitlist(id: string, action: "notify" | "book") {
  const res = await fetch("/api/waitlist", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ id, action }),
  });
  if (!res.ok) throw new Error("Failed to update waitlist");
  return res.json();
}

async function removeFromWaitlist(id: string) {
  const res = await fetch(`/api/waitlist?id=${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to remove");
  return res.json();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function timeSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function getStatus(entry: WaitlistEntry): "Booked" | "Notified" | "Waiting" {
  if (entry.bookedAt) return "Booked";
  if (entry.notifiedAt) return "Notified";
  return "Waiting";
}

const STATUS_COLORS: Record<string, string> = {
  Waiting: "bg-amber-100 text-amber-700",
  Notified: "bg-blue-100 text-blue-700",
  Booked: "bg-teal-100 text-teal-700",
};

// ─── SMS Compose Modal ────────────────────────────────────────────────────────

function SMSModal({
  patient,
  onClose,
}: {
  patient: WaitlistPatient;
  onClose: () => void;
}) {
  const message = `Hello ${patient.firstName}, we have an opening available at our clinic! Please call us or reply to confirm your appointment. Thank you!`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Notify Patient</h2>
        <p className="text-sm text-slate-500 mb-4">
          SMS to {patient.firstName} {patient.lastName} · {patient.phone}
        </p>
        <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed">
          {message}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          This message would be sent via your SMS provider.
        </p>
        <div className="flex gap-3 mt-5">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button
            className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
            onClick={onClose}
          >
            Send SMS
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Add to Waitlist Modal ────────────────────────────────────────────────────

function AddWaitlistModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [dates, setDates] = useState<string[]>([""]);
  const [notes, setNotes] = useState("");

  const { data: patients } = useQuery({
    queryKey: ["patients-search", patientSearch],
    queryFn: () => fetchPatients(patientSearch),
    enabled: patientSearch.length > 1,
  });

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: fetchServices,
  });

  const { data: doctors } = useQuery({
    queryKey: ["doctors"],
    queryFn: fetchDoctors,
  });

  const mutation = useMutation({
    mutationFn: () =>
      addToWaitlist({
        patientId: selectedPatient!.id,
        serviceId: serviceId || undefined,
        doctorId: doctorId || undefined,
        preferredDates: dates.filter(Boolean),
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success("Patient added to waitlist");
      onAdded();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function addDateField() {
    setDates((prev) => [...prev, ""]);
  }

  function setDate(i: number, val: string) {
    setDates((prev) => prev.map((d, idx) => (idx === i ? val : d)));
  }

  function removeDate(i: number) {
    setDates((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold text-slate-800 mb-5">
          Add to Waitlist
        </h2>

        <div className="space-y-4">
          {/* Patient Search */}
          <div>
            <label className="text-sm font-medium text-slate-600 block mb-1">
              Patient
            </label>
            {selectedPatient ? (
              <div className="flex items-center justify-between bg-teal-50 rounded-lg px-3 py-2">
                <span className="text-sm font-medium text-teal-800">
                  {selectedPatient.firstName} {selectedPatient.lastName} ·{" "}
                  {selectedPatient.phone}
                </span>
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="text-teal-500 hover:text-teal-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search patient name or phone..."
                />
                {patients && patients.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {patients.map((p) => (
                      <button
                        key={p.id}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm"
                        onClick={() => {
                          setSelectedPatient(p);
                          setPatientSearch("");
                        }}
                      >
                        <span className="font-medium">
                          {p.firstName} {p.lastName}
                        </span>
                        <span className="text-slate-400 ml-2">{p.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Service */}
          <div>
            <label className="text-sm font-medium text-slate-600 block mb-1">
              Service (optional)
            </label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            >
              <option value="">— Any service —</option>
              {(services ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Doctor */}
          <div>
            <label className="text-sm font-medium text-slate-600 block mb-1">
              Doctor Preference (optional)
            </label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
            >
              <option value="">— Any doctor —</option>
              {(doctors ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.firstName} {d.lastName}
                </option>
              ))}
            </select>
          </div>

          {/* Preferred Dates */}
          <div>
            <label className="text-sm font-medium text-slate-600 block mb-1">
              Preferred Dates
            </label>
            <div className="space-y-2">
              {dates.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    type="date"
                    value={d}
                    onChange={(e) => setDate(i, e.target.value)}
                    className="flex-1"
                  />
                  {dates.length > 1 && (
                    <button
                      onClick={() => removeDate(i)}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addDateField}
                className="text-xs text-teal-600 hover:text-teal-800 font-medium"
              >
                + Add another date
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-slate-600 block mb-1">
              Notes (optional)
            </label>
            <textarea
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requirements or notes..."
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
            disabled={mutation.isPending || !selectedPatient}
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Add to Waitlist
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WaitlistPage() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [smsPatient, setSmsPatient] = useState<WaitlistPatient | null>(null);

  const { data: entries, isLoading } = useQuery<WaitlistEntry[]>({
    queryKey: ["waitlist"],
    queryFn: fetchWaitlist,
    enabled: !!user,
  });

  const notifyMutation = useMutation({
    mutationFn: (id: string) => patchWaitlist(id, "notify"),
    onSuccess: () => {
      toast.success("Patient marked as notified");
      queryClient.invalidateQueries({ queryKey: ["waitlist"] });
    },
    onError: () => toast.error("Failed to notify"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeFromWaitlist(id),
    onSuccess: () => {
      toast.success("Removed from waitlist");
      queryClient.invalidateQueries({ queryKey: ["waitlist"] });
    },
    onError: () => toast.error("Failed to remove"),
  });

  const waitingCount = (entries ?? []).filter(
    (e) => !e.bookedAt && !e.notifiedAt
  ).length;

  return (
    <DashboardLayout title="Waitlist">
      {showAddModal && (
        <AddWaitlistModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => queryClient.invalidateQueries({ queryKey: ["waitlist"] })}
        />
      )}

      {smsPatient && (
        <SMSModal patient={smsPatient} onClose={() => setSmsPatient(null)} />
      )}

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">Waitlist</h1>
            {waitingCount > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                {waitingCount} waiting
              </span>
            )}
          </div>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add to Waitlist
          </Button>
        </div>

        {/* List */}
        <Card className="ring-1 ring-slate-100 border-none shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
              </div>
            ) : !entries || entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                {/* Illustration placeholder */}
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <UserX className="h-10 w-10 text-slate-300" />
                </div>
                <p className="text-base font-semibold text-slate-500">
                  No patients waiting
                </p>
                <p className="text-sm mt-1">
                  Add patients to the waitlist to track availability requests.
                </p>
                <Button
                  className="mt-5 bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={() => setShowAddModal(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Patient
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {entries.map((entry) => {
                  const status = getStatus(entry);
                  const preferred = (entry.preferredDates as string[]).filter(
                    Boolean
                  );

                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors"
                    >
                      {/* Avatar */}
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-semibold">
                        {initials(
                          entry.patient.firstName,
                          entry.patient.lastName
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800">
                            {entry.patient.firstName} {entry.patient.lastName}
                          </span>
                          <Badge
                            className={`text-xs border-0 ${STATUS_COLORS[status]}`}
                          >
                            {status}
                          </Badge>
                        </div>

                        <p className="text-xs text-slate-500 mt-0.5">
                          {entry.patient.phone}
                        </p>

                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-slate-500">
                          {entry.service && (
                            <span>
                              Service:{" "}
                              <span className="text-slate-700 font-medium">
                                {entry.service.name}
                              </span>
                            </span>
                          )}
                          {preferred.length > 0 && (
                            <span>
                              Preferred:{" "}
                              <span className="text-slate-700">
                                {preferred.map(fmtDate).join(", ")}
                              </span>
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-slate-400">
                            <Clock className="h-3 w-3" />
                            Waiting {timeSince(entry.createdAt)}
                          </span>
                        </div>

                        {entry.notes && (
                          <p className="text-xs text-slate-400 mt-1 italic">
                            {entry.notes}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!entry.notifiedAt && !entry.bookedAt && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-8"
                            disabled={notifyMutation.isPending}
                            onClick={async () => {
                              await notifyMutation.mutateAsync(entry.id);
                              setSmsPatient(entry.patient);
                            }}
                          >
                            <Bell className="h-3.5 w-3.5 mr-1" />
                            Notify
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8 text-rose-500 border-rose-200 hover:bg-rose-50"
                          disabled={removeMutation.isPending}
                          onClick={() => removeMutation.mutate(entry.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
