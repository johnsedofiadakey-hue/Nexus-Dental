"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function StaffPage() {
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStaff() {
            try {
                const res = await fetch("/api/staff");
                if (res.ok) {
                    const data = await res.json();
                    setStaff(data.data || []);
                }
            } catch (error) {
                console.error("Failed to load staff", error);
            } finally {
                setLoading(false);
            }
        }
        fetchStaff();
    }, []);

    return (
        <DashboardLayout title="Staff Management">
            <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">Staff Directory</h1>
                        <p className="text-slate-500">Manage your clinic staff and their roles.</p>
                    </div>
                </div>

                {loading ? (
                    <p>Loading...</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {staff.map((member: any) => (
                            <Card key={member.id}>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Users className="w-5 h-5 text-teal-600" />
                                        {member.firstName} {member.lastName}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-slate-500">{member.email}</p>
                                    <div className="mt-4 flex gap-2">
                                        {member.roles.map((role: any) => (
                                            <span key={role.id} className="text-xs bg-slate-100 px-2 py-1 rounded-md text-slate-700">
                                                {role.systemRole}
                                            </span>
                                        ))}
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
