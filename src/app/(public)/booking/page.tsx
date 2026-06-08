"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Stethoscope, User, Calendar, CheckCircle, Clock, DollarSign, MapPin, Phone, Loader2, Info
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
            } catch (error) {
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
                } catch (error) {
                    toast.error("Error fetching schedule");
                } finally {
                    setLoadingSchedule(false);
                }
            }
            fetchSchedule();
        }
    }, [selectedDoctor, totalDuration]);

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
                    phone,
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
        } catch (error) {
            toast.error("Network error. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatPrice = (price: number) => `GH₵ ${price.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;

    if (isBooked) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center">
                    <CheckCircle className="w-20 h-20 text-teal-500 mx-auto mb-6" />
                    <h2 className="text-2xl font-bold mb-2 text-slate-800">Booking Confirmed!</h2>
                    <p className="text-slate-500 mb-6">We've reserved your slot. You will receive an SMS shortly.</p>
                    <button 
                        onClick={() => router.push("/auth/patient")}
                        className="w-full bg-teal-600 text-white font-medium py-3 rounded-xl hover:bg-teal-700 transition"
                    >
                        Go to Patient Portal
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-32">
            <div className="pt-28 pb-8 px-4 text-center">
                <h1 className="text-3xl font-bold mb-2">Book Appointment</h1>
                <p className="text-slate-500">Complete the steps below to reserve your slot.</p>
            </div>

            {/* Stepper */}
            <div className="max-w-3xl mx-auto px-4 mb-8 flex justify-between items-center relative">
                {STEPS.map((step, idx) => (
                    <div key={step.id} className="flex-1 flex flex-col items-center relative z-10">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors ${currentStep >= step.id ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                            <step.icon className="w-5 h-5" />
                        </div>
                        <span className={`text-xs font-medium ${currentStep >= step.id ? 'text-teal-600' : 'text-slate-400'}`}>{step.label}</span>
                    </div>
                ))}
                <div className="absolute top-5 left-10 right-10 h-0.5 bg-slate-200 z-0">
                    <div className="h-full bg-teal-600 transition-all duration-300" style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }} />
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4">
                {currentStep === 1 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h2 className="text-xl font-bold mb-4">Select Services</h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            {services.map(s => {
                                const isSelected = selectedServices.some(sel => sel.id === s.id);
                                return (
                                    <button 
                                        key={s.id} 
                                        onClick={() => toggleService(s)}
                                        className={`p-4 text-left border-2 rounded-xl transition ${isSelected ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-teal-200'}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-semibold">{s.name}</h3>
                                            <span className="text-xs bg-teal-100 text-teal-800 px-2 py-1 rounded-full">{s.category}</span>
                                        </div>
                                        <p className="text-sm text-slate-500 mb-3">{s.description}</p>
                                        <div className="flex gap-4 text-sm font-medium">
                                            <span className="text-teal-700">{formatPrice(s.price)}</span>
                                            <span className="text-slate-500">{s.duration} min</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {currentStep === 2 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h2 className="text-xl font-bold mb-4">Select Doctor</h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            {doctors.map(d => (
                                <button 
                                    key={d.id} 
                                    onClick={() => setSelectedDoctor(d)}
                                    className={`p-4 flex items-center gap-4 text-left border-2 rounded-xl transition ${selectedDoctor?.id === d.id ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-teal-200'}`}
                                >
                                    <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-lg">
                                        {d.firstName[0]}{d.lastName[0]}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">{d.firstName} {d.lastName}</h3>
                                        <p className="text-sm text-slate-500">{d.specialty || "General Dentist"}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}

                {currentStep === 3 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h2 className="text-xl font-bold mb-4">Select Date & Time</h2>
                        {loadingSchedule ? (
                            <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto my-12" />
                        ) : (
                            <>
                                <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide snap-x">
                                    {schedule.map(day => (
                                        <button 
                                            key={day.date} 
                                            onClick={() => { setSelectedDate(day.date); setSelectedTime(null); }}
                                            className={`shrink-0 snap-start p-3 w-20 text-center rounded-xl border transition ${selectedDate === day.date ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-200 hover:border-teal-300'}`}
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
                                                className={`py-2 rounded-lg text-sm font-medium transition ${selectedTime === slot.time ? 'bg-teal-600 text-white border-teal-600' : slot.available ? 'border border-slate-200 hover:border-teal-400' : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-transparent'}`}
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
                        <h2 className="text-xl font-bold mb-4">Finalize Details</h2>
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <h3 className="font-semibold border-b pb-2 mb-4">Summary</h3>
                                <div><span className="text-slate-500 text-sm">Services:</span><br/><b>{selectedServices.map(s=>s.name).join(', ')}</b></div>
                                <div><span className="text-slate-500 text-sm">Doctor:</span><br/><b>{selectedDoctor?.firstName} {selectedDoctor?.lastName}</b></div>
                                <div><span className="text-slate-500 text-sm">Date & Time:</span><br/><b>{selectedDate} @ {selectedTime}</b></div>
                                <div className="border-t pt-2 mt-4 flex justify-between">
                                    <span className="font-semibold">Total</span>
                                    <span className="font-bold text-teal-700 text-lg">{formatPrice(totalPrice)}</span>
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
                                        <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full border pl-[95px] pr-3 py-3 rounded-xl text-lg tracking-wide focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" placeholder="24 000 0000" />
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

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-between shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50">
                <button 
                    onClick={() => currentStep > 1 ? setCurrentStep(s => s - 1) : router.back()} 
                    className="px-6 py-3 font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
                >
                    Back
                </button>
                {currentStep < 4 ? (
                    <button 
                        onClick={handleNext} 
                        className="px-8 py-3 font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700"
                    >
                        Next Step
                    </button>
                ) : (
                    <button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting}
                        className="px-8 py-3 font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 flex items-center gap-2"
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Booking"}
                    </button>
                )}
            </div>
        </div>
    );
}
