import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000";

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


export const BIAComplete = async (result)=>{
  try {
    const response = await fetch(`${API_BASE_URL}/bia/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("BIA complete response:", data);
    return {
      success: true,
      ...data
    };
  } catch (error) {
    console.error("Error sending BIA complete to backend:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

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