import { Route, Routes } from 'react-router'
import SplashScreen from './components/SplashScreen'
import Versions from './components/Versions'
import { StartScreen } from './components/StartScreen'
import VideoCaptureScreen from './components/VideoCaptureScreen'
import BIACalcuate from './components/bia/BIACalcuate'
import RegisterCard from './components/RegisterCard'
import DMITScreen from './components/dmit/DMITScreen'
import BIAResult from './components/bia/BIAResult'
import VoiceAnalysis from './components/voice/VoiceAnalysis'

function App() {
  return (
    <Routes>
      <Route path='/' element={<SplashScreen />} />
      {/* <Route path='/' element={<VoiceAnalysis />} /> */}
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
