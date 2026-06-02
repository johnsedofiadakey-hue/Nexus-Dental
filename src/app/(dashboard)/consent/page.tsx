"use client";

import { useState, useCallback } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  FileText,
  Plus,
  Search,
  Pencil,
  Trash2,
  ShieldCheck,
  Loader2,
  PenLine,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { ConsentSigner } from "@/components/dental/ConsentSigner";

// ─── Types ────────────────────────────────────────────────────────────────────

type ConsentCategory =
  | "TREATMENT"
  | "ANAESTHESIA"
  | "PHOTO"
  | "GENERAL"
  | "REFERRAL";

interface ConsentTemplate {
  id: string;
  tenantId: string | null;
  title: string;
  category: ConsentCategory;
  content: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PatientConsent {
  id: string;
  patientId: string;
  templateId: string;
  signatureData: string;
  signedAt: string;
  ipAddress: string | null;
  template: {
    id: string;
    title: string;
    category: ConsentCategory;
    version: number;
  };
  patient: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
}

type ConsentStatus = "SIGNED" | "PENDING";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: ConsentCategory[] = [
  "TREATMENT",
  "ANAESTHESIA",
  "PHOTO",
  "GENERAL",
  "REFERRAL",
];

const CATEGORY_LABEL: Record<ConsentCategory, string> = {
  TREATMENT: "Treatment",
  ANAESTHESIA: "Anaesthesia",
  PHOTO: "Photography",
  GENERAL: "General",
  REFERRAL: "Referral",
};

const CATEGORY_COLOR: Record<ConsentCategory, string> = {
  TREATMENT: "bg-blue-50 text-blue-700",
  ANAESTHESIA: "bg-purple-50 text-purple-700",
  PHOTO: "bg-pink-50 text-pink-700",
  GENERAL: "bg-slate-100 text-slate-600",
  REFERRAL: "bg-orange-50 text-orange-700",
};

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchTemplates(): Promise<ConsentTemplate[]> {
  const res = await fetch(`/api/consent`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch templates");
  const json = await res.json();
  return json.data.templates as ConsentTemplate[];
}

async function fetchPatients(
  search: string
): Promise<Patient[]> {
  const params = new URLSearchParams({ limit: "20" });
  if (search) params.set("search", search);
  const res = await fetch(`/api/patients?${params}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch patients");
  const json = await res.json();
  return (json.data?.patients ?? []) as Patient[];
}

async function fetchPatientConsents(
  patientId: string
): Promise<PatientConsent[]> {
  const params = new URLSearchParams({ patientId });
  const res = await fetch(`/api/consent/patient?${params}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch consents");
  const json = await res.json();
  return json.data.consents as PatientConsent[];
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ConsentStatus }) {
  const config: Record<ConsentStatus, { label: string; className: string }> = {
    SIGNED: { label: "Signed", className: "bg-emerald-50 text-emerald-700" },
    PENDING: { label: "Pending", className: "bg-amber-50 text-amber-700" },
  };
  const { label, className } = config[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

// ─── Template modal ───────────────────────────────────────────────────────────

interface TemplateFormState {
  title: string;
  category: ConsentCategory;
  content: string;
}

const EMPTY_FORM: TemplateFormState = {
  title: "",
  category: "GENERAL",
  content: "",
};

interface TemplateModalProps {
  open: boolean;
  onClose: () => void;
  editing: ConsentTemplate | null;
}

function TemplateModal({
  open,
  onClose,
  editing,
}: TemplateModalProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState<TemplateFormState>(
    editing
      ? { title: editing.title, category: editing.category, content: editing.content }
      : EMPTY_FORM
  );

  // Reset form when modal opens/closes or editing changes
  const resetForm = useCallback(() => {
    setForm(
      editing
        ? {
            title: editing.title,
            category: editing.category,
            content: editing.content,
          }
        : EMPTY_FORM
    );
  }, [editing]);

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormState) => {
      const res = await fetch("/api/consent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to create template");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Consent template created");
      qc.invalidateQueries({ queryKey: ["consent-templates"] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/consent/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to delete template");
      }
    },
    onSuccess: () => {
      toast.success("Template deleted");
      qc.invalidateQueries({ queryKey: ["consent-templates"] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit() {
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.content.trim()) return toast.error("Content is required");
    createMutation.mutate(form);
  }

  const isGlobal = editing?.tenantId === null;
  const isPending = createMutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          resetForm();
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-600" />
            {editing ? "View Template" : "New Consent Template"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isGlobal && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm text-blue-700">
              <Globe className="h-4 w-4 shrink-0" />
              This is a global system template and cannot be edited or deleted.
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Title</label>
            <Input
              placeholder="e.g. Root Canal Treatment Consent"
              value={form.title}
              disabled={isGlobal}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Category
            </label>
            <Select
              value={form.category}
              disabled={isGlobal}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, category: v as ConsentCategory }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_LABEL[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Consent Form Content
            </label>
            <Textarea
              placeholder="Enter the full text of the consent form that patients will read and sign..."
              value={form.content}
              disabled={isGlobal}
              rows={10}
              className="resize-none text-sm leading-relaxed"
              onChange={(e) =>
                setForm((f) => ({ ...f, content: e.target.value }))
              }
            />
            <p className="text-xs text-slate-400">
              {form.content.length} characters
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {editing && !isGlobal && (
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(editing.id)}
              disabled={deleteMutation.isPending}
              className="mr-auto"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {isGlobal ? "Close" : "Cancel"}
          </Button>
          {!isGlobal && (
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {editing ? "Save Changes" : "Create Template"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Signature request modal ──────────────────────────────────────────────────

interface SignatureModalProps {
  open: boolean;
  onClose: () => void;
  template: ConsentTemplate | null;
  patient: Patient | null;
}

function SignatureModal({
  open,
  onClose,
  template,
  patient,
}: SignatureModalProps) {
  const qc = useQueryClient();

  const signMutation = useMutation({
    mutationFn: async (signatureData: string) => {
      const res = await fetch("/api/consent/sign", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: template!.id,
          patientId: patient!.id,
          signatureData,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to record consent");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Consent signed successfully");
      qc.invalidateQueries({
        queryKey: ["patient-consents", patient!.id],
      });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!template || !patient) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-teal-600" />
            Request Signature
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {signMutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              <p className="text-sm">Recording consent...</p>
            </div>
          ) : (
            <ConsentSigner
              template={{ title: template.title, content: template.content }}
              patientName={`${patient.firstName} ${patient.lastName}`}
              onSign={(signatureDataUrl) => signMutation.mutate(signatureDataUrl)}
              onCancel={onClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────

function TemplatesTab() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ConsentTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["consent-templates"],
    queryFn: () => fetchTemplates(),
  });

  const filtered = templates.filter((t) => {
    const matchSearch =
      !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === "ALL" || t.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  function openNew() {
    setEditingTemplate(null);
    setModalOpen(true);
  }

  function openEdit(template: ConsentTemplate) {
    setEditingTemplate(template);
    setModalOpen(true);
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search templates..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          className="bg-teal-600 hover:bg-teal-700 text-white shrink-0"
          onClick={openNew}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-teal-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <FileText className="h-10 w-10" />
          <p className="text-sm font-medium">No templates found</p>
          <p className="text-xs">Create your first consent template to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((template) => (
            <div
              key={template.id}
              className="ring-1 ring-slate-100 border-none shadow-sm rounded-2xl bg-white p-5 flex items-start justify-between gap-4 hover:ring-teal-200 transition-all"
            >
              <div className="flex items-start gap-4 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-teal-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 text-sm">
                      {template.title}
                    </p>
                    {template.tenantId === null && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-50 rounded-full px-2 py-0.5 border border-slate-200">
                        <Globe className="h-3 w-3" />
                        Global
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLOR[template.category]}`}
                    >
                      {CATEGORY_LABEL[template.category]}
                    </span>
                    <span className="text-xs text-slate-400">
                      v{template.version}
                    </span>
                    <span className="text-xs text-slate-400">
                      Created {formatDate(template.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                    {template.content}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-slate-400 hover:text-teal-600"
                onClick={() => openEdit(template)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <TemplateModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingTemplate(null);
        }}
        editing={editingTemplate}
      />
    </>
  );
}

// ─── Patient Consents Tab ─────────────────────────────────────────────────────

interface MergedConsentRow {
  key: string;
  type: "signed" | "pending";
  template: ConsentTemplate;
  consent?: PatientConsent;
  patient: Patient;
}

function PatientConsentsTab() {
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [signModal, setSignModal] = useState<{
    template: ConsentTemplate;
    patient: Patient;
  } | null>(null);

  // Fetch patients for search
  const { data: patients = [], isFetching: patientsFetching } = useQuery({
    queryKey: ["patients-search", patientSearch],
    queryFn: () => fetchPatients(patientSearch),
    enabled: patientSearch.length >= 2,
  });

  // Fetch all consent templates (to show pending ones too)
  const { data: templates = [] } = useQuery({
    queryKey: ["consent-templates"],
    queryFn: () => fetchTemplates(),
  });

  // Fetch signed consents for selected patient
  const { data: signedConsents = [], isLoading: consentsLoading } = useQuery({
    queryKey: ["patient-consents", selectedPatient?.id],
    queryFn: () => fetchPatientConsents(selectedPatient!.id),
    enabled: !!selectedPatient,
  });

  // Merge: for selected patient, show all templates — signed ones with their record, unsigned as PENDING
  const rows: MergedConsentRow[] = selectedPatient
    ? templates.map((tpl) => {
        const consent = signedConsents.find((c) => c.templateId === tpl.id);
        return {
          key: tpl.id,
          type: consent ? "signed" : "pending",
          template: tpl,
          consent,
          patient: selectedPatient,
        };
      })
    : [];

  const filteredRows = rows.filter((row) => {
    if (statusFilter === "SIGNED") return row.type === "signed";
    if (statusFilter === "PENDING") return row.type === "pending";
    return true;
  });

  return (
    <>
      {/* Patient search */}
      <div className="ring-1 ring-slate-100 border-none shadow-sm rounded-2xl bg-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <h3 className="text-sm font-semibold text-slate-700">
            Select a Patient
          </h3>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name or email (min. 2 chars)..."
            className="pl-9"
            value={patientSearch}
            onChange={(e) => {
              setPatientSearch(e.target.value);
              if (selectedPatient) setSelectedPatient(null);
            }}
          />
          {patientsFetching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-teal-600" />
          )}
        </div>

        {/* Patient suggestions dropdown */}
        {patientSearch.length >= 2 && !selectedPatient && patients.length > 0 && (
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            {patients.map((p) => (
              <button
                key={p.id}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-teal-50 transition-colors text-left"
                onClick={() => {
                  setSelectedPatient(p);
                  setPatientSearch(`${p.firstName} ${p.lastName}`);
                }}
              >
                <div className="h-8 w-8 rounded-full bg-teal-100 text-teal-700 text-xs font-semibold flex items-center justify-center shrink-0">
                  {initials(p.firstName, p.lastName)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {p.firstName} {p.lastName}
                  </p>
                  <p className="text-xs text-slate-400">{p.phone}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {patientSearch.length >= 2 && !selectedPatient && !patientsFetching && patients.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-2">
            No patients found for &quot;{patientSearch}&quot;
          </p>
        )}
      </div>

      {/* Consents list */}
      {selectedPatient && (
        <>
          {/* Selected patient header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-teal-100 text-teal-700 font-semibold text-sm flex items-center justify-center">
                {initials(selectedPatient.firstName, selectedPatient.lastName)}
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </p>
                <p className="text-xs text-slate-400">{selectedPatient.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="SIGNED">Signed</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-slate-600 text-xs"
                onClick={() => {
                  setSelectedPatient(null);
                  setPatientSearch("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>

          {consentsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-teal-600" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
              <ShieldCheck className="h-10 w-10" />
              <p className="text-sm font-medium">No consents to display</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredRows.map((row) => (
                <div
                  key={row.key}
                  className="ring-1 ring-slate-100 border-none shadow-sm rounded-2xl bg-white p-5 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                        row.type === "signed"
                          ? "bg-emerald-50"
                          : "bg-amber-50"
                      }`}
                    >
                      {row.type === "signed" ? (
                        <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <PenLine className="h-5 w-5 text-amber-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm">
                        {row.template.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLOR[row.template.category]}`}
                        >
                          {CATEGORY_LABEL[row.template.category]}
                        </span>
                        {row.type === "signed" && row.consent && (
                          <span className="text-xs text-slate-400">
                            Signed {formatDate(row.consent.signedAt)}
                          </span>
                        )}
                        {row.type === "pending" && (
                          <span className="text-xs text-slate-400">
                            Not yet signed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge
                      status={row.type === "signed" ? "SIGNED" : "PENDING"}
                    />
                    {row.type === "pending" && (
                      <Button
                        size="sm"
                        className="bg-teal-600 hover:bg-teal-700 text-white h-8 text-xs"
                        onClick={() =>
                          setSignModal({
                            template: row.template,
                            patient: row.patient,
                          })
                        }
                      >
                        <PenLine className="h-3.5 w-3.5 mr-1.5" />
                        Request Signature
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Signature modal */}
      <SignatureModal
        open={!!signModal}
        onClose={() => setSignModal(null)}
        template={signModal?.template ?? null}
        patient={signModal?.patient ?? null}
      />
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConsentPage() {
  const { data: user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<"templates" | "patient-consents">("templates");

  return (
    <DashboardLayout title="Consent Forms">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Consent Forms
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage consent templates and track patient signatures.
            </p>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-teal-50 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-teal-600" />
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {(
            [
              { value: "templates", label: "Templates", icon: FileText },
              { value: "patient-consents", label: "Patient Consents", icon: PenLine },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === value
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="space-y-4">
          {activeTab === "templates" && <TemplatesTab />}
          {activeTab === "patient-consents" && <PatientConsentsTab />}
        </div>
      </div>
    </DashboardLayout>
  );
}
