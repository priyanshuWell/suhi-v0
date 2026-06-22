import axios from "axios";
const FPT_API_BASE_URL = "http://127.0.0.1:9000";
const API_BASE_URL = "http://127.0.0.1:8000";
const VOICE_API_BASE_URL = "http://127.0.0.1:9100"
/**
 * Send a video buffer to the backend
 * @param {Object} videoData - Object containing role, deviceId, and buffer
 * @returns {Promise<Object>} Response with success status and shm_path
 */
export async function sendVideoToBackend(videoData) {
  console.log(videoData);
  try {
    // Convert Uint8Array to Blob
    const videoBlob = new Blob([videoData.buffer], { type: 'video/webm' });

    console.log("Uploading file:", `${videoData.role}_${videoData.deviceId}.webm`);
    console.log("Uploading mimeType:", videoBlob.type);

    
    // Create FormData to send the video file
    // const formData = new FormData();
    // formData.append('video', videoBlob, `${videoData.role}_${videoData.deviceId}.webm`);
    // formData.append('role', videoData.role);
    // formData.append('deviceId', videoData.deviceId);

    const formData = new FormData();
formData.append('file', videoBlob, `${videoData.role}_${videoData.deviceId}.webm`);


    const response = await fetch(`${API_BASE_URL}/video/store`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      shm_path: data.shm_path,
      ...data
    };
  } catch (error) {
    console.error("Error sending video to backend:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function sendVoiceToBackend(voiceData) {
  console.log(voiceData);
  try {
    // Convert Uint8Array to Blob
    const audioBlob = new Blob([voiceData.buffer], { type: 'audio/wav' });

    console.log("Uploading file:", `${voiceData.role}_${voiceData.timestamp}.wav`);
    console.log("Uploading mimeType:", audioBlob.type);

    const formData = new FormData();
    formData.append(
      'file',
      audioBlob,
      `${voiceData.role}_${voiceData.timestamp}.wav`
    );

    const response = await fetch(`${API_BASE_URL}/voice/store`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      shm_path: data.shm_path,
      ...data
    };

  } catch (error) {
    console.error("Error sending voice to backend:", error);

    return {
      success: false,
      error: error.message
    };
  }
}

export async function loginSuhi(suhi_id) {
  try {
    const response = await fetch(`${API_BASE_URL}/kiosk_user/${suhi_id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      ...data
    };
  } catch (error) {
    console.error("Error logging in:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function getStudentBySuhi(suhi_id) {
  try {
    const response = await fetch(`${API_BASE_URL}/students/${suhi_id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      ...data
    };
  } catch (error) {
    console.error("Error fetching student by suhi id:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function runVoice(payload) {
 try {

    const response = await fetch(`${API_BASE_URL}/voice/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      ...data
    };
  } catch (error) {
    console.error("Error running FPT:", error);
    return {
      success: false,
      error: error.message
    };
}
}


export async function realtimeCapture(kiosk_id=null) {
  try {
    const payload = {
      kiosk_id: "aabbcc44",
      camera_index: 6,
      max_seconds: 5,
      quality_threshold: 40
    };

    const response = await fetch(`${API_BASE_URL}/realtime/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || "Realtime capture failed");
    }

    return {
      success: true,
      ...data
    };

  } catch (error) {
    console.error("Realtime capture error:", error);

    return {
      success: false,
      error: error.message
    };
  }
}

export async function colorBlindessStart(userId, kiosk_id, screeningSessionId = null){
  try {
    const payload ={
      user_id:userId,
      kiosk_id
    }

    const response = await fetch(`${API_BASE_URL}/color-blindness/start`,{
       method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

     if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      ...data
    };

  } catch (error) {
    console.error("Error running FPT:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function colorBlindessComplete(sessionId=null, screeningSessionId = null){
  try {
    const payload ={
    screening_session_id: screeningSessionId,
    session_id:sessionId,
    }

    const response = await fetch(`${API_BASE_URL}/color-blindness/complete`,{
       method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

     if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      ...data
    };

  } catch (error) {
    console.error("Error running FPT:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function colorBlindessSubmit(sessionId,plateId,selectedAnswer,noResponse,responseTimeMs){
  console.log("colorBlindessSubmit",sessionId,plateId,selectedAnswer,noResponse,responseTimeMs)
  try {
    const payload ={
      session_id:sessionId,
      plate_id:plateId,
      selected_answer:selectedAnswer,
      no_response:noResponse,
      response_time_ms:responseTimeMs,
    }

    const response = await fetch(`${API_BASE_URL}/color-blindness/response`,{
       method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

     if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      ...data
    };

  } catch (error) {
    console.error("Error running FPT:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function getColorBlindessPlates(){
  try {
    const response = await fetch(`${API_BASE_URL}/plates/seed`,{
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      ...data
    };

  } catch (error) {
    console.error("Error running FPT:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function runFPT(shmPath, kioskId) {
  try {
    const payload = {
      shm_path: shmPath,
      kiosk_id: kioskId
    };

    const response = await fetch(`${API_BASE_URL}/video/run-fpt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      ...data
    };
  } catch (error) {
    console.error("Error running FPT:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function bufferCollection(shmPath, kioskId, user_id, bufferType = "BIA") {
  try {
    const payload = {
      shm_path: shmPath,
      kiosk_id: kioskId,
      user_id,
      buffer_type: bufferType,
    };

    const response = await fetch(`${API_BASE_URL}/video/buffer-collection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      ...data
    };
  } catch (error) {
    console.error("Error running FPT:", error);
    return {
      success: false,
      error: error.message
    };
  }
}


/**
 * Send all three videos to backend (for future use if needed)
 * @param {Array} recordings - Array of video recordings
 * @returns {Promise<Array>} Array of responses with shm_paths
 */
export const BIAMeasurementStage = async (stage) => {
  try {
    const response = await fetch(`${API_BASE_URL}/bia/measurement/stage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stage), // ✅ FIXED
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    console.log("BIA measurement stage response:", data);
    return {
      success: true,
      ...data
    };
  } catch (error) {
    console.error("Error sending BIA measurement stage to backend:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const voiceSaveApi = async (payload) => {
  try {
    const response = await fetch(`${VOICE_API_BASE_URL}/voice/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Voice API tatus: ${response.status}`);
    }

    const data = await response.json();
    console.log("Voice save response:", data);
    return {
      success: true,
      ...data
    };
  } catch (error) {
    console.error("Error sending voice save to backend:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

export const DivideAttentionSession = async (userId, sessionId, sessionType) => {

  /*
{
  "user_id": "bdabcfad-558f-4d36-9cfd-5deaedfdd629",
  session_id:"bdabcfad-558f-4d36-9cfd-5deaedfdd629",
  "session_type": "practice"
}

  */
  const payload = {
    user_id:userId,
    session_id:sessionId,
    session_type:sessionType
  }
  try {
    const response = await fetch(`${API_BASE_URL}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Divide attention session response:", data);
    return {
      success: true,
      ...data
    };
  } catch (error) {
    console.error("Error sending divide attention session to backend:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

export const DivideAttentionTrialStart = async (payload) => {
  /*
{
  "session_id": "75e8516d-c2f4-4286-b0ae-055c55232c9c",
  "trial_number": 1,
  "trial_type": "practice",
  "num_targets": 2,
  "num_distractors": 2,
  "total_objects": 4
}
  */
  try {
    const response = await fetch(`${API_BASE_URL}/trials/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Divide attention trial start response:", data);
    return {
      success: true,
      ...data
    };
  } catch (error) {
    console.error("Error sending divide attention trial start to backend:", error);
    return {
      success: false,
      error: error.message
    };
  }
} 

export const DivideAttentionTrialComplete = async (trial_id,payload) => {
  try {
    const response = await fetch(`${API_BASE_URL}/trials/${trial_id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Divide attention trial complete response:", data);
    return {
      success: true,
      ...data
    };
  } catch (error) {
    console.error("Error sending divide attention trial complete to backend:", error);
    return {
      success: false,
      error: error.message
    };
  }
} 

export const DivideAttentionResponseBatch = async (payload) => {
  /*
  {
  "trial_id": "8c62e47b-aec8-4237-83de-994a8dc9bba6",
  "responses": [
    {
      "object_index": 0,
      "object_type": "target",
      "response_time_ms": 1800,
      "tap_x": 0,
      "tap_y": 0,
      "response_type": "correct_hit",
      "is_correct": false,
      "points_awarded": -5,
      "speed_bonus": false
    }
  ]
}
  */
  try {
    const response = await fetch(`${API_BASE_URL}/responses/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Divide attention response batch response:", data);
    return {
      success: true,
      ...data
    };
  } catch (error) {
    console.error("Error sending divide attention response batch to backend:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

export const DivideAttentionSessionComplete = async (session_id, screening_session_id) => {
  /*
  {
  "session_id": "75e8516d-c2f4-4286-b0ae-055c55232c9c"
}
  */
  try {
    const response = await fetch(`${API_BASE_URL}/sessions/${session_id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Divide attention session complete response:", data);
    return {
      success: true,
      ...data
    };
  } catch (error) {
    console.error("Error sending divide attention session complete to backend:", error);
    return {
      success: false,
      error: error.message
    };
  }
} 

export const DivideAttentionSessionStart = async (payload) => {
  /*
  {
    "user_id": "...",
    "session_id": "...",
    "session_type": "string"
  }
  */
  try {
    const response = await fetch(`${API_BASE_URL}/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    console.log("DA session start response:", data);
    return { success: true, ...data };
  } catch (error) {
    console.error("Error starting DA session:", error);
    return { success: false, error: error.message };
  }
};


export const BIAComplete = async (result) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/bia/session/complete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(result),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("BIA complete response:", data);

    return {
      success: true,
      ...data,
    };
  } catch (error) {
    console.error("Error sending BIA complete to backend:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// /**
//  * Send weight and height measurements to backend
//  * @param {Object} data - Measurement data
//  * @param {number} data.weight - Weight in kg
//  * @param {number} data.height - Height in cm
//  * @param {string} data.user_id - User ID
//  * @param {string} data.timestamp - ISO timestamp
//  * @returns {Promise<Object>} Response with success status
//  */
// export async function sendMeasurements(data) {
//   try {
//     const response = await fetch(`${API_BASE_URL}/measurements/store`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify(data),
//     });

//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }

//     const result = await response.json();
//     return {
//       success: true,
//       ...result
//     };
//   } catch (error) {
//     console.error("Error sending measurements to backend:", error);
//     return {
//       success: false,
//       error: error.message
//     };
//   }
// }

/**
 * Calls: GET /sync/cloud-to-local
 */
export const cloudToLocalSync = async () => {
  try {
    const res = await axios.post(`${API_BASE_URL}/sync/cloud-to-local`, {
      timeout: 60000, // sync may take time
      headers: { "Content-Type": "application/json" },
    });
    return res.data;
  } catch (error) {
    console.error("❌ cloudToLocalSync API failed:", error?.message || error);
    throw error;
  }
};