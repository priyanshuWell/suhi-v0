import { Route, Routes } from 'react-router'
import BufferCollectionManager from './components/BufferCollectionManager'
import { useBackgroundAudio } from './hooks/useBackgroundAudio'
import SplashScreen from './components/SplashScreen'
import { StartScreen } from './components/StartScreen'
import VideoCaptureScreen from './components/VideoCaptureScreen'
import BIACalcuate from './components/bia/BIACalcuate'
import RegisterCard from './components/RegisterCard'
import VoiceAnalysis from './components/voice/VoiceAnalysis'
import FaceCapture from './components/forms/FaceCapture'
import ConfirmationScreen from './components/forms/ConfirmationScreen'
import LoginSuhi from './components/forms/LoginSuhi'
import LoginFather from './components/forms/LoginFather'
import FingerPrintScreen from './components/forms/FingerPrintScreen'
import ColorBlindPlate from './components/color-blindness/ColorBlindPlate'
import ColorBlindQuiz from './components/color-blindness/ColorBlindQuiz'
import ScreeningLayout from './components/ScreeningLayout'
import BiaReportRouter from './components/bia/BiaReportRouter'
import SmoothieSlashGame from './components/games/smoothie-slash/SmoothieSlashGame'
import IdentifyStudent from './components/IdentifiedStudent'

function App() {
  // Play looping background music on all routes except voice & game sections
  useBackgroundAudio()
  return (
    <>
      <BufferCollectionManager />
      <Routes>

        {/* Routes WITHOUT the progress bar */}
        <Route path="/" element={<SplashScreen />} />
        <Route path="/smoothie-slash" element={<SmoothieSlashGame />} />
        <Route path='/welcome' element={<StartScreen />} />
        <Route path='/capture' element={<VideoCaptureScreen />} />
        <Route path="/login-suhi" element={<LoginSuhi />} />
        <Route path="/colorblindness/quiz" element={<ColorBlindQuiz />} />
        <Route path='/bia/result' element={<BiaReportRouter />} />
        {/* All screening routes — get the top progress bar automatically */}
        <Route element={<ScreeningLayout />}>
          <Route path="/faceCapture" element={<FaceCapture />} />
          <Route path="/confirmation" element={<ConfirmationScreen />} />
          <Route path="/login-father" element={<LoginFather />} />
          <Route path='/verified' element={<RegisterCard />} />
          <Route path='/bia/:screenType' element={<BIACalcuate />} />
          <Route path='/voice' element={<VoiceAnalysis />} />
          <Route path="/fingerprint" element={<FingerPrintScreen />} />
          <Route path="/colorblindness" element={<ColorBlindPlate />} />
          <Route path='/identify-student' element={<IdentifyStudent />} />

        </Route>

      </Routes>
    </>
  )
}

export default App
