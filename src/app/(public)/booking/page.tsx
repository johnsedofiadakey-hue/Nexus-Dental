"use client";

// ============================================
// NEXUS DENTAL — Booking Wizard
// Multi-step: Service → Doctor → Date/Time → Confirm
// ============================================

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Stethoscope,
    User,
    Calendar,
    CheckCircle,
    ArrowLeft,
    ArrowRight,
    Clock,
    DollarSign,
    MapPin,
    Phone,
    Loader2,
} from "lucide-react";
import { toast } from "sonner";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Service {
    id: string;
    name: string;
    description: string;
    category: string;
    price: number;
    duration: number;
}

interface Doctor {
    id: string;
    firstName: string;
    lastName: string;
    specialty: string | null;
    avatar: string | null;
}

interface TimeSlot {
    time: string;
    available: boolean;
    locked: boolean;
}

interface DaySchedule {
    date: string;
    dayOfWeek: string;
    slots: TimeSlot[];
    totalAvailable: number;
}

// ─────────────────────────────────────────────
// Step Configuration
// ─────────────────────────────────────────────

const STEPS = [
    { id: 1, label: "Service", icon: Stethoscope },
    { id: 2, label: "Doctor", icon: User },
    { id: 3, label: "Date & Time", icon: Calendar },
    { id: 4, label: "Confirm", icon: CheckCircle },
];

const TENANT_ID = "airport-hills-dental"; // Hardcoded for MVP single-clinic setup

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function BookingPage() {
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    
    const [services, setServices] = useState<Service[]>([]);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [weekSchedule, setWeekSchedule] = useState<DaySchedule[]>([]);
    
    const [loadingServices, setLoadingServices] = useState(true);
    const [loadingDoctors, setLoadingDoctors] = useState(true);
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isBooked, setIsBooked] = useState(false);
    const [notes, setNotes] = useState("");
    const [phone, setPhone] = useState("");

    // Fetch Services and Doctors on mount
    useEffect(() => {
        async function fetchInitialData() {
            try {
                const [servicesRes, doctorsRes] = await Promise.all([
                    fetch(`/api/services?tenantId=${TENANT_ID}`),
                    fetch(`/api/appointments/doctors?tenantId=${TENANT_ID}`)
                ]);
                
                const servicesData = await servicesRes.json();
                const doctorsData = await doctorsRes.json();
                
                if (servicesData.success) {
                    setServices(servicesData.data.services);
                } else {
                    toast.error("Failed to load services");
                }
                
                if (doctorsData.success) {
                    setDoctors(doctorsData.data.doctors);
                } else {
                    toast.error("Failed to load doctors");
                }
            } catch (error) {
                console.error("Error loading initial data:", error);
                toast.error("Error connecting to server");
            } finally {
                setLoadingServices(false);
                setLoadingDoctors(false);
            }
        }
        
        fetchInitialData();
    }, []);

    // Generate week schedule when doctor is selected
    useEffect(() => {
        if (selectedDoctor && selectedService) {
            async function fetchSchedule() {
                setLoadingSchedule(true);
                setWeekSchedule([]);
                setSelectedDate(null);
                setSelectedTime(null);
                
                try {
                    // Fetch slots for the next 7 days starting from today
                    const today = new Date();
                    const dateStr = today.toISOString().split("T")[0];
                    const duration = selectedService?.duration || 30;
                    
                    const res = await fetch(`/api/appointments/slots?tenantId=${TENANT_ID}&doctorId=${selectedDoctor!.id}&date=${dateStr}&mode=week&duration=${duration}`);
                    const data = await res.json();
                    
                    if (data.success) {
                        setWeekSchedule(data.data.schedules);
                    } else {
                        toast.error(data.error || "Failed to load schedule");
                    }
                } catch (error) {
                    console.error("Error fetching schedule:", error);
                    toast.error("Error connecting to server");
                } finally {
                    setLoadingSchedule(false);
                }
            }
            fetchSchedule();
        }
    }, [selectedDoctor, selectedService]);

    const canProceed =
        (currentStep === 1 && selectedService) ||
        (currentStep === 2 && selectedDoctor) ||
        (currentStep === 3 && selectedDate && selectedTime) ||
        currentStep === 4;

    const handleNext = () => {
        if (currentStep < 4 && canProceed) setCurrentStep((s) => s + 1);
    };

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep((s) => s - 1);
    };

    const handleSubmit = async () => {
        if (!selectedService || !selectedDoctor || !selectedDate || !selectedTime) return;
        
        setIsSubmitting(true);
        
        try {
            const res = await fetch("/api/appointments/book", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tenantId: TENANT_ID,
                    serviceId: selectedService.id,
                    doctorId: selectedDoctor.id,
                    date: selectedDate,
                    time: selectedTime,
                    type: "IN_PERSON",
                    notes: `${phone ? `Phone: ${phone}\n` : ''}${notes}`,
                })
            });
            
            const data = await res.json();
            
            if (data.success) {
                toast.success("Appointment booked successfully!");
                setIsBooked(true);
            } else {
                toast.error(data.error || "Failed to book appointment. Please make sure you are logged in.");
            }
        } catch (error) {
            console.error("Booking error:", error);
            toast.error("Network error. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatPrice = (price: number) =>
        `GH₵ ${price.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;

    // ─── Booking Confirmed ───
    if (isBooked) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(to bottom, var(--color-background-primary), var(--color-background-secondary))" }}>
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="max-w-md w-full text-center p-8 rounded-2xl bg-white shadow-xl"
                >
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                        className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                        style={{ background: "var(--color-success)" }}
                    >
                        <CheckCircle className="w-10 h-10 text-white" />
                    </motion.div>
                    <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text-primary)" }}>
                        Appointment Confirmed!
                    </h2>
                    <p className="mb-6" style={{ color: "var(--color-text-secondary)" }}>
                        Your appointment has been booked successfully. You&apos;ll receive a confirmation via WhatsApp.
                    </p>
                    <div className="text-left space-y-3 p-4 rounded-xl mb-6" style={{ background: "var(--color-background-secondary)" }}>
                        <div className="flex justify-between">
                            <span style={{ color: "var(--color-text-light)" }}>Service</span>
                            <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>{selectedService?.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span style={{ color: "var(--color-text-light)" }}>Doctor</span>
                            <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>{selectedDoctor?.firstName} {selectedDoctor?.lastName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span style={{ color: "var(--color-text-light)" }}>Date</span>
                            <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>
                                {selectedDate && new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span style={{ color: "var(--color-text-light)" }}>Time</span>
                            <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>{selectedTime}</span>
                        </div>
                        <hr style={{ borderColor: "var(--color-border-light)" }} />
                        <div className="flex justify-between">
                            <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>Total</span>
                            <span className="font-bold" style={{ color: "var(--color-primary)" }}>{selectedService && formatPrice(selectedService.price)}</span>
                        </div>
                    </div>
                    <a
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition"
                        style={{ background: "var(--color-primary)" }}
                    >
                        Back to Home
                    </a>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen" style={{ background: "linear-gradient(to bottom, var(--color-background-primary), var(--color-background-secondary))" }}>
            {/* Header */}
            <div className="pt-28 pb-8 px-4 text-center">
                <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text-primary)" }}>
                    Book Your Appointment
                </h1>
                <p style={{ color: "var(--color-text-secondary)" }}>
                    Select your service, choose a doctor, and pick your preferred time.
                </p>
            </div>

            {/* Progress Stepper */}
            <div className="max-w-3xl mx-auto px-4 mb-8">
                <div className="flex items-center justify-between">
                    {STEPS.map((step, index) => {
                        const Icon = step.icon;
                        const isActive = currentStep === step.id;
                        const isCompleted = currentStep > step.id;

                        return (
                            <div key={step.id} className="flex items-center flex-1">
                                <div className="flex flex-col items-center">
                                    <div
                                        className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-300"
                                        style={{
                                            background: isCompleted
                                                ? "var(--color-success)"
                                                : isActive
                                                    ? "var(--color-primary)"
                                                    : "var(--color-border-light)",
                                            color: isCompleted || isActive ? "white" : "var(--color-text-light)",
                                        }}
                                    >
                                        {isCompleted ? (
                                            <CheckCircle className="w-5 h-5" />
                                        ) : (
                                            <Icon className="w-5 h-5" />
                                        )}
                                    </div>
                                    <span
                                        className="text-xs mt-1 hidden md:block font-medium"
                                        style={{ color: isActive ? "var(--color-primary)" : "var(--color-text-light)" }}
                                    >
                                        {step.label}
                                    </span>
                                </div>
                                {index < STEPS.length - 1 && (
                                    <div
                                        className="flex-1 h-0.5 mx-2 transition-all duration-300"
                                        style={{
                                            background: currentStep > step.id
                                                ? "var(--color-success)"
                                                : "var(--color-border-light)",
                                        }}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Step Content */}
            <div className="max-w-4xl mx-auto px-4 pb-32">
                <AnimatePresence mode="wait">
                    {/* ─── Step 1: Select Service ─── */}
                    {currentStep === 1 && (
                        <motion.div
                            key="step-1"
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -30 }}
                            transition={{ duration: 0.3 }}
                        >
                            <h2 className="text-xl font-bold mb-4" style={{ color: "var(--color-text-primary)" }}>
                                Choose a Service
                            </h2>
                            {loadingServices ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                                </div>
                            ) : services.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground bg-white rounded-xl shadow-sm border border-slate-200">
                                    No services available at this time.
                                </div>
                            ) : (
                                <div className="grid gap-3 md:grid-cols-2">
                                    {services.map((service) => (
                                        <button
                                            key={service.id}
                                            onClick={() => setSelectedService(service)}
                                            className="text-left p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-md"
                                            style={{
                                                background: "white",
                                                borderColor:
                                                    selectedService?.id === service.id
                                                        ? "var(--color-primary)"
                                                        : "var(--color-border-light)",
                                                boxShadow:
                                                    selectedService?.id === service.id
                                                        ? "0 0 0 3px rgba(42,127,113,0.1)"
                                                        : "none",
                                            }}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                                    {service.name}
                                                </h3>
                                                <span
                                                    className="text-xs px-2 py-1 rounded-full font-medium"
                                                    style={{
                                                        background: "var(--color-background-secondary)",
                                                        color: "var(--color-primary)",
                                                    }}
                                                >
                                                    {service.category}
                                                </span>
                                            </div>
                                            <p className="text-sm mb-3" style={{ color: "var(--color-text-secondary)" }}>
                                                {service.description}
                                            </p>
                                            <div className="flex items-center gap-4 text-sm">
                                                <span className="flex items-center gap-1" style={{ color: "var(--color-primary)" }}>
                                                    <DollarSign className="w-3.5 h-3.5" />
                                                    {formatPrice(service.price)}
                                                </span>
                                                <span className="flex items-center gap-1" style={{ color: "var(--color-text-light)" }}>
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {service.duration} min
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ─── Step 2: Select Doctor ─── */}
                    {currentStep === 2 && (
                        <motion.div
                            key="step-2"
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -30 }}
                            transition={{ duration: 0.3 }}
                        >
                            <h2 className="text-xl font-bold mb-4" style={{ color: "var(--color-text-primary)" }}>
                                Choose Your Doctor
                            </h2>
                            {loadingDoctors ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                                </div>
                            ) : doctors.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground bg-white rounded-xl shadow-sm border border-slate-200">
                                    No doctors available at this time.
                                </div>
                            ) : (
                                <div className="grid gap-3 md:grid-cols-2">
                                    {doctors.map((doctor) => (
                                        <button
                                            key={doctor.id}
                                            onClick={() => setSelectedDoctor(doctor)}
                                            className="text-left p-5 rounded-xl border-2 transition-all duration-200 hover:shadow-md"
                                            style={{
                                                background: "white",
                                                borderColor:
                                                    selectedDoctor?.id === doctor.id
                                                        ? "var(--color-primary)"
                                                        : "var(--color-border-light)",
                                                boxShadow:
                                                    selectedDoctor?.id === doctor.id
                                                        ? "0 0 0 3px rgba(42,127,113,0.1)"
                                                        : "none",
                                            }}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div
                                                    className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0"
                                                    style={{ background: "var(--color-primary)" }}
                                                >
                                                    {doctor.firstName.charAt(0)}{doctor.lastName.charAt(0)}
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                                        {doctor.firstName} {doctor.lastName}
                                                    </h3>
                                                    <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                                                        {doctor.specialty}
                                                    </p>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        {[...Array(5)].map((_, i) => (
                                                            <svg key={i} className="w-3.5 h-3.5" fill="var(--color-accent)" viewBox="0 0 20 20">
                                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                            </svg>
                                                        ))}
                                                        <span className="text-xs ml-1" style={{ color: "var(--color-text-light)" }}>
                                                            4.9
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ─── Step 3: Select Date & Time ─── */}
                    {currentStep === 3 && (
                        <motion.div
                            key="step-3"
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -30 }}
                            transition={{ duration: 0.3 }}
                        >
                            <h2 className="text-xl font-bold mb-4" style={{ color: "var(--color-text-primary)" }}>
                                Select Date & Time
                            </h2>

                            {loadingSchedule ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                                </div>
                            ) : weekSchedule.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground bg-white rounded-xl shadow-sm border border-slate-200">
                                    No available schedule found.
                                </div>
                            ) : (
                                <>
                                    {/* Date Selector */}
                                    <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
                                        {weekSchedule.map((day) => (
                                            <button
                                                key={day.date}
                                                onClick={() => {
                                                    setSelectedDate(day.date);
                                                    setSelectedTime(null);
                                                }}
                                                className="shrink-0 px-4 py-3 rounded-xl border-2 text-center transition-all min-w-[90px]"
                                                style={{
                                                    background: selectedDate === day.date ? "var(--color-primary)" : "white",
                                                    borderColor: selectedDate === day.date ? "var(--color-primary)" : "var(--color-border-light)",
                                                    color: selectedDate === day.date ? "white" : "var(--color-text-primary)",
                                                }}
                                            >
                                                <div className="text-xs font-medium opacity-80">
                                                    {day.dayOfWeek.slice(0, 3)}
                                                </div>
                                                <div className="text-lg font-bold">
                                                    {new Date(day.date + "T00:00:00").getDate()}
                                                </div>
                                                <div className="text-xs opacity-70">
                                                    {day.totalAvailable} slots
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Time Grid */}
                                    {selectedDate && (
                                        <div>
                                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--color-text-secondary)" }}>
                                                <Clock className="w-4 h-4" />
                                                Available Times
                                            </h3>
                                            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                                                {weekSchedule
                                                    .find((d) => d.date === selectedDate)
                                                    ?.slots.map((slot) => (
                                                        <button
                                                            key={slot.time}
                                                            disabled={!slot.available}
                                                            onClick={() => setSelectedTime(slot.time)}
                                                            className="py-2.5 px-3 rounded-lg text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                            style={{
                                                                background:
                                                                    selectedTime === slot.time
                                                                        ? "var(--color-primary)"
                                                                        : slot.locked
                                                                            ? "var(--color-warning)"
                                                                            : "white",
                                                                color:
                                                                    selectedTime === slot.time
                                                                        ? "white"
                                                                        : slot.locked
                                                                            ? "white"
                                                                            : slot.available
                                                                                ? "var(--color-text-primary)"
                                                                                : "var(--color-text-light)",
                                                                border: `1px solid ${selectedTime === slot.time
                                                                        ? "var(--color-primary)"
                                                                        : "var(--color-border-light)"
                                                                    }`,
                                                            }}
                                                        >
                                                            {slot.time}
                                                        </button>
                                                    ))}
                                            </div>
                                            <div className="flex items-center gap-4 mt-4 text-xs" style={{ color: "var(--color-text-light)" }}>
                                                <span className="flex items-center gap-1">
                                                    <span className="w-3 h-3 rounded-sm bg-white border" style={{ borderColor: "var(--color-border-light)" }} />
                                                    Available
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <span className="w-3 h-3 rounded-sm" style={{ background: "var(--color-primary)" }} />
                                                    Selected
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <span className="w-3 h-3 rounded-sm" style={{ background: "var(--color-warning)" }} />
                                                    Being booked
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <span className="w-3 h-3 rounded-sm opacity-30" style={{ background: "var(--color-border-light)" }} />
                                                    Unavailable
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </motion.div>
                    )}

                    {/* ─── Step 4: Confirm ─── */}
                    {currentStep === 4 && (
                        <motion.div
                            key="step-4"
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -30 }}
                            transition={{ duration: 0.3 }}
                        >
                            <h2 className="text-xl font-bold mb-4" style={{ color: "var(--color-text-primary)" }}>
                                Confirm Your Appointment
                            </h2>

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Summary Card */}
                                <div className="p-6 rounded-2xl bg-white shadow-sm border" style={{ borderColor: "var(--color-border-light)" }}>
                                    <h3 className="font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
                                        Appointment Summary
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3">
                                            <Stethoscope className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--color-primary)" }} />
                                            <div>
                                                <p className="text-sm" style={{ color: "var(--color-text-light)" }}>Service</p>
                                                <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>{selectedService?.name}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <User className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--color-primary)" }} />
                                            <div>
                                                <p className="text-sm" style={{ color: "var(--color-text-light)" }}>Doctor</p>
                                                <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>{selectedDoctor?.firstName} {selectedDoctor?.lastName}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <Calendar className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--color-primary)" }} />
                                            <div>
                                                <p className="text-sm" style={{ color: "var(--color-text-light)" }}>Date & Time</p>
                                                <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>
                                                    {selectedDate && new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                                                </p>
                                                <p className="font-medium" style={{ color: "var(--color-primary)" }}>{selectedTime}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <Clock className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--color-primary)" }} />
                                            <div>
                                                <p className="text-sm" style={{ color: "var(--color-text-light)" }}>Duration</p>
                                                <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>{selectedService?.duration} minutes</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <MapPin className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--color-primary)" }} />
                                            <div>
                                                <p className="text-sm" style={{ color: "var(--color-text-light)" }}>Location</p>
                                                <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>Nexus Dental Clinic</p>
                                                <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Airport Hills, Accra</p>
                                            </div>
                                        </div>
                                        <hr style={{ borderColor: "var(--color-border-light)" }} />
                                        <div className="flex justify-between items-center">
                                            <span className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>Total</span>
                                            <span className="text-xl font-bold" style={{ color: "var(--color-primary)" }}>
                                                {selectedService && formatPrice(selectedService.price)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Contact Info */}
                                <div className="space-y-4">
                                    <div className="p-6 rounded-2xl bg-white shadow-sm border" style={{ borderColor: "var(--color-border-light)" }}>
                                        <h3 className="font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
                                            Contact Information
                                        </h3>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-sm font-medium block mb-1" style={{ color: "var(--color-text-secondary)" }}>
                                                    Phone Number (for confirmation)
                                                </label>
                                                <div className="relative">
                                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-text-light)" }} />
                                                    <input
                                                        type="tel"
                                                        value={phone}
                                                        onChange={(e) => setPhone(e.target.value)}
                                                        placeholder="+233 XX XXX XXXX"
                                                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2"
                                                        style={{
                                                            borderColor: "var(--color-border-light)",
                                                            color: "var(--color-text-primary)",
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium block mb-1" style={{ color: "var(--color-text-secondary)" }}>
                                                    Additional Notes (optional)
                                                </label>
                                                <textarea
                                                    value={notes}
                                                    onChange={(e) => setNotes(e.target.value)}
                                                    rows={3}
                                                    placeholder="Any allergies, concerns, or special requests..."
                                                    className="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 resize-none"
                                                    style={{
                                                        borderColor: "var(--color-border-light)",
                                                        color: "var(--color-text-primary)",
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div
                                        className="p-4 rounded-xl text-sm"
                                        style={{
                                            background: "rgba(42,127,113,0.05)",
                                            border: "1px solid rgba(42,127,113,0.15)",
                                            color: "var(--color-text-secondary)",
                                        }}
                                    >
                                        <p className="font-medium mb-1" style={{ color: "var(--color-primary)" }}>
                                            Important
                                        </p>
                                        <ul className="space-y-1 text-xs">
                                            <li>• Arrive 15 minutes before your appointment</li>
                                            <li>• Bring valid ID and insurance card (if applicable)</li>
                                            <li>• Cancellations must be made at least 24 hours in advance</li>
                                            <li>• Confirmation will be sent via WhatsApp</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom Navigation Bar */}
            <div
                className="fixed bottom-0 left-0 right-0 p-4 border-t z-50"
                style={{
                    background: "rgba(255,255,255,0.95)",
                    backdropFilter: "blur(10px)",
                    borderColor: "var(--color-border-light)",
                }}
            >
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <button
                        onClick={handleBack}
                        disabled={currentStep === 1}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition disabled:opacity-30"
                        style={{
                            color: "var(--color-text-primary)",
                            background: "var(--color-background-secondary)",
                        }}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </button>

                    {currentStep < 4 ? (
                        <button
                            onClick={handleNext}
                            disabled={!canProceed}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white transition disabled:opacity-40"
                            style={{ background: "var(--color-primary)" }}
                        >
                            Next
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white transition disabled:opacity-70"
                            style={{ background: "var(--color-accent)" }}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Booking...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-4 h-4" />
                                    Confirm Booking
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
