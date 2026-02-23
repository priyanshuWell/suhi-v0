

import { BIAMeasurementStage } from "./api";

export const VIDEO_CONFIG = {
  // Video buffer duration in milliseconds
  // Can be adjusted based on requirements (5000ms = 5 seconds, 7000ms = 7 seconds, etc.)
  BUFFER_DURATION_MS: 5000,
  
  // API endpoints
  API_BASE_URL: "http://127.0.0.1:8000",
  STORE_VIDEO_ENDPOINT: "/video/store",
  RUN_FPT_ENDPOINT: "/video/run-fpt",
  
  // Kiosk configuration
  KIOSK_ID: "KIOSK_001", // Can be made dynamic based on environment or device
  
  // Recording settings
  VIDEO_SETTINGS: {
    width: 640,
    height: 480,
    frameRate: 30,
    mimeType: "video/webm;codecs=vp8",
    videoBitsPerSecond: 1_600_000
  },
  
  // Timing settings
  AVATAR_LEAD_IN_MS: 1000, // Time to wait before starting recording
  POST_VERIFICATION_DELAY_MS: 1000, // Time to wait after verification before navigation
};

/**
 * Get video buffer duration from config or environment
 * @returns {number} Duration in milliseconds
 */
export function getVideoDuration() {
  // Try to read from Vite environment variables first
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_VIDEO_DURATION) {
    return parseInt(import.meta.env.VITE_VIDEO_DURATION, 10);
  }
  
  // Try localStorage as fallback
  if (typeof window !== 'undefined' && window.localStorage) {
    const storedDuration = localStorage.getItem('videoDuration');
    if (storedDuration) return parseInt(storedDuration, 10);
  }
  
  // Return default from config
  return VIDEO_CONFIG.BUFFER_DURATION_MS;
}

/**
 * Get kiosk ID from config or environment
 * @returns {string} Kiosk identifier
 */

export function getKioskId() {
  // Try to read from Vite environment variables first (import.meta.env)
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_KIOSK_ID) {
    return import.meta.env.VITE_KIOSK_ID;
  }
  
  // Try localStorage as fallback
  if (typeof window !== 'undefined' && window.localStorage) {
    const storedKioskId = localStorage.getItem('kioskId');
    if (storedKioskId) return storedKioskId;
  }
  
  // Return default from config
  return VIDEO_CONFIG.KIOSK_ID;
}

export function getSessionId(){
  return crypto.randomUUID();
}

  export const trackStage = async (stage, status, data = {}, error = null,sessionId,userId) => {
    const payload = {
      session_id: sessionId,
      user_id: userId,
      measurement_stage: stage,
      status: status,
      retry_reason: error,
      attempt_number: attemptTracking.current[stage.toLowerCase()] || 1,
      measurement_timestamp: new Date().toISOString(),
      data: {
        ...data,
      }
    };

    try {
      // Replace with your actual fetch/axios call to /bia/measurement/stage
      await BIAMeasurementStage(payload);
    } catch (err) {
      console.error(`[API ERROR] Failed to track stage ${stage}:`, err);
    }
  };