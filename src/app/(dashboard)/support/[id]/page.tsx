"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Ticket = { id: string; subject: string; description: string; status: string; severity: string; patient: { firstName: string; lastName: string; phone: string }; messages: Array<{ id: string; content: string; senderRole: string; isInternal: boolean; timestamp: string }> };

async function request(url: string, init?: RequestInit) {
    const response = await fetch(url, { credentials: "include", ...init });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Request failed");
    return payload.data;
}

export default function SupportTicketPage() {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const [reply, setReply] = useState("");
    const [internal, setInternal] = useState(false);

    const ticketQuery = useQuery<Ticket>({ queryKey: ["support-ticket", id], queryFn: async () => (await request(`/api/support/tickets/${id}`)).ticket });
    const refresh = () => queryClient.invalidateQueries({ queryKey: ["support-ticket", id] });
    const replyMutation = useMutation({ mutationFn: () => request(`/api/support/tickets/${id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: reply, isInternal: internal }) }), onSuccess: () => { setReply(""); refresh(); toast.success(internal ? "Internal note added" : "Reply sent"); }, onError: (error: Error) => toast.error(error.message) });
    const statusMutation = useMutation({ mutationFn: (status: string) => request(`/api/support/tickets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }), onSuccess: refresh, onError: (error: Error) => toast.error(error.message) });

    function submit(event: FormEvent) { event.preventDefault(); if (reply.trim()) replyMutation.mutate(); }
    const ticket = ticketQuery.data;

    return <DashboardLayout title="Support conversation"><div className="mx-auto max-w-4xl space-y-5 pb-20"><Button asChild variant="ghost" className="px-0 text-teal-700"><Link href="/support"><ArrowLeft className="mr-2 h-4 w-4" />All tickets</Link></Button>{ticketQuery.isLoading || !ticket ? <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div> : <><Card className="border-0 shadow-sm ring-1 ring-slate-100"><CardContent className="p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><div className="flex flex-wrap gap-2"><Badge variant="outline">{ticket.status.replaceAll("_", " ")}</Badge><Badge variant="secondary">{ticket.severity}</Badge></div><h2 className="mt-3 text-2xl font-bold text-slate-950">{ticket.subject}</h2><p className="mt-2 text-sm text-slate-500">{ticket.description}</p><p className="mt-4 text-sm font-semibold text-slate-700">{ticket.patient.firstName} {ticket.patient.lastName} · {ticket.patient.phone}</p></div><div className="flex flex-wrap gap-2 sm:max-w-52">{["IN_PROGRESS", "WAITING_ON_PATIENT", "RESOLVED"].map((status) => <Button key={status} size="sm" variant={ticket.status === status ? "default" : "outline"} onClick={() => statusMutation.mutate(status)}>{status.replaceAll("_", " ")}</Button>)}</div></div></CardContent></Card><div className="min-h-[320px] space-y-3 rounded-3xl bg-slate-100/70 p-4 sm:p-6">{ticket.messages.map((message) => { const patient = message.senderRole === "PATIENT"; return <div key={message.id} className={`flex ${patient ? "justify-start" : "justify-end"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.isInternal ? "border border-amber-200 bg-amber-50 text-amber-950" : patient ? "rounded-bl-md bg-white text-slate-800" : "rounded-br-md bg-teal-600 text-white"}`}><p>{message.content}</p><p className={`mt-1 text-[10px] ${message.isInternal ? "text-amber-600" : patient ? "text-slate-400" : "text-teal-100"}`}>{message.isInternal ? "Internal note" : patient ? "Patient" : "Care team"} · {new Date(message.timestamp).toLocaleString("en-GB")}</p></div></div>; })}</div><form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={3} placeholder={internal ? "Add an internal note..." : "Reply to the patient..."} className="w-full resize-none rounded-xl border-0 p-2 text-sm outline-none" /><div className="mt-2 flex items-center justify-between gap-3"><label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />Internal note</label><Button type="submit" disabled={!reply.trim() || replyMutation.isPending} className="bg-teal-600 hover:bg-teal-700">{replyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{internal ? "Add note" : "Send reply"}</Button></div></form></>}</div></DashboardLayout>;
}
