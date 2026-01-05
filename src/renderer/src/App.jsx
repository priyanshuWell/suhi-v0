import { Route, Routes } from 'react-router'
import SplashScreen from './components/SplashScreen'
import Versions from './components/Versions'
import { StartScreen } from './components/StartScreen'
import VideoCaptureScreen from './components/VideoCaptureScreen'
import VerifiedProfile from './components/VerifiedProfile'
import BIACalcuate from './components/bia/BIACalcuate'
import RegisterCard from './components/RegisterCard'
import DMITScreen from './components/dmit/DMITScreen'
import FaceScan from './components/FaceScan'

function App() {
  return (
    <Routes>
     <Route path='/' element={<SplashScreen/>}/>
     <Route path='/welcome' element={<StartScreen/>}/>
      <Route path='/capture' element={<VideoCaptureScreen/>}/>
      <Route path='/verified' element={<RegisterCard/>}/>
       <Route path='/bia/:screenType' element={<BIACalcuate/>}/>
       <Route path='/screen1' element={<DMITScreen/>}/>
        <Route path='/faceScan' element={<FaceScan/>}/>
    </Routes>
    )
}

export default App
