"use client";

import { useState, useEffect } from "react";
import { Plus, Search, MoreVertical, Shield, Mail, Phone, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

interface Employee {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    status: string;
    createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
    DOCTOR: "bg-blue-100 text-blue-800 border-blue-200",
    NURSE: "bg-green-100 text-green-800 border-green-200",
    RECEPTIONIST: "bg-purple-100 text-purple-800 border-purple-200",
    INVENTORY_MANAGER: "bg-orange-100 text-orange-800 border-orange-200",
    BILLING_STAFF: "bg-pink-100 text-pink-800 border-pink-200",
};

export default function StaffManagementPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        async function fetchEmployees() {
            try {
                const res = await fetch("/api/staff");
                if (res.ok) {
                    const data = await res.json();
                    setEmployees(data.employees || []);
                }
            } catch (error) {
                console.error("Failed to fetch employees:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchEmployees();
    }, []);

    const filteredEmployees = employees.filter((emp) =>
        `${emp.firstName} ${emp.lastName} ${emp.email} ${emp.role}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Employee Management</h1>
                    <p className="text-muted-foreground">Manage your clinic staff and assign roles</p>
                </div>
                <Link href="/dashboard/staff/new">
                    <Button className="gap-2">
                        <Plus className="w-4 h-4" />
                        Add Employee
                    </Button>
                </Link>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, email, or role..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Employee List */}
            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
            ) : filteredEmployees.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-semibold mb-2">No employees found</h3>
                        <p className="text-muted-foreground mb-4">
                            {searchQuery ? "Try a different search term" : "Get started by adding your first employee"}
                        </p>
                        {!searchQuery && (
                            <Link href="/dashboard/staff/new">
                                <Button className="gap-2">
                                    <Plus className="w-4 h-4" />
                                    Add First Employee
                                </Button>
                            </Link>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {filteredEmployees.map((employee) => (
                        <Card key={employee.id}>
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold text-lg">
                                            {employee.firstName[0]}{employee.lastName[0]}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="font-semibold text-lg">
                                                    {employee.firstName} {employee.lastName}
                                                </h3>
                                                <Badge className={ROLE_COLORS[employee.role] || "bg-gray-100 text-gray-800"}>
                                                    {employee.role.replace(/_/g, " ")}
                                                </Badge>
                                                <Badge variant={employee.status === "ACTIVE" ? "success" : "secondary"}>
                                                    {employee.status}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Mail className="w-3 h-3" />
                                                    {employee.email}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    Joined {new Date(employee.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreVertical className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem>View Details</DropdownMenuItem>
                                            <DropdownMenuItem>Edit</DropdownMenuItem>
                                            <DropdownMenuItem>Reset Password</DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-destructive">
                                                {employee.status === "ACTIVE" ? "Suspend" : "Activate"}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
