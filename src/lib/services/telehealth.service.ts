// ============================================
// NEXUS DENTAL — Telehealth Service
// Daily.co room management for video consultations
// ============================================

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = "https://api.daily.co/v1";

interface RoomConfig {
  name: string;
  privacy: "private" | "public";
  max_participants: number;
  exp?: number; // Room expiration time (Unix timestamp)
}

interface RoomResponse {
  id: string;
  name: string;
  privacy: string;
  max_participants: number;
  created_at: string;
  url: string;
  config: {
    nbf?: number;
    exp?: number;
  };
}

interface SessionToken {
  token: string;
  room_name: string;
  user_name: string;
  user_id: string;
  is_owner: boolean;
}

export class TelehealthService {
  /**
   * Create a Daily.co room for a consultation
   */
  static async createConsultationRoom(config: {
    appointmentId: string;
    patientName: string;
    doctorName: string;
    durationMinutes?: number;
  }): Promise<RoomResponse> {
    if (!DAILY_API_KEY) {
      throw new Error("DAILY_API_KEY not configured");
    }

    const roomName = `apt-${config.appointmentId}-${Date.now()}`;
    const expiresInHours = config.durationMinutes ? Math.ceil(config.durationMinutes / 60) + 1 : 2;

    const roomConfig: RoomConfig = {
      name: roomName,
      privacy: "private",
      max_participants: 10,
      exp: Math.floor(Date.now() / 1000) + expiresInHours * 3600,
    };

    const response = await fetch(`${DAILY_API_URL}/rooms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(roomConfig),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("[Telehealth] Failed to create room:", error);
      throw new Error(`Failed to create consultation room: ${error.error?.message}`);
    }

    const room = (await response.json()) as RoomResponse;
    return room;
  }

  /**
   * Generate a session token for a participant
   * Used for patient and doctor access to the room
   */
  static async generateSessionToken(config: {
    roomName: string;
    userId: string;
    userName: string;
    isDoctor: boolean;
  }): Promise<SessionToken> {
    if (!DAILY_API_KEY) {
      throw new Error("DAILY_API_KEY not configured");
    }

    // Daily.co session tokens are created server-side with the room API
    // We'll use the room directly and generate client tokens
    const expiresInMinutes = 2 * 60; // 2 hours
    const exp = Math.floor(Date.now() / 1000) + expiresInMinutes * 60;

    // Note: Daily.co uses their daily-js SDK to generate tokens on client side
    // For server-side token generation, use library like node-jose or jwt
    // For now, we return room info and let client SDK handle token generation
    return {
      token: "", // Client will get this via Daily SDK
      room_name: config.roomName,
      user_name: config.userName,
      user_id: config.userId,
      is_owner: config.isDoctor,
    };
  }

  /**
   * Get room information
   */
  static async getRoomInfo(roomName: string): Promise<RoomResponse> {
    if (!DAILY_API_KEY) {
      throw new Error("DAILY_API_KEY not configured");
    }

    const response = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch room info: ${error.error?.message}`);
    }

    return response.json();
  }

  /**
   * Delete a room (end consultation)
   */
  static async deleteRoom(roomName: string): Promise<void> {
    if (!DAILY_API_KEY) {
      throw new Error("DAILY_API_KEY not configured");
    }

    const response = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("[Telehealth] Failed to delete room:", error);
      throw new Error(`Failed to end consultation: ${error.error?.message}`);
    }
  }

  /**
   * Record a consultation session
   * Records are stored in Daily.co cloud storage
   */
  static async startRecording(roomName: string): Promise<void> {
    if (!DAILY_API_KEY) {
      throw new Error("DAILY_API_KEY not configured");
    }

    const response = await fetch(`${DAILY_API_URL}/rooms/${roomName}/start-recording`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok && response.status !== 404) {
      // 404 might indicate endpoint not available in free tier
      console.warn("[Telehealth] Recording may not be available", response.status);
    }
  }

  /**
   * Stop recording a session
   */
  static async stopRecording(roomName: string): Promise<void> {
    if (!DAILY_API_KEY) {
      throw new Error("DAILY_API_KEY not configured");
    }

    const response = await fetch(`${DAILY_API_URL}/rooms/${roomName}/stop-recording`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok && response.status !== 404) {
      console.warn("[Telehealth] Stop recording may not be available", response.status);
    }
  }

  /**
   * Get transcription for a recorded session
   */
  static async getTranscription(roomName: string): Promise<any> {
    if (!DAILY_API_KEY) {
      throw new Error("DAILY_API_KEY not configured");
    }

    const response = await fetch(`${DAILY_API_URL}/transcriptions?room_name=${roomName}`, {
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.warn("[Telehealth] Transcription not available");
      return null;
    }

    return response.json();
  }
}
