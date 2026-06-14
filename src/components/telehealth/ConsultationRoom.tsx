"use client";

import styles from "./ConsultationRoom.module.css";

interface ConsultationRoomProps {
  roomUrl: string;
  userName: string;
  appointmentId: string;
  isDoctor: boolean;
  onSessionEnd?: () => void;
}

export function ConsultationRoom({
  roomUrl,
  userName,
  appointmentId,
  isDoctor,
  onSessionEnd,
}: ConsultationRoomProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Video Consultation</h2>
        <span className={styles.userName}>Connected as: {userName}</span>
      </div>
      <iframe
        className={styles.videoFrame}
        src={roomUrl}
        title={`Consultation - ${appointmentId}`}
        allow="camera; microphone; display-capture"
      />
    </div>
  );
}
