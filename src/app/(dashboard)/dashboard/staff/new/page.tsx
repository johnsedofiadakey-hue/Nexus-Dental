"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { toast } from "sonner";

const EMPLOYEE_ROLES = [
    { value: "DOCTOR", label: "Doctor" },
    { value: "NURSE", label: "Nurse" },
    { value: "RECEPTIONIST", label: "Receptionist" },
    { value: "INVENTORY_MANAGER", label: "Inventory Manager" },
    { value: "BILLING_STAFF", label: "Billing Staff / Finance Officer" },
];

export default function NewEmployeePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: "",
        role: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/staff/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                toast.success("Invitation sent", {
                    description: `${formData.email} will receive a link to set their own password. It expires in 48 hours.`,
                });
                router.push("/dashboard/staff");
            } else {
                toast.error("Could not send invitation", {
                    description: data.error || data.message || "An error occurred",
                });
            }
        } catch (error) {
            toast.error("Could not send invitation", {
                description: "Network error. Please try again.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/dashboard/staff">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold">Invite Staff Member</h1>
                    <p className="text-muted-foreground">Invite a new staff member and assign their role</p>
                </div>
            </div>

            {/* Form */}
            <Card className="max-w-2xl">
                <CardHeader>
                    <CardTitle>Invitation</CardTitle>
                    <CardDescription>
                        Enter their work email and role. They will receive a single-use link to set their own password — no password is ever shared with you.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address *</Label>
                            <Input
                                id="email"
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="name@yourclinic.com"
                            />
                            <p className="text-xs text-muted-foreground">
                                Where the invitation link is sent, and their login email
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="role">Role *</Label>
                            <Select
                                required
                                value={formData.role}
                                onValueChange={(value) => setFormData({ ...formData, role: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {EMPLOYEE_ROLES.map((role) => (
                                        <SelectItem key={role.value} value={role.value}>
                                            {role.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                This determines what features the employee can access
                            </p>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button type="submit" disabled={loading} className="gap-2">
                                <Save className="w-4 h-4" />
                                {loading ? "Sending..." : "Send Invitation"}
                            </Button>
                            <Link href="/dashboard/staff">
                                <Button type="button" variant="outline">
                                    Cancel
                                </Button>
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
