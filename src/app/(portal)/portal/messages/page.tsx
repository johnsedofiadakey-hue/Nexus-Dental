"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Plus, Clock, CheckCircle2 } from "lucide-react";

export default function MessagesPage() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchTickets() {
            try {
                const res = await fetch("/api/support/tickets");
                if (res.ok) {
                    const data = await res.json();
                    setTickets(data.data || []);
                }
            } catch (error) {
                console.error("Failed to load tickets", error);
            } finally {
                setLoading(false);
            }
        }
        fetchTickets();
    }, []);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "OPEN": return <Clock className="w-4 h-4 text-amber-500" />;
            case "IN_PROGRESS": return <Clock className="w-4 h-4 text-blue-500" />;
            case "RESOLVED": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            default: return <MessageSquare className="w-4 h-4 text-slate-500" />;
        }
    };

    return (
        <DashboardLayout title="Support Messages">
            <div className="p-8 max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">Support Messages</h1>
                        <p className="text-slate-500">Contact the clinic staff for help with your care.</p>
                    </div>
                    <Button className="gap-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl">
                        <Plus className="w-4 h-4" /> New Message
                    </Button>
                </div>

                {loading ? (
                    <p>Loading your messages...</p>
                ) : tickets.length === 0 ? (
                    <Card className="text-center py-12">
                        <CardContent>
                            <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
                            <p className="text-slate-500 mb-6">Have a question? Start a new conversation.</p>
                            <Button className="bg-teal-600 hover:bg-teal-700">Send a Message</Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {tickets.map(ticket => (
                            <Card key={ticket.id} className="hover:shadow-md cursor-pointer transition-shadow">
                                <CardContent className="p-6 flex items-start gap-4">
                                    <div className="mt-1">{getStatusIcon(ticket.status)}</div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-semibold text-lg">{ticket.subject}</h3>
                                            <span className="text-sm text-slate-500">
                                                {new Date(ticket.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="mt-2 flex items-center gap-2">
                                            <Badge variant="outline">{ticket.status}</Badge>
                                            <Badge variant="secondary">{ticket.category}</Badge>
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
