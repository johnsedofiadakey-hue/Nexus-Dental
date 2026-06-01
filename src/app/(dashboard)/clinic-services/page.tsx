"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  PowerOff,
  Power,
  Clock,
  CalendarCheck,
  Stethoscope,
  TrendingUp,
  DollarSign,
  Activity,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

// ─── Types ───────────────────────────────────────────────────────────────────

type ServiceCategory =
  | "GENERAL"
  | "COSMETIC"
  | "ORTHODONTICS"
  | "RESTORATIVE"
  | "PEDIATRIC"
  | "EMERGENCY"
  | "CONSULTATION";

interface Service {
  id: string;
  name: string;
  description: string | null;
  category: ServiceCategory;
  price: number;
  duration: number;
  isActive: boolean;
  _count: { appointments: number };
}

interface ServiceFormData {
  name: string;
  category: ServiceCategory | "";
  description: string;
  price: string;
  duration: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_CATEGORIES: ServiceCategory[] = [
  "GENERAL",
  "COSMETIC",
  "ORTHODONTICS",
  "RESTORATIVE",
  "PEDIATRIC",
  "EMERGENCY",
  "CONSULTATION",
];

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  GENERAL: "General",
  COSMETIC: "Cosmetic",
  ORTHODONTICS: "Orthodontics",
  RESTORATIVE: "Restorative",
  PEDIATRIC: "Pediatric",
  EMERGENCY: "Emergency",
  CONSULTATION: "Consultation",
};

const CATEGORY_COLORS: Record<ServiceCategory, string> = {
  GENERAL: "bg-slate-100 text-slate-700",
  COSMETIC: "bg-pink-100 text-pink-700",
  ORTHODONTICS: "bg-violet-100 text-violet-700",
  RESTORATIVE: "bg-amber-100 text-amber-700",
  PEDIATRIC: "bg-sky-100 text-sky-700",
  EMERGENCY: "bg-red-100 text-red-700",
  CONSULTATION: "bg-teal-100 text-teal-700",
};

const EMPTY_FORM: ServiceFormData = {
  name: "",
  category: "",
  description: "",
  price: "",
  duration: "",
};

// ─── API helpers ─────────────────────────────────────────────────────────────

async function fetchServices(tenantId: string): Promise<Service[]> {
  const res = await fetch(
    `/api/services?tenantId=${tenantId}&includeInactive=true`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error("Failed to load services");
  const json = await res.json();
  return json.services as Service[];
}

async function createService(
  tenantId: string,
  body: Omit<ServiceFormData, "category"> & { category: ServiceCategory }
): Promise<Service> {
  const res = await fetch("/api/services", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenantId,
      name: body.name.trim(),
      description: body.description.trim() || undefined,
      category: body.category,
      price: parseFloat(body.price),
      duration: parseInt(body.duration, 10),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to create service");
  }
  return res.json();
}

async function updateService(
  id: string,
  body: Partial<{
    name: string;
    description: string;
    category: ServiceCategory;
    price: number;
    duration: number;
    isActive: boolean;
  }>
): Promise<Service> {
  const res = await fetch(`/api/services/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to update service");
  }
  return res.json();
}

async function deleteService(id: string): Promise<void> {
  const res = await fetch(`/api/services/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to deactivate service");
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-2xl">
      <CardContent className="p-5 flex items-start gap-4">
        <div className="p-2.5 rounded-xl bg-teal-50">
          <Icon className="w-5 h-5 text-teal-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
            {label}
          </p>
          <p className="text-2xl font-semibold text-slate-900 mt-0.5">
            {value}
          </p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function ServiceCardSkeleton() {
  return (
    <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-2xl">
      <CardContent className="p-5 space-y-3">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

function ServiceCard({
  service,
  onEdit,
  onToggle,
  isToggling,
}: {
  service: Service;
  onEdit: (s: Service) => void;
  onToggle: (s: Service) => void;
  isToggling: boolean;
}) {
  return (
    <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-2xl hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-5 flex flex-col h-full gap-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-slate-900 leading-tight">
            {service.name}
          </h3>
          <Badge
            className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border-0 ${
              service.isActive
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {service.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* Category */}
        <span
          className={`self-start text-xs font-medium px-2.5 py-0.5 rounded-full ${
            CATEGORY_COLORS[service.category]
          }`}
        >
          {CATEGORY_LABELS[service.category]}
        </span>

        {/* Description */}
        <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 flex-1">
          {service.description ?? (
            <span className="italic text-slate-400">No description</span>
          )}
        </p>

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          <span className="flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-teal-500" />
            <span className="font-semibold text-slate-800">
              GH₵{service.price.toFixed(2)}
            </span>
          </span>
          <span className="flex items-center gap-1 text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            {service.duration} min
          </span>
          <span className="flex items-center gap-1 text-slate-500">
            <CalendarCheck className="w-3.5 h-3.5" />
            {service._count.appointments} bookings
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 rounded-lg text-xs font-medium border-slate-200 hover:border-teal-300 hover:text-teal-600"
            onClick={() => onEdit(service)}
          >
            <Pencil className="w-3.5 h-3.5 mr-1.5" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={`flex-1 rounded-lg text-xs font-medium ${
              service.isActive
                ? "border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                : "border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300"
            }`}
            onClick={() => onToggle(service)}
            disabled={isToggling}
          >
            {service.isActive ? (
              <>
                <PowerOff className="w-3.5 h-3.5 mr-1.5" />
                Deactivate
              </>
            ) : (
              <>
                <Power className="w-3.5 h-3.5 mr-1.5" />
                Activate
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Service Form Modal ───────────────────────────────────────────────────────

function ServiceFormModal({
  open,
  onClose,
  onSubmit,
  initialData,
  isSubmitting,
  mode,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ServiceFormData) => void;
  initialData?: ServiceFormData;
  isSubmitting: boolean;
  mode: "add" | "edit";
}) {
  const [form, setForm] = useState<ServiceFormData>(
    initialData ?? EMPTY_FORM
  );

  // Sync when modal opens/closes or initialData changes
  useState(() => {
    setForm(initialData ?? EMPTY_FORM);
  });

  // Keep form in sync when modal opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) setForm(initialData ?? EMPTY_FORM);
    else onClose();
  };

  const set = (field: keyof ServiceFormData) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Service name is required");
      return;
    }
    if (!form.category) {
      toast.error("Please select a category");
      return;
    }
    const price = parseFloat(form.price);
    const duration = parseInt(form.duration, 10);
    if (isNaN(price) || price < 0) {
      toast.error("Enter a valid price");
      return;
    }
    if (isNaN(duration) || duration < 1) {
      toast.error("Duration must be at least 1 minute");
      return;
    }
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-slate-900 text-lg font-semibold">
            {mode === "add" ? "Add New Service" : "Edit Service"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label
              htmlFor="svc-name"
              className="text-sm font-medium text-slate-700"
            >
              Service Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="svc-name"
              placeholder="e.g. Teeth Whitening"
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              className="rounded-xl border-slate-200 focus-visible:ring-teal-500"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Category <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.category}
              onValueChange={(val) => set("category")(val)}
            >
              <SelectTrigger className="rounded-xl border-slate-200 focus:ring-teal-500">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {ALL_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label
              htmlFor="svc-desc"
              className="text-sm font-medium text-slate-700"
            >
              Description
            </Label>
            <Textarea
              id="svc-desc"
              placeholder="Brief description of the service…"
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              rows={3}
              className="rounded-xl border-slate-200 focus-visible:ring-teal-500 resize-none"
            />
          </div>

          {/* Price + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="svc-price"
                className="text-sm font-medium text-slate-700"
              >
                Price (GH₵) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="svc-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.price}
                onChange={(e) => set("price")(e.target.value)}
                className="rounded-xl border-slate-200 focus-visible:ring-teal-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="svc-duration"
                className="text-sm font-medium text-slate-700"
              >
                Duration (min) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="svc-duration"
                type="number"
                min="1"
                step="1"
                placeholder="30"
                value={form.duration}
                onChange={(e) => set("duration")(e.target.value)}
                className="rounded-xl border-slate-200 focus-visible:ring-teal-500"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl border-slate-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium"
            >
              {isSubmitting
                ? mode === "add"
                  ? "Creating…"
                  : "Saving…"
                : mode === "add"
                ? "Create Service"
                : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();

  const [activeCategory, setActiveCategory] = useState<
    ServiceCategory | "ALL"
  >("ALL");
  const [addOpen, setAddOpen] = useState(false);
  const [editService, setEditService] = useState<Service | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const tenantId = user?.tenantId ?? "";

  // ── Queries ──────────────────────────────────────────────────────────────

  const {
    data: services,
    isLoading,
    isError,
    error,
  } = useQuery<Service[], Error>({
    queryKey: ["services", tenantId],
    queryFn: () => fetchServices(tenantId),
    enabled: !!tenantId,
    staleTime: 30_000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["services", tenantId] });

  const createMutation = useMutation({
    mutationFn: (form: ServiceFormData) =>
      createService(tenantId, {
        ...form,
        category: form.category as ServiceCategory,
      }),
    onSuccess: () => {
      toast.success("Service created successfully");
      setAddOpen(false);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const editMutation = useMutation({
    mutationFn: ({
      id,
      form,
    }: {
      id: string;
      form: ServiceFormData;
    }) =>
      updateService(id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        category: form.category as ServiceCategory,
        price: parseFloat(form.price),
        duration: parseInt(form.duration, 10),
      }),
    onSuccess: () => {
      toast.success("Service updated");
      setEditService(null);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation<void, Error, Service>({
    mutationFn: async (service: Service) => {
      if (service.isActive) {
        await deleteService(service.id);
      } else {
        await updateService(service.id, { isActive: true });
      }
    },
    onMutate: (service) => setTogglingId(service.id),
    onSuccess: (_data, service) => {
      toast.success(
        service.isActive
          ? `"${service.name}" deactivated`
          : `"${service.name}" activated`
      );
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setTogglingId(null),
  });

  // ── Derived data ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!services) return [];
    if (activeCategory === "ALL") return services;
    return services.filter((s) => s.category === activeCategory);
  }, [services, activeCategory]);

  const stats = useMemo(() => {
    if (!services) return null;
    const active = services.filter((s) => s.isActive);
    const avgPrice =
      services.length > 0
        ? services.reduce((sum, s) => sum + s.price, 0) / services.length
        : 0;
    const totalBookings = services.reduce(
      (sum, s) => sum + s._count.appointments,
      0
    );
    return { total: services.length, active: active.length, avgPrice, totalBookings };
  }, [services]);

  // ── Category counts ───────────────────────────────────────────────────────

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<ServiceCategory | "ALL", number>> = {
      ALL: services?.length ?? 0,
    };
    ALL_CATEGORIES.forEach((cat) => {
      counts[cat] = services?.filter((s) => s.category === cat).length ?? 0;
    });
    return counts;
  }, [services]);

  // ── Edit form init ────────────────────────────────────────────────────────

  const editInitialData: ServiceFormData | undefined = editService
    ? {
        name: editService.name,
        category: editService.category,
        description: editService.description ?? "",
        price: editService.price.toString(),
        duration: editService.duration.toString(),
      }
    : undefined;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout title="Services">
      <div className="space-y-6 pb-10">
        {/* ── Page Header ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Services</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage the dental services offered at your clinic
            </p>
          </div>
          <Button
            onClick={() => setAddOpen(true)}
            className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Service
          </Button>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading || !stats ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card
                key={i}
                className="border-none shadow-sm ring-1 ring-slate-100 rounded-2xl"
              >
                <CardContent className="p-5">
                  <Skeleton className="h-4 w-2/3 mb-3" />
                  <Skeleton className="h-7 w-1/2" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <StatCard
                label="Total Services"
                value={stats.total}
                icon={Stethoscope}
                sub="All categories"
              />
              <StatCard
                label="Active Services"
                value={stats.active}
                icon={Activity}
                sub={`${stats.total - stats.active} inactive`}
              />
              <StatCard
                label="Average Price"
                value={`GH₵${stats.avgPrice.toFixed(2)}`}
                icon={TrendingUp}
                sub="Across all services"
              />
              <StatCard
                label="Total Bookings"
                value={stats.totalBookings.toLocaleString()}
                icon={CalendarCheck}
                sub="Lifetime appointments"
              />
            </>
          )}
        </div>

        {/* ── Category Filter Tabs ─────────────────────────────────────── */}
        <div className="flex gap-2 flex-wrap">
          {(["ALL", ...ALL_CATEGORIES] as const).map((cat) => {
            const isActive = activeCategory === cat;
            const count = categoryCounts[cat] ?? 0;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat === "ALL" ? "All" : CATEGORY_LABELS[cat]}
                <span
                  className={`ml-1.5 text-xs ${
                    isActive ? "text-teal-200" : "text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Services Grid ────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <ServiceCardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <Card className="border-none shadow-sm ring-1 ring-red-100 rounded-2xl">
            <CardContent className="p-8 text-center">
              <p className="text-red-500 font-medium">
                Failed to load services
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {(error as Error)?.message ?? "An unknown error occurred"}
              </p>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="border-none shadow-sm ring-1 ring-slate-100 rounded-2xl">
            <CardContent className="p-12 flex flex-col items-center text-center gap-3">
              <div className="p-4 rounded-2xl bg-slate-50">
                <Stethoscope className="w-8 h-8 text-slate-300" />
              </div>
              <p className="font-medium text-slate-700">No services found</p>
              <p className="text-sm text-slate-400 max-w-xs">
                {activeCategory === "ALL"
                  ? "Get started by adding your first service."
                  : `No services in the ${CATEGORY_LABELS[activeCategory as ServiceCategory]} category yet.`}
              </p>
              {activeCategory === "ALL" && (
                <Button
                  onClick={() => setAddOpen(true)}
                  className="mt-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add First Service
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onEdit={setEditService}
                onToggle={(s) => toggleMutation.mutate(s)}
                isToggling={togglingId === service.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Add Modal ─────────────────────────────────────────────────── */}
      <ServiceFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={(form) => createMutation.mutate(form)}
        isSubmitting={createMutation.isPending}
        mode="add"
      />

      {/* ── Edit Modal ────────────────────────────────────────────────── */}
      {editService && (
        <ServiceFormModal
          open={!!editService}
          onClose={() => setEditService(null)}
          onSubmit={(form) =>
            editMutation.mutate({ id: editService.id, form })
          }
          initialData={editInitialData}
          isSubmitting={editMutation.isPending}
          mode="edit"
        />
      )}
    </DashboardLayout>
  );
}
