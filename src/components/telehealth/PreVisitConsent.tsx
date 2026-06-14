"use client";

import { useState } from "react";
import styles from "./PreVisitConsent.module.css";

interface PreVisitConsentProps {
  appointmentId: string;
  patientName: string;
  doctorName: string;
  onConsentGiven: (consentData: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PreVisitConsent({
  appointmentId,
  patientName,
  doctorName,
  onConsentGiven,
  onCancel,
  isLoading = false,
}: PreVisitConsentProps) {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToRecording, setAgreedToRecording] = useState(false);
  const [agreedToDataUse, setAgreedToDataUse] = useState(false);

  const canProceed = agreedToTerms && agreedToRecording && agreedToDataUse;

  const handleConsent = () => {
    onConsentGiven({
      appointmentId,
      recordingConsent: agreedToRecording,
      dataUseConsent: agreedToDataUse,
      termsAccepted: agreedToTerms,
      consentedAt: new Date().toISOString(),
    });
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Pre-Visit Consent</h2>
          <p className={styles.subtitle}>
            Please review and accept the following before your consultation with Dr. {doctorName}
          </p>
        </div>

        <div className={styles.content}>
          {/* Telehealth Terms */}
          <div className={styles.consentItem}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                disabled={isLoading}
              />
              <span>
                I agree to the <strong>Telehealth Services Terms & Conditions</strong>
              </span>
            </label>
            <div className={styles.consentText}>
              <p>
                I understand that this is a virtual consultation and acknowledge that it may have limitations
                compared to an in-person visit. I confirm that I have a reliable internet connection and a
                suitable private location for this consultation.
              </p>
            </div>
          </div>

          {/* Recording Consent */}
          <div className={styles.consentItem}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={agreedToRecording}
                onChange={(e) => setAgreedToRecording(e.target.checked)}
                disabled={isLoading}
              />
              <span>
                I consent to <strong>recording and storing</strong> this consultation
              </span>
            </label>
            <div className={styles.consentText}>
              <p>
                This consultation may be recorded for quality assurance, training, and compliance purposes.
                Recordings will be stored securely and accessed only by authorized personnel. You may revoke
                this consent verbally at any time during the consultation.
              </p>
            </div>
          </div>

          {/* Data Use Consent */}
          <div className={styles.consentItem}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={agreedToDataUse}
                onChange={(e) => setAgreedToDataUse(e.target.checked)}
                disabled={isLoading}
              />
              <span>
                I consent to <strong>data privacy & HIPAA compliance</strong>
              </span>
            </label>
            <div className={styles.consentText}>
              <p>
                I acknowledge that my health information will be collected, stored, and processed in accordance
                with HIPAA regulations. My data will not be shared with third parties without my consent except
                as required by law.
              </p>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className={styles.privacyNotice}>
            <strong>Privacy Notice:</strong> Your consultation is confidential and transmitted with end-to-end
            encryption. Only you and Dr. {doctorName} can access this session.
          </div>
        </div>

        <div className={styles.actions}>
          <button
            className={styles.cancelButton}
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel Consultation
          </button>
          <button
            className={styles.proceedButton}
            onClick={handleConsent}
            disabled={!canProceed || isLoading}
          >
            {isLoading ? "Preparing..." : "I Agree & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
