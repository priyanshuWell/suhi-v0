import { Route, Routes } from 'react-router'
import SplashScreen from './components/SplashScreen'
import Versions from './components/Versions'
import { StartScreen } from './components/StartScreen'
import VideoCaptureScreen from './components/VideoCaptureScreen'
import VerifiedProfile from './components/VerifiedProfile'
import BIACalcuate from './components/bia/BIACalcuate'

function App() {
  return (
    <Routes>
     <Route path='/' element={<SplashScreen/>}/>
     <Route path='/welcome' element={<StartScreen/>}/>
      <Route path='/capture' element={<VideoCaptureScreen/>}/>
      <Route path='/verified' element={<VerifiedProfile/>}/>
       <Route path='/bia/:screenType' element={<BIACalcuate/>}/>
    </Routes>
    )
}

export default App
