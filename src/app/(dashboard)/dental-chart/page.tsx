"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, X, ChevronDown } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { toast } from "sonner";

type ToothCondition =
    | "HEALTHY"
    | "CARIES"
    | "FILLED"
    | "CROWN"
    | "EXTRACTED"
    | "IMPLANT"
    | "MISSING"
    | "OTHER";

type ToothSurface =
    | "BUCCAL"
    | "LINGUAL"
    | "MESIAL"
    | "DISTAL"
    | "OCCLUSAL"
    | "INCISAL";

interface Patient {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
}

interface ConditionEntry {
    type: ToothCondition;
    surfaces: ToothSurface[];
    date: string;
    notes: string;
    doctorId: string;
}

interface ToothRecord {
    id: string;
    toothNumber: number;
    conditions: ConditionEntry[];
    notes: string | null;
    updatedAt: string;
}

const CONDITION_COLORS: Record<ToothCondition, string> = {
    HEALTHY: "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200",
    CARIES: "bg-amber-200 hover:bg-amber-300 text-amber-900 border-amber-300",
    FILLED: "bg-blue-200 hover:bg-blue-300 text-blue-900 border-blue-300",
    CROWN: "bg-purple-200 hover:bg-purple-300 text-purple-900 border-purple-300",
    EXTRACTED: "bg-red-200 hover:bg-red-300 text-red-900 border-red-300",
    IMPLANT: "bg-teal-200 hover:bg-teal-300 text-teal-900 border-teal-300",
    MISSING: "bg-slate-300 hover:bg-slate-400 text-slate-700 border-slate-400",
    OTHER: "bg-orange-200 hover:bg-orange-300 text-orange-900 border-orange-300",
};

const CONDITION_LABELS: Record<ToothCondition, string> = {
    HEALTHY: "Healthy",
    CARIES: "Caries",
    FILLED: "Filled",
    CROWN: "Crown",
    EXTRACTED: "Extracted",
    IMPLANT: "Implant",
    MISSING: "Missing",
    OTHER: "Other",
};

const ALL_CONDITIONS: ToothCondition[] = [
    "HEALTHY", "CARIES", "FILLED", "CROWN", "EXTRACTED", "IMPLANT", "MISSING", "OTHER",
];
const ALL_SURFACES: ToothSurface[] = [
    "BUCCAL", "LINGUAL", "MESIAL", "DISTAL", "OCCLUSAL", "INCISAL",
];

const ADULT_QUADRANTS = [
    { label: "Upper Right", teeth: [18, 17, 16, 15, 14, 13, 12, 11] },
    { label: "Upper Left", teeth: [21, 22, 23, 24, 25, 26, 27, 28] },
    { label: "Lower Left", teeth: [38, 37, 36, 35, 34, 33, 32, 31] },
    { label: "Lower Right", teeth: [41, 42, 43, 44, 45, 46, 47, 48] },
];

const DECIDUOUS_QUADRANTS = [
    { label: "Upper Right", teeth: [55, 54, 53, 52, 51] },
    { label: "Upper Left", teeth: [61, 62, 63, 64, 65] },
    { label: "Lower Left", teeth: [71, 72, 73, 74, 75] },
    { label: "Lower Right", teeth: [85, 84, 83, 82, 81] },
];

async function searchPatients(search: string): Promise<Patient[]> {
    const params = new URLSearchParams({ search, limit: "20" });
    const res = await fetch(`/api/patients?${params}`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to search patients");
    const json = await res.json();
    return json.data.patients as Patient[];
}

async function fetchTeethRecords(patientId: string): Promise<ToothRecord[]> {
    const res = await fetch(`/api/teeth?patientId=${patientId}`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch tooth records");
    const json = await res.json();
    return json.data.records as ToothRecord[];
}

interface SaveToothPayload {
    patientId: string;
    toothNumber: number;
    condition: ToothCondition;
    surfaces: ToothSurface[];
    notes: string;
}

async function saveTooth(payload: SaveToothPayload): Promise<void> {
    const res = await fetch("/api/teeth", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to save tooth record");
    }
}

interface ToothModalProps {
    toothNumber: number;
    patientId: string;
    existingRecord: ToothRecord | undefined;
    onClose: () => void;
}

function ToothModal({ toothNumber, patientId, existingRecord, onClose }: ToothModalProps) {
    const queryClient = useQueryClient();
    const lastCondition = existingRecord?.conditions?.at(-1);

    const [condition, setCondition] = useState<ToothCondition>(lastCondition?.type ?? "HEALTHY");
    const [surfaces, setSurfaces] = useState<ToothSurface[]>(lastCondition?.surfaces ?? []);
    const [notes, setNotes] = useState(existingRecord?.notes ?? "");

    const mutation = useMutation({
        mutationFn: saveTooth,
        onSuccess: () => {
            toast.success(`Tooth ${toothNumber} updated successfully`);
            queryClient.invalidateQueries({ queryKey: ["teeth", patientId] });
            onClose();
        },
        onError: (err: Error) => {
            toast.error(err.message);
        },
    });

    function toggleSurface(surface: ToothSurface) {
        setSurfaces((prev) =>
            prev.includes(surface) ? prev.filter((s) => s !== surface) : [...prev, surface]
        );
    }

    function handleSave() {
        mutation.mutate({ patientId, toothNumber, condition, surfaces, notes });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-100 w-full max-w-md mx-4 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Tooth {toothNumber}</h2>
                        <p className="text-sm text-slate-500">FDI Notation</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Condition</label>
                        <div className="relative">
                            <select
                                value={condition}
                                onChange={(e) => setCondition(e.target.value as ToothCondition)}
                                className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 pr-8"
                            >
                                {ALL_CONDITIONS.map((c) => (
                                    <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
                                ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-slate-400" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Surfaces Affected</label>
                        <div className="grid grid-cols-3 gap-2">
                            {ALL_SURFACES.map((surface) => (
                                <button
                                    key={surface}
                                    type="button"
                                    onClick={() => toggleSurface(surface)}
                                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                                        surfaces.includes(surface)
                                            ? "bg-teal-600 border-teal-600 text-white"
                                            : "bg-white border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-700"
                                    }`}
                                >
                                    {surface}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            placeholder="Clinical notes..."
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                        />
                    </div>

                    {existingRecord && existingRecord.conditions.length > 0 && (
                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-2">History ({existingRecord.conditions.length} entries)</p>
                            <div className="space-y-1 max-h-24 overflow-y-auto">
                                {[...existingRecord.conditions].reverse().map((entry, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                                        <span className="font-medium">{CONDITION_LABELS[entry.type]}</span>
                                        <span className="text-slate-400">·</span>
                                        <span>{new Date(entry.date).toLocaleDateString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-3 mt-6">
                    <Button variant="outline" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                        onClick={handleSave}
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? "Saving..." : "Save"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

interface ToothCellProps {
    toothNumber: number;
    record: ToothRecord | undefined;
    onClick: () => void;
}

function ToothCell({ toothNumber, record, onClick }: ToothCellProps) {
    const lastCondition = record?.conditions?.at(-1)?.type ?? "HEALTHY";
    const colorClass = CONDITION_COLORS[lastCondition];

    return (
        <button
            onClick={onClick}
            className={`w-10 h-12 rounded-lg border text-xs font-semibold transition-all flex flex-col items-center justify-center gap-0.5 ${colorClass}`}
            title={`Tooth ${toothNumber} — ${CONDITION_LABELS[lastCondition]}`}
        >
            <span>{toothNumber}</span>
        </button>
    );
}

export default function DentalChartPage() {
    const { data: currentUser } = useCurrentUser();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [showResults, setShowResults] = useState(false);
    const [dentitionMode, setDentitionMode] = useState<"adult" | "deciduous">("adult");
    const [activeTooth, setActiveTooth] = useState<number | null>(null);

    const { data: searchResults } = useQuery({
        queryKey: ["patient-search-chart", searchQuery],
        queryFn: () => searchPatients(searchQuery),
        enabled: searchQuery.length >= 2 && !!currentUser,
    });

    const { data: teethRecords } = useQuery({
        queryKey: ["teeth", selectedPatient?.id],
        queryFn: () => fetchTeethRecords(selectedPatient!.id),
        enabled: !!selectedPatient,
    });

    const recordsByTooth = (teethRecords ?? []).reduce<Record<number, ToothRecord>>(
        (acc, r) => { acc[r.toothNumber] = r; return acc; },
        {}
    );

    function selectPatient(patient: Patient) {
        setSelectedPatient(patient);
        setSearchQuery(`${patient.firstName} ${patient.lastName}`);
        setShowResults(false);
    }

    function clearPatient() {
        setSelectedPatient(null);
        setSearchQuery("");
        setActiveTooth(null);
    }

    const quadrants = dentitionMode === "adult" ? ADULT_QUADRANTS : DECIDUOUS_QUADRANTS;

    const activeRecord = activeTooth !== null ? recordsByTooth[activeTooth] : undefined;

    return (
        <DashboardLayout title="Dental Chart">
            <div className="space-y-6 p-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Dental Chart</h1>
                    <p className="text-sm text-slate-500 mt-1">FDI tooth notation — interactive clinical chart</p>
                </div>

                <Card className="ring-1 ring-slate-100 border-none shadow-sm rounded-2xl">
                    <CardContent className="pt-6">
                        <div className="relative max-w-lg">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search patient by name..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setShowResults(true);
                                    if (!e.target.value) clearPatient();
                                }}
                                onFocus={() => setShowResults(true)}
                                className="pl-9 pr-9 rounded-xl border-slate-200 focus:ring-teal-500"
                            />
                            {selectedPatient && (
                                <button
                                    onClick={clearPatient}
                                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                            {showResults && searchResults && searchResults.length > 0 && !selectedPatient && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg ring-1 ring-slate-100 z-20 overflow-hidden max-h-60 overflow-y-auto">
                                    {searchResults.map((patient) => (
                                        <button
                                            key={patient.id}
                                            className="w-full text-left px-4 py-3 hover:bg-teal-50 flex items-center justify-between border-b border-slate-50 last:border-0 transition-colors"
                                            onClick={() => selectPatient(patient)}
                                        >
                                            <span className="font-medium text-slate-900 text-sm">
                                                {patient.firstName} {patient.lastName}
                                            </span>
                                            {patient.dateOfBirth && (
                                                <span className="text-xs text-slate-400">
                                                    DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {selectedPatient && (
                            <div className="mt-3 flex items-center gap-2">
                                <Badge className="bg-teal-50 text-teal-700 border-teal-200">
                                    {selectedPatient.firstName} {selectedPatient.lastName}
                                </Badge>
                                {selectedPatient.dateOfBirth && (
                                    <span className="text-xs text-slate-400">
                                        DOB: {new Date(selectedPatient.dateOfBirth).toLocaleDateString()}
                                    </span>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {selectedPatient ? (
                    <Card className="ring-1 ring-slate-100 border-none shadow-sm rounded-2xl">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-semibold text-slate-900">
                                    Tooth Chart — {selectedPatient.firstName} {selectedPatient.lastName}
                                </CardTitle>
                                <div className="flex rounded-lg overflow-hidden border border-slate-200">
                                    <button
                                        onClick={() => setDentitionMode("adult")}
                                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                            dentitionMode === "adult"
                                                ? "bg-teal-600 text-white"
                                                : "bg-white text-slate-600 hover:bg-slate-50"
                                        }`}
                                    >
                                        Adult
                                    </button>
                                    <button
                                        onClick={() => setDentitionMode("deciduous")}
                                        className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-slate-200 ${
                                            dentitionMode === "deciduous"
                                                ? "bg-teal-600 text-white"
                                                : "bg-white text-slate-600 hover:bg-slate-50"
                                        }`}
                                    >
                                        Deciduous
                                    </button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    {quadrants.slice(0, 2).map((q) => (
                                        <div key={q.label}>
                                            <p className="text-xs font-medium text-slate-400 mb-3 text-center">{q.label}</p>
                                            <div className="flex gap-1 justify-center flex-wrap">
                                                {q.teeth.map((num) => (
                                                    <ToothCell
                                                        key={num}
                                                        toothNumber={num}
                                                        record={recordsByTooth[num]}
                                                        onClick={() => setActiveTooth(num)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="border-t border-dashed border-slate-200 relative">
                                    <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-white px-2 text-xs text-slate-400">
                                        Occlusal Plane
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    {quadrants.slice(2, 4).map((q) => (
                                        <div key={q.label}>
                                            <div className="flex gap-1 justify-center flex-wrap">
                                                {q.teeth.map((num) => (
                                                    <ToothCell
                                                        key={num}
                                                        toothNumber={num}
                                                        record={recordsByTooth[num]}
                                                        onClick={() => setActiveTooth(num)}
                                                    />
                                                ))}
                                            </div>
                                            <p className="text-xs font-medium text-slate-400 mt-3 text-center">{q.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-slate-100">
                                <p className="text-xs font-medium text-slate-500 mb-3">Legend</p>
                                <div className="flex flex-wrap gap-2">
                                    {ALL_CONDITIONS.map((condition) => (
                                        <div key={condition} className="flex items-center gap-1.5">
                                            <div
                                                className={`w-4 h-4 rounded border ${CONDITION_COLORS[condition].split(" ")[0]} ${CONDITION_COLORS[condition].split(" ")[3]}`}
                                            />
                                            <span className="text-xs text-slate-600">{CONDITION_LABELS[condition]}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="ring-1 ring-slate-100 border-none shadow-sm rounded-2xl">
                        <CardContent className="py-20 text-center">
                            <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Search className="h-8 w-8 text-teal-600" />
                            </div>
                            <h3 className="text-base font-semibold text-slate-900 mb-1">No patient selected</h3>
                            <p className="text-sm text-slate-500">Search for a patient above to view their dental chart.</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {activeTooth !== null && selectedPatient && (
                <ToothModal
                    toothNumber={activeTooth}
                    patientId={selectedPatient.id}
                    existingRecord={activeRecord}
                    onClose={() => setActiveTooth(null)}
                />
            )}
        </DashboardLayout>
    );
}
