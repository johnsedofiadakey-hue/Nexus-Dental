"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, AlertCircle, Clock } from "lucide-react";

export default function SupportDashboard() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchTickets() {
            try {
                const res = await fetch("/api/support/tickets");
                if (res.ok) {
                    const data = await res.json();
                    setTickets(data.data?.tickets || []);
                }
            } catch (error) {
                console.error("Failed to fetch tickets", error);
            } finally {
                setLoading(false);
            }
        }
        fetchTickets();
    }, []);

    return (
        <DashboardLayout title="Support Tickets">
            <div className="p-8 max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold">Support Center</h1>
                    <p className="text-slate-500">Manage patient inquiries and issues.</p>
                </div>

                {loading ? (
                    <p>Loading tickets...</p>
                ) : tickets.length === 0 ? (
                    <Card className="text-center py-12">
                        <CardContent>
                            <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No active tickets</h3>
                            <p className="text-slate-500">Patient inquiries will appear here.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {tickets.map(ticket => (
                            <Card key={ticket.id} className="hover:shadow-md transition-shadow cursor-pointer border-l-4" style={{
                                borderLeftColor: ticket.severity === 'HIGH' ? '#ef4444' : ticket.severity === 'MEDIUM' ? '#f59e0b' : '#3b82f6'
                            }}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <Badge variant="outline">{ticket.status}</Badge>
                                        <span className="text-xs text-slate-500 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(ticket.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <CardTitle className="mt-2 text-lg leading-tight">{ticket.subject}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-slate-500 line-clamp-2">{ticket.description}</p>
                                    <div className="mt-4 flex items-center gap-2 pt-4 border-t border-slate-100">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                                            {ticket.patient?.firstName?.charAt(0) || '?'}
                                        </div>
                                        <span className="text-sm font-medium text-slate-700">
                                            {ticket.patient?.firstName} {ticket.patient?.lastName}
                                        </span>
                                        <div className="ml-auto flex items-center gap-1 text-slate-400 text-xs">
                                            <MessageSquare className="w-3 h-3" />
                                            {ticket._count?.messages || 0}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
