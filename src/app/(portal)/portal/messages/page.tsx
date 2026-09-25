"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MessageSquare, Plus, Send, X } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Ticket = {
    id: string;
    subject: string;
    description: string;
    category?: string;
    issueType: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    messages?: Array<{ id: string; content: string; senderRole: string; timestamp: string }>;
};

async function apiRequest(url: string, init?: RequestInit) {
    const response = await fetch(url, { credentials: "include", ...init });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Request failed");
    return payload.data;
}

export default function MessagesPage() {
    const queryClient = useQueryClient();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showNew, setShowNew] = useState(false);
    const [subject, setSubject] = useState("");
    const [description, setDescription] = useState("");
    const [reply, setReply] = useState("");

    const ticketsQuery = useQuery<Ticket[]>({
        queryKey: ["patient-support-tickets"],
        queryFn: async () => (await apiRequest("/api/support/tickets")).tickets ?? [],
    });

    const detailQuery = useQuery<Ticket>({
        queryKey: ["patient-support-ticket", selectedId],
        queryFn: async () => (await apiRequest(`/api/support/tickets/${selectedId}`)).ticket,
        enabled: Boolean(selectedId),
    });

    const createTicket = useMutation({
        mutationFn: () => apiRequest("/api/support/tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subject, description, issueType: "GENERAL" }),
        }),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["patient-support-tickets"] });
            setShowNew(false);
            setSubject("");
            setDescription("");
            setSelectedId(data.ticket.id);
            toast.success("Message sent to the care team");
        },
        onError: (error: Error) => toast.error(error.message),
    });

    const sendReply = useMutation({
        mutationFn: () => apiRequest(`/api/support/tickets/${selectedId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: reply }),
        }),
        onSuccess: () => {
            setReply("");
            queryClient.invalidateQueries({ queryKey: ["patient-support-ticket", selectedId] });
            queryClient.invalidateQueries({ queryKey: ["patient-support-tickets"] });
        },
        onError: (error: Error) => toast.error(error.message),
    });

    function submitNew(event: FormEvent) {
        event.preventDefault();
        if (!subject.trim() || !description.trim()) return;
        createTicket.mutate();
    }

    if (selectedId) {
        const ticket = detailQuery.data;
        return (
            <DashboardLayout title="Messages">
                <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-20">
                    <button type="button" onClick={() => setSelectedId(null)} className="flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-teal-700"><ArrowLeft className="h-4 w-4" />All conversations</button>
                    {detailQuery.isLoading || !ticket ? <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div> : (
                        <>
                            <Card className="border-0 shadow-sm ring-1 ring-slate-100"><CardContent className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-950">{ticket.subject}</h2><p className="mt-1 text-sm text-slate-500">{ticket.description}</p></div><Badge variant="outline">{ticket.status.replaceAll("_", " ")}</Badge></div></CardContent></Card>
                            <div className="min-h-[300px] space-y-3 rounded-3xl bg-slate-100/70 p-4 sm:p-6">
                                {(ticket.messages ?? []).map((message) => {
                                    const patient = message.senderRole === "PATIENT";
                                    return <div key={message.id} className={`flex ${patient ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${patient ? "rounded-br-md bg-teal-600 text-white" : "rounded-bl-md bg-white text-slate-800"}`}><p>{message.content}</p><p className={`mt-1 text-[10px] ${patient ? "text-teal-100" : "text-slate-400"}`}>{patient ? "You" : "Care team"} · {new Date(message.timestamp).toLocaleString("en-GB")}</p></div></div>;
                                })}
                                {(ticket.messages ?? []).length === 0 && <p className="py-12 text-center text-sm text-slate-500">Your care team will respond here.</p>}
                            </div>
                            <form onSubmit={(event) => { event.preventDefault(); if (reply.trim()) sendReply.mutate(); }} className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                                <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={2} placeholder="Write a message..." className="min-h-12 flex-1 resize-none rounded-xl border-0 px-3 py-2 text-sm outline-none" />
                                <Button type="submit" size="icon" disabled={!reply.trim() || sendReply.isPending} className="h-12 w-12 shrink-0 rounded-xl bg-teal-600 hover:bg-teal-700">{sendReply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
                            </form>
                        </>
                    )}
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout title="Messages">
            <div className="mx-auto max-w-4xl space-y-6 pb-20">
                <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Care team</p><h2 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Messages and support</h2><p className="mt-2 text-sm text-slate-500">Keep questions, updates, and replies together.</p></div><Button onClick={() => setShowNew(true)} className="shrink-0 bg-teal-600 hover:bg-teal-700"><Plus className="mr-2 h-4 w-4" /><span className="hidden sm:inline">New message</span><span className="sm:hidden">New</span></Button></div>

                {ticketsQuery.isLoading && <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>}
                {!ticketsQuery.isLoading && (ticketsQuery.data ?? []).length === 0 && <Card className="border-dashed shadow-none"><CardContent className="p-12 text-center"><MessageSquare className="mx-auto mb-4 h-12 w-12 text-slate-300" /><h3 className="font-bold text-slate-900">No conversations yet</h3><p className="mt-2 text-sm text-slate-500">Start a private conversation with your care team.</p></CardContent></Card>}
                <div className="space-y-3">{(ticketsQuery.data ?? []).map((ticket) => <button key={ticket.id} type="button" onClick={() => setSelectedId(ticket.id)} className="w-full rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition hover:border-teal-200 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-bold text-slate-950">{ticket.subject}</h3><p className="mt-1 line-clamp-2 text-sm text-slate-500">{ticket.description}</p></div><Badge variant="outline" className="shrink-0">{ticket.status.replaceAll("_", " ")}</Badge></div><p className="mt-3 text-xs text-slate-400">Updated {new Date(ticket.updatedAt).toLocaleDateString("en-GB")}</p></button>)}</div>
            </div>

            {showNew && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"><form onSubmit={submitNew} className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-8"><div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-bold text-slate-950">New message</h2><button type="button" onClick={() => setShowNew(false)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100"><X className="h-4 w-4" /></button></div><label className="mb-4 block"><span className="mb-1.5 block text-sm font-semibold">Subject</span><Input value={subject} onChange={(event) => setSubject(event.target.value)} required /></label><label className="block"><span className="mb-1.5 block text-sm font-semibold">How can we help?</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" /></label><Button type="submit" disabled={createTicket.isPending} className="mt-6 min-h-12 w-full bg-teal-600 hover:bg-teal-700">{createTicket.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Send message</Button></form></div>}
        </DashboardLayout>
    );
}
