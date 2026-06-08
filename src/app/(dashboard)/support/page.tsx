"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LifeBuoy, Mail, Phone, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SupportPage() {
    return (
        <DashboardLayout title="Support & Help">
            <div className="max-w-4xl mx-auto space-y-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">How can we help?</h2>
                    <p className="text-slate-500 text-lg">Choose a support channel below to get assistance.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="hover:shadow-md border-none ring-1 ring-slate-100 transition-all">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <MessageSquare className="w-5 h-5 text-teal-600" />
                                Live Chat Support
                            </CardTitle>
                            <CardDescription>Get immediate assistance from our team.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-12 text-base font-semibold">
                                Start a Conversation
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-md border-none ring-1 ring-slate-100 transition-all">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Mail className="w-5 h-5 text-blue-600" />
                                Email Support
                            </CardTitle>
                            <CardDescription>Send us an email and we'll reply within 24 hours.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button variant="outline" className="w-full rounded-xl h-12 text-base font-semibold hover:bg-slate-50">
                                support@nexusdental.test
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-md border-none ring-1 ring-slate-100 transition-all">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Phone className="w-5 h-5 text-amber-600" />
                                Phone Support
                            </CardTitle>
                            <CardDescription>Call our support line for urgent matters.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button variant="outline" className="w-full rounded-xl h-12 text-base font-semibold hover:bg-slate-50">
                                +233 24 000 0000
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-md border-none ring-1 ring-slate-100 transition-all bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl text-white">
                                <LifeBuoy className="w-5 h-5 text-teal-400" />
                                Knowledge Base
                            </CardTitle>
                            <CardDescription className="text-slate-300">Browse tutorials and FAQs.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button variant="secondary" className="w-full rounded-xl h-12 text-base font-semibold bg-white text-slate-900 hover:bg-slate-100">
                                Visit Help Center
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
