import { Route, Routes } from 'react-router'
import SplashScreen from './components/SplashScreen'
import Versions from './components/Versions'
import { StartScreen } from './components/StartScreen'
import VideoCaptureScreen from './components/VideoCaptureScreen'
import BIACalcuate from './components/bia/BIACalcuate'
import RegisterCard from './components/RegisterCard'
// import DMITScreen from './components/dmit/DMITScreen'
// import FaceScan from './components/FaceScan'
import ErrorAlert from './components/ErrorAlert'
import BIAResult from './components/bia/BIAResult'
import Progressbar from './components/ProgessBar'
import VoiceCapture from './components/voice/VoiceAnalysis'
import { useEffect } from 'react'
import { cloudToLocalSync } from './utils/api'
import VoiceAnalysis from './components/voice/VoiceAnalysis'
import NewDmit from './components/dmit/NewDmit'
import DMITScreen from './components/dmit/DMITScreen'
import UserDetailsForm from './components/forms/UserDetailsForm'
import FaceCapture from './components/forms/FaceCapture'
import ConfirmationScreen from './components/forms/ConfirmationScreen'
import LoginSuhi from './components/forms/LoginSuhi'
import LoginDOB from './components/forms/LoginDOB'
import LoginFather from './components/forms/LoginFather'
import FingerPrintScreen from './components/forms/FingerPrintScreen'
import ColorBlindPlate from './components/color-blindness/ColorBlindPlate'
import ColorBlindQuiz from './components/color-blindness/ColorBlindQuiz'
import SpaceConvoyMain from './components/games/space-convoy/SpaceConvoyMain'
import DivideAttentionGame from './components/games/space-convoy/DivideAttentionGame'
import SpaceConveyDemo from './components/games/space-convoy/SpaceConveyDemo'
import { StartCountDown } from './components/games/space-convoy/StartCountDown'
import { SpaceConvoyComplete } from './components/games/space-convoy/SpaceConveyComplete'

function App() {
  // useEffect(() => {
  //   const doSync = async () => {
  //     try {
  //       console.log('🔄 Starting cloud-to-local sync...')
  //       const data = await cloudToLocalSync()
  //       console.log('✅ Sync success:', data)
  //     } catch (err) {
  //       console.error('❌ Sync failed:', err?.message || err)
  //     }
  //   }

  //   doSync()
  // }, [])

  return (
    <Routes>

      <Route path="/facecapture" element={<FaceCapture />} />
      <Route path="/confirmation" element={<ConfirmationScreen />} />
      <Route path="/login-suhi" element={<LoginSuhi />} />
      <Route path="/login-father" element={<LoginFather />} />
      <Route path='/verified' element={<RegisterCard />} />
      <Route path='/' element={<SplashScreen />} />
      <Route path='/welcome' element={<StartScreen />} />
      <Route path='/capture' element={<VideoCaptureScreen />} />
      <Route path='/bia/:screenType' element={<BIACalcuate />} />
      <Route path='/screen1' element={<NewDmit />} />
      <Route path='/bia/result' element={<BIAResult />} />
      <Route path='/voice' element={<VoiceAnalysis />} />
      <Route path="/fingerprint" element={<FingerPrintScreen />} />
      <Route path="/colorblindness" element={<ColorBlindPlate />} />
      <Route path="/colorblindness/quiz" element={<ColorBlindQuiz />} />
      <Route path="/space-convoy-main" element={<SpaceConvoyMain />} />
      <Route path='/divide-attention' element={<DivideAttentionGame />} />
      <Route path='/space-convoy-complete' element={<SpaceConvoyComplete />} />

    </Routes>
  )
}

export default App
