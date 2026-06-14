"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { PreVisitConsent } from "@/components/telehealth/PreVisitConsent";
import { ConsultationRoom } from "@/components/telehealth/ConsultationRoom";
import styles from "./ConsultationPage.module.css";

interface AppointmentDetails {
  id: string;
  patientName: string;
  doctorName: string;
  status: string;
  scheduledTime: string;
}

interface Consultation {
  roomName: string;
  roomUrl: string;
  userName: string;
  userId: string;
  isDoctor: boolean;
  joinUrl: string;
}

export default function ConsultationPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { data: user, isLoading: authLoading } = useCurrentUser();

  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [consentStatus, setConsentStatus] = useState<"PENDING" | "GIVEN" | "LOADING">("LOADING");
  const [showConsent, setShowConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Parse params
  useEffect(() => {
    params.then((p) => setAppointmentId(p.id));
  }, [params]);

  // Fetch appointment and consultation details
  useEffect(() => {
    if (!appointmentId || !user) return;

    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch room details
        const roomRes = await fetch(`/api/telehealth/rooms/${appointmentId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        if (!roomRes.ok) {
          if (roomRes.status === 404) {
            setError("Consultation room not found. The appointment may not have started yet.");
            setLoading(false);
            return;
          }
          throw new Error("Failed to fetch room details");
        }

        const roomData = await roomRes.json();
        setAppointment(roomData.appointment);
        setConsultation(roomData.consultation);

        // Check consent status
        const consentRes = await fetch(`/api/telehealth/consents?appointmentId=${appointmentId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        if (consentRes.ok) {
          const consentData = await consentRes.json();
          setConsentStatus(consentData.consentStatus);
          if (consentData.consentStatus === "PENDING") {
            setShowConsent(true);
          }
        }

        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching consultation details:", err);
        setError(err.message || "Failed to load consultation");
        setLoading(false);
      }
    };

    fetchDetails();
  }, [appointmentId, user]);

  const handleConsentGiven = async (consentData: any) => {
    try {
      const res = await fetch("/api/telehealth/consents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(consentData),
      });

      if (!res.ok) throw new Error("Failed to save consent");

      setConsentStatus("GIVEN");
      setShowConsent(false);
    } catch (err: any) {
      setError(err.message || "Failed to save consent");
    }
  };

  const handleSessionEnd = async () => {
    try {
      if (user?.roles?.includes("DOCTOR")) {
        await fetch(`/api/telehealth/rooms/${appointmentId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ saveTranscription: true }),
        });
      }
      router.push("/patient/appointments");
    } catch (err) {
      console.error("Error ending session:", err);
    }
  };

  // Loading state
  if (authLoading || loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingScreen}>
          <div className={styles.spinner} />
          <p>Loading consultation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorScreen}>
          <h2>Unable to Join Consultation</h2>
          <p>{error}</p>
          <button onClick={() => router.back()} className={styles.backButton}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Pre-visit consent required
  if (showConsent && appointment && user?.type === "PATIENT") {
    return (
      <PreVisitConsent
        appointmentId={appointmentId!}
        patientName={appointment.patientName}
        doctorName={appointment.doctorName}
        onConsentGiven={handleConsentGiven}
        onCancel={() => router.back()}
        isLoading={loading}
      />
    );
  }

  // Video consultation room
  if (consultation && consultation.roomUrl) {
    return (
      <ConsultationRoom
        roomUrl={consultation.roomUrl}
        userName={consultation.userName}
        appointmentId={appointmentId!}
        isDoctor={consultation.isDoctor}
        onSessionEnd={handleSessionEnd}
      />
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.waitingScreen}>
        <h2>Preparing Consultation...</h2>
        <p>The doctor will join shortly. Please wait.</p>
        <div className={styles.spinner} />
      </div>
    </div>
  );
}
