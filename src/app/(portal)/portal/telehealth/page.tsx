"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Calendar, Clock, Loader2, Video } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

type Consultation = {
    appointmentId: string;
    doctorName: string;
    status: string;
    scheduledTime: string;
};

export default function TelehealthPage() {
    const router = useRouter();
    const [startingEmergency, setStartingEmergency] = useState(false);

    const { data = [], isLoading, isError } = useQuery<Consultation[]>({
        queryKey: ["patient-telehealth"],
        queryFn: async () => {
            const response = await fetch("/api/telehealth/rooms", { credentials: "include" });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Unable to load consultations");
            return payload.data?.activeConsultations ?? [];
        },
    });

    async function startEmergencyCall() {
        setStartingEmergency(true);
        try {
            const response = await fetch("/api/telehealth/emergency", {
                method: "POST",
                credentials: "include",
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Unable to start emergency call");
            router.push(`/patient/consultations/${payload.data.appointmentId}`);
        } catch (err: any) {
            toast.error(err.message || "Could not start an emergency video call. Please call the clinic directly.");
        } finally {
            setStartingEmergency(false);
        }
    }

    return (
        <DashboardLayout title="Virtual care">
            <div className="mx-auto max-w-3xl space-y-6">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Private virtual care</p>
                    <h2 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Your online consultations</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">Join scheduled video visits securely from your phone or computer.</p>
                </div>

                <Card className="border-0 bg-red-50 shadow-sm ring-1 ring-red-100">
                    <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700"><AlertTriangle className="h-5 w-5" /></span>
                            <div>
                                <h3 className="font-bold text-slate-950">Dental emergency?</h3>
                                <p className="mt-1 text-sm text-slate-600">Start an instant video call with the next available doctor — no appointment needed.</p>
                            </div>
                        </div>
                        <Button
                            onClick={startEmergencyCall}
                            disabled={startingEmergency}
                            className="min-h-11 shrink-0 bg-red-600 hover:bg-red-700"
                        >
                            {startingEmergency ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start emergency video call"}
                        </Button>
                    </CardContent>
                </Card>

                {isLoading && <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>}
                {isError && <div className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">Your consultations could not be loaded.</div>}
                {!isLoading && !isError && data.length === 0 && (
                    <Card className="border-dashed shadow-none">
                        <CardContent className="p-10 text-center">
                            <Video className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                            <h3 className="font-bold text-slate-900">No active virtual consultations</h3>
                            <p className="mt-2 text-sm text-slate-500">When your care team creates a consultation room, it will appear here.</p>
                            <Button asChild className="mt-6 bg-teal-600 hover:bg-teal-700"><Link href="/consultation">Request virtual care</Link></Button>
                        </CardContent>
                    </Card>
                )}

                <div className="space-y-3">
                    {data.map((consultation) => (
                        <Card key={consultation.appointmentId} className="border-0 shadow-sm ring-1 ring-slate-100">
                            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><Video className="h-6 w-6" /></span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-950">{consultation.doctorName}</h3><Badge variant="outline">{consultation.status.replaceAll("_", " ")}</Badge></div>
                                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><Calendar className="h-4 w-4" />{new Date(consultation.scheduledTime).toLocaleDateString("en-GB")} <Clock className="ml-2 h-4 w-4" />{new Date(consultation.scheduledTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
                                </div>
                                <Button asChild className="min-h-11 bg-teal-600 hover:bg-teal-700"><Link href={`/patient/consultations/${consultation.appointmentId}`}>Join consultation</Link></Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    );
}
