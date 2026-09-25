"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
    Stethoscope, User, Calendar, CheckCircle, Loader2, Info
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Service { id: string; name: string; description: string; category: string; price: number; duration: number; }
interface Doctor { id: string; firstName: string; lastName: string; specialty: string | null; avatar: string | null; }
interface TimeSlot { time: string; available: boolean; locked: boolean; }
interface DaySchedule { date: string; dayOfWeek: string; slots: TimeSlot[]; totalAvailable: number; }

const STEPS = [
    { id: 1, label: "Services", icon: Stethoscope },
    { id: 2, label: "Doctor", icon: User },
    { id: 3, label: "Date & Time", icon: Calendar },
    { id: 4, label: "Details", icon: Info },
];

export default function BookingPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    
    // Selections
    const [selectedServices, setSelectedServices] = useState<Service[]>([]);
    const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    
    // Patient Details
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phone, setPhone] = useState("");
    const [notes, setNotes] = useState("");
    
    // Data
    const [services, setServices] = useState<Service[]>([]);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [schedule, setSchedule] = useState<DaySchedule[]>([]);
    
    // UI State
    const [loadingServices, setLoadingServices] = useState(true);
    const [loadingDoctors, setLoadingDoctors] = useState(true);
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isBooked, setIsBooked] = useState(false);

    // Initial Fetch
    useEffect(() => {
        async function fetchInitialData() {
            try {
                const [servicesRes, doctorsRes] = await Promise.all([
                    fetch(`/api/services`),
                    fetch(`/api/appointments/doctors`)
                ]);
                const servicesData = await servicesRes.json();
                const doctorsData = await doctorsRes.json();
                
                if (servicesData.success) setServices(servicesData.data.services);
                if (doctorsData.success) setDoctors(doctorsData.data.doctors);
            } catch {
                toast.error("Error loading initial data.");
            } finally {
                setLoadingServices(false);
                setLoadingDoctors(false);
            }
        }
        fetchInitialData();
    }, []);

    // Total Duration and Price
    const totalDuration = useMemo(() => selectedServices.reduce((acc, s) => acc + s.duration, 0), [selectedServices]);
    const totalPrice = useMemo(() => selectedServices.reduce((acc, s) => acc + s.price, 0), [selectedServices]);

    // Fetch Schedule
    useEffect(() => {
        if (selectedDoctor && selectedServices.length > 0) {
            async function fetchSchedule() {
                setLoadingSchedule(true);
                setSchedule([]);
                setSelectedDate(null);
                setSelectedTime(null);
                try {
                    const today = new Date().toISOString().split("T")[0];
                    const res = await fetch(`/api/appointments/slots?doctorId=${selectedDoctor!.id}&date=${today}&mode=week&days=28&duration=${totalDuration}`);
                    const data = await res.json();
                    if (data.success) {
                        setSchedule(data.data.schedules);
                    } else {
                        toast.error(data.error || "Failed to load schedule");
                    }
                } catch {
                    toast.error("Error fetching schedule");
                } finally {
                    setLoadingSchedule(false);
                }
            }
            fetchSchedule();
        }
    }, [selectedDoctor, selectedServices.length, totalDuration]);

    const toggleService = (service: Service) => {
        setSelectedServices(prev => 
            prev.find(s => s.id === service.id) 
                ? prev.filter(s => s.id !== service.id)
                : [...prev, service]
        );
    };

    const handleNext = () => {
        if (currentStep === 1 && selectedServices.length === 0) return toast.error("Select at least one service");
        if (currentStep === 2 && !selectedDoctor) return toast.error("Select a doctor");
        if (currentStep === 3 && (!selectedDate || !selectedTime)) return toast.error("Select date and time");
        if (currentStep < 4) setCurrentStep(s => s + 1);
    };

    const handleSubmit = async () => {
        if (!firstName || !lastName || !phone) {
            return toast.error("Please fill in your details.");
        }
        let formattedPhone = phone.trim();
        if (formattedPhone.startsWith("0")) formattedPhone = formattedPhone.substring(1);
        if (!formattedPhone.startsWith("+233")) formattedPhone = `+233${formattedPhone}`;

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/appointments/book", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    serviceIds: selectedServices.map(s => s.id),
                    doctorId: selectedDoctor?.id,
                    date: selectedDate,
                    time: selectedTime,
                    firstName,
                    lastName,
                    phone: formattedPhone,
                    notes,
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Appointment booked successfully!");
                setIsBooked(true);
            } else {
                toast.error(data.error || "Failed to book appointment.");
            }
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatPrice = (price: number) => `GH₵ ${price.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;

    if (isBooked) {
        return (
            <div className="min-h-[70vh] bg-[linear-gradient(135deg,#f7fbfa,#edf8f6)] flex flex-col items-center justify-center p-5">
                <div className="surface-card max-w-md w-full p-8 rounded-[2rem] text-center">
                    <CheckCircle className="w-16 h-16 text-primary mx-auto mb-6" />
                    <h2 className="font-[family-name:var(--font-heading)] text-3xl mb-2 text-secondary">Booking confirmed</h2>
                    <p className="text-text-secondary mb-6">Your appointment is reserved. We will send an SMS confirmation shortly.</p>
                    <button 
                        onClick={() => router.push("/auth/patient")}
                        className="btn-primary w-full py-3"
                    >
                        Go to patient portal
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bg pb-32">
            <div className="bg-[linear-gradient(135deg,#f7fbfa,#edf8f6)] px-4 py-12 text-center sm:py-16">
                <span className="eyebrow">Plan your visit</span>
                <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl text-secondary sm:text-5xl">Book an appointment</h1>
                <p className="mt-3 text-text-secondary">Choose your care, clinician, and preferred time in four clear steps.</p>
            </div>

            {/* Stepper */}
            <div className="relative mx-auto my-8 flex max-w-3xl items-center justify-between px-4 sm:my-10">
                {STEPS.map((step) => (
                    <div key={step.id} className="flex-1 flex flex-col items-center relative z-10">
                        <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors ${currentStep >= step.id ? 'bg-primary text-white shadow-sm' : 'bg-white text-text-muted border border-border'}`}>
                            <step.icon className="w-5 h-5" />
                        </div>
                        <span className={`text-center text-[11px] font-semibold sm:text-xs ${currentStep >= step.id ? 'text-primary-dark' : 'text-text-muted'}`}>{step.label}</span>
                    </div>
                ))}
                <div className="absolute top-5 left-10 right-10 h-0.5 bg-border z-0">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }} />
                </div>
            </div>

            <div className="surface-card mx-auto max-w-4xl rounded-[2rem] p-5 sm:p-8 lg:p-10">
                {currentStep === 1 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h2 className="font-[family-name:var(--font-heading)] text-2xl text-secondary mb-5">Select services</h2>
                        {loadingServices ? (
                            <div className="flex justify-center py-14"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                        ) : services.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border bg-bg p-7 text-center">
                                <p className="font-semibold text-secondary">Online service selection is temporarily unavailable.</p>
                                <p className="mt-2 text-sm text-text-secondary">Contact the clinic for help arranging your visit.</p>
                                <Link href="/contact" className="mt-4 inline-flex text-sm font-bold text-primary-dark">Get booking help</Link>
                            </div>
                        ) : (
                        <div className="grid md:grid-cols-2 gap-4">
                            {services.map(s => {
                                const isSelected = selectedServices.some(sel => sel.id === s.id);
                                return (
                                    <button 
                                        key={s.id} 
                                        onClick={() => toggleService(s)}
                                        className={`rounded-2xl border p-5 text-left transition ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40 hover:bg-bg/60'}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-semibold">{s.name}</h3>
                                            <span className="text-xs bg-primary/10 text-primary-dark px-2 py-1 rounded-full">{s.category}</span>
                                        </div>
                                        <p className="text-sm text-slate-500 mb-3">{s.description}</p>
                                        <div className="flex gap-4 text-sm font-medium">
                                            <span className="text-primary-dark">{formatPrice(s.price)}</span>
                                            <span className="text-slate-500">{s.duration} min</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        )}
                    </motion.div>
                )}

                {currentStep === 2 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h2 className="font-[family-name:var(--font-heading)] text-2xl text-secondary mb-5">Select a clinician</h2>
                        {loadingDoctors ? (
                            <div className="flex justify-center py-14"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                        ) : doctors.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border bg-bg p-7 text-center">
                                <p className="font-semibold text-secondary">No clinicians are available for online selection right now.</p>
                                <p className="mt-2 text-sm text-text-secondary">Contact the clinic and the team can help plan your visit.</p>
                                <Link href="/contact" className="mt-4 inline-flex text-sm font-bold text-primary-dark">Contact the clinic</Link>
                            </div>
                        ) : (
                        <div className="grid md:grid-cols-2 gap-4">
                            {doctors.map(d => (
                                <button 
                                    key={d.id} 
                                    onClick={() => setSelectedDoctor(d)}
                                    className={`p-5 flex items-center gap-4 text-left border rounded-2xl transition ${selectedDoctor?.id === d.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40 hover:bg-bg/60'}`}
                                >
                                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary-dark flex items-center justify-center font-bold text-lg">
                                        {d.firstName[0]}{d.lastName[0]}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">{d.firstName} {d.lastName}</h3>
                                        <p className="text-sm text-slate-500">{d.specialty || "General Dentist"}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                        )}
                    </motion.div>
                )}

                {currentStep === 3 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h2 className="font-[family-name:var(--font-heading)] text-2xl text-secondary mb-5">Select date and time</h2>
                        {loadingSchedule ? (
                            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto my-12" />
                        ) : (
                            <>
                                <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide snap-x">
                                    {schedule.map(day => (
                                        <button 
                                            key={day.date} 
                                            onClick={() => { setSelectedDate(day.date); setSelectedTime(null); }}
                                            className={`shrink-0 snap-start p-3 w-20 text-center rounded-xl border transition ${selectedDate === day.date ? 'bg-primary border-primary text-white' : 'border-border bg-white hover:border-primary/50'}`}
                                        >
                                            <div className="text-xs uppercase">{day.dayOfWeek.slice(0, 3)}</div>
                                            <div className="text-xl font-bold my-1">{new Date(day.date).getDate()}</div>
                                            <div className="text-[10px] opacity-80">{new Date(day.date).toLocaleString('default', { month: 'short' })}</div>
                                        </button>
                                    ))}
                                </div>
                                {selectedDate && (
                                    <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                                        {schedule.find(d => d.date === selectedDate)?.slots.map(slot => (
                                            <button 
                                                key={slot.time}
                                                disabled={!slot.available}
                                                onClick={() => setSelectedTime(slot.time)}
                                                className={`py-2 rounded-lg text-sm font-medium transition ${selectedTime === slot.time ? 'bg-primary text-white border-primary' : slot.available ? 'border border-border hover:border-primary' : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-transparent'}`}
                                            >
                                                {slot.time}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </motion.div>
                )}

                {currentStep === 4 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h2 className="font-[family-name:var(--font-heading)] text-2xl text-secondary mb-5">Review and confirm</h2>
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4 bg-bg p-6 rounded-2xl border border-border-light">
                                <h3 className="font-semibold border-b pb-2 mb-4">Summary</h3>
                                <div><span className="text-slate-500 text-sm">Services:</span><br/><b>{selectedServices.map(s=>s.name).join(', ')}</b></div>
                                <div><span className="text-slate-500 text-sm">Doctor:</span><br/><b>{selectedDoctor?.firstName} {selectedDoctor?.lastName}</b></div>
                                <div><span className="text-slate-500 text-sm">Date & Time:</span><br/><b>{selectedDate} @ {selectedTime}</b></div>
                                <div className="border-t pt-2 mt-4 flex justify-between">
                                    <span className="font-semibold">Total</span>
                                    <span className="font-bold text-primary-dark text-lg">{formatPrice(totalPrice)}</span>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium mb-1 block">First Name *</label>
                                    <input type="text" value={firstName} onChange={e=>setFirstName(e.target.value)} className="w-full border p-3 rounded-xl" placeholder="John" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Last Name *</label>
                                    <input type="text" value={lastName} onChange={e=>setLastName(e.target.value)} className="w-full border p-3 rounded-xl" placeholder="Doe" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Phone Number *</label>
                                    <div className="relative flex items-center">
                                        <div className="absolute left-3 z-10 flex items-center gap-2">
                                            <span className="text-lg">🇬🇭</span>
                                            <span className="text-sm font-semibold text-slate-600">+233</span>
                                            <div className="h-4 w-[1px] bg-slate-300 mx-1"></div>
                                        </div>
                                        <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full border pl-[95px] pr-3 py-3 rounded-xl text-lg tracking-wide focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="24 000 0000" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Notes (Optional)</label>
                                    <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} className="w-full border p-3 rounded-xl" placeholder="Any special requests..."></textarea>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>

            <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white/95 p-3 shadow-[0_-8px_30px_rgba(16,42,67,0.08)] backdrop-blur sm:p-4">
                <div className="mx-auto flex max-w-4xl justify-between gap-3">
                    <button
                        onClick={() => currentStep > 1 ? setCurrentStep(s => s - 1) : router.back()}
                        className="min-h-12 rounded-xl bg-bg px-5 font-semibold text-secondary hover:bg-slate-100 sm:px-7"
                    >
                        Back
                    </button>
                    {currentStep < 4 ? (
                        <button
                            onClick={handleNext}
                            className="btn-primary min-h-12 px-6 sm:px-8"
                        >
                            Next step
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="btn-primary min-h-12 px-5 sm:px-8"
                        >
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm booking"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
