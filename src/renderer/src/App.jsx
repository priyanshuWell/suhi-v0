import { Route, Routes } from 'react-router'
import SplashScreen from './components/SplashScreen'
import Versions from './components/Versions'
import { StartScreen } from './components/StartScreen'
import VideoCaptureScreen from './components/VideoCaptureScreen'
import BIACalcuate from './components/bia/BIACalcuate'
import RegisterCard from './components/RegisterCard'
import DMITScreen from './components/dmit/DMITScreen'
// import FaceScan from './components/FaceScan'
import ErrorAlert from './components/ErrorAlert'
import BIAResult from './components/bia/BIAResult'
import Progressbar from './components/ProgessBar'
import VoiceCapture from './components/voice/VoiceAnalysis'
import { useEffect } from 'react'
import { cloudToLocalSync } from './utils/api'
import VoiceAnalysis from './components/voice/VoiceAnalysis'

function App() {

  useEffect(() => {
    const doSync = async () => {
      try {
        console.log("🔄 Starting cloud-to-local sync...");
        const data = await cloudToLocalSync();
        console.log("✅ Sync success:", data);
      } catch (err) {
        console.error("❌ Sync failed:", err?.message || err);
      }
    };

    doSync();
  }, []);

  

  return (

    <Routes>
      <Route path='/' element={<SplashScreen />} />
       <Route path='/' element={<SplashScreen />} />
      <Route path='/welcome' element={<StartScreen />} />
      <Route path='/capture' element={<VideoCaptureScreen />} />
      <Route path='/verified' element={<RegisterCard />} />
      <Route path='/bia/:screenType' element={<BIACalcuate />} />
      <Route path='/screen1' element={<DMITScreen />} />
      <Route path='/bia/result' element={<BIAResult />} />
      <Route path='/voice' element={<VoiceAnalysis />} />

    </Routes>
  )
}

export default App





















// /**
//  * App.jsx for Kiosk Project with Background Video Recording
//  * 
//  * This version is specifically for the kiosk electron project.
//  * Copy this file to replace your existing App.jsx
//  */

// import { Route, Routes } from 'react-router'
// import SplashScreen from './components/SplashScreen'
// import Versions from './components/Versions'
// import { StartScreen } from './components/StartScreen'
// import VideoCaptureScreen from './components/VideoCaptureScreen'
// import BIACalcuate from './components/bia/BIACalcuate'
// import RegisterCard from './components/RegisterCard'
// import DMITScreen from './components/dmit/DMITScreen'
// import ErrorAlert from './components/ErrorAlert'
// import BIAResult from './components/bia/BIAResult'
// import Progressbar from './components/ProgessBar'
// import VoiceCapture from './components/voice/VoiceAnalysis'
// import BackgroundVideoProvider from './services/Backgroundvideoprovider'

// // Import the Background Video Provider
// // Place BackgroundVideoProvider.jsx and BackgroundVideoService.js in ./services/ folder
// // import { BackgroundVideoProvider } from './services/BackgroundVideoProvider'

// /**
//  * App Component with Background Video Recording
//  * 
//  * The BackgroundVideoProvider wraps all routes and automatically:
//  * 1. Pre-warms the camera for instant access (camera opens immediately)
//  * 2. Starts recording on monitored routes (/voice, /screen1, /progress)
//  * 3. Records 30-second video chunks continuously
//  * 4. Sends videos to API with route name (non-blocking)
//  * 5. Immediately starts next recording without waiting for API response
//  */
// function App() {
//   // ══════════════════════════════════════════════════════════════════
//   // CONFIGURATION - Update these values for your project
//   // ══════════════════════════════════════════════════════════════════
//   const videoConfig = {
//     // Your API endpoint for receiving video uploads
//     // The API will receive: video file, route, route_name, timestamp, duration
//     apiEndpoint: 'https://your-api-endpoint.com/api/video-upload',
    
//     // Routes where background recording should be active
//     // Recording automatically starts when user navigates to these routes
//     // Recording automatically stops when user leaves these routes
//     monitoredRoutes: ['/voice', '/screen1', '/progress', '/bia/result', '/welcome'],
    
//     // Pre-warm camera on app start for instant access
//     // This ensures camera opens immediately when needed (no delay)
//     prewarmCamera: true,
    
//     // Recording duration in seconds (each chunk)
//     // After 30 seconds, video is sent to API and new recording starts
//     recordingDuration: 30,
    
//     // Enable/disable the feature globally
//     enabled: true
//   }

//   return (
//     <BackgroundVideoProvider
//       apiEndpoint={videoConfig.apiEndpoint}
//       monitoredRoutes={videoConfig.monitoredRoutes}
//       prewarmCamera={videoConfig.prewarmCamera}
//       recordingDuration={videoConfig.recordingDuration}
//       enabled={videoConfig.enabled}
//     >
//       <Routes>
//         {/* Non-monitored routes - no background recording */}
//         <Route path='/' element={<SplashScreen />} />
//         <Route path='/welcome' element={<StartScreen />} />
//         <Route path='/capture' element={<VideoCaptureScreen />} />
//         <Route path='/verified' element={<RegisterCard />} />
//         <Route path='/bia/:screenType' element={<BIACalcuate />} />
        
//         {/* Monitored routes - background recording is active */}
//         <Route path='/screen1' element={<DMITScreen />} />
//         <Route path='/bia/result' element={<BIAResult />} />
//         <Route path='/voice' element={<VoiceCapture />} />
//         <Route path='/progress' element={<Progressbar />} />
//       </Routes>
//     </BackgroundVideoProvider>
//   )
// }

// export default App