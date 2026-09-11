import { Route, Routes } from "react-router"
import BIACalcuate from "./components/bia/BIACalcuate"
import BiaReportRouter from "./components/bia/BiaReportRouter"
import BufferCollectionManager from "./components/BufferCollectionManager"
import ColorBlindPlate from "./components/color-blindness/ColorBlindPlate"
import ColorBlindQuiz from "./components/color-blindness/ColorBlindQuiz"
import ConfirmationScreen from "./components/forms/ConfirmationScreen"
import FaceCapture from "./components/forms/FaceCapture"
import FingerPrintScreen from "./components/forms/FingerPrintScreen"
import LoginFather from "./components/forms/LoginFather"
import LoginSuhi from "./components/forms/LoginSuhi"
import PerilousPath from "./components/games/perlious-path/PerilousPath"
import SmoothieSlashGame from "./components/games/smoothie-slash/SmoothieSlashGame"
import DivideAttentionGame from "./components/games/space-convoy/DivideAttentionGame"
import IdentifyStudent from "./components/IdentifiedStudent"
import RegisterCard from "./components/RegisterCard"
import ScreeningLayout from "./components/ScreeningLayout"
import { StartScreen } from "./components/StartScreen"
import NoActivityFrame from "./components/ui/NoActivityFrame"
import VideoCaptureScreen from "./components/VideoCaptureScreen"
import VoiceAnalysis from "./components/voice/VoiceAnalysis"
import { useBackgroundAudio } from "./hooks/useBackgroundAudio"
import AdaptiveEyeVisionC from "./components/games/adaptive-eye-vision-c/AdaptiveEyeVisionC"
import BeatDropGame from "./components/games/beat-drop/BeatDropGame"
import SplashScreen from "./components/SplashScreen"
function App() {
    // Play looping background music on all routes except voice & game sections
    useBackgroundAudio()
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
    /*
  bia -> bia/wh -> bia/imcomplete
  voice -> /voice
  colorblindness -> /colorblindness -> /colorblindness/quiz
  space-convoy -> /space-convoy-main - /space-convoy-demo  ->  /divide-attention -> /space-convoy-complete
  */
    return (
        <>
            <BufferCollectionManager />
            {/* <AutoIdleRedirect
        timeoutMs={10000}
        promptBeforeMs={5000}
        redirectTo="/welcome"
      /> */}

            <Routes>
                {/* Routes WITHOUT the progress bar */}
                <Route path="/" element={<StartScreen />} />
                <Route path="/smoothie-slash" element={<SmoothieSlashGame />} />
                <Route path="/welcome" element={<StartScreen />} />
                <Route path="/capture" element={<VideoCaptureScreen />} />
                <Route path="/login-suhi" element={<LoginSuhi />} />
                <Route path="/divide-attention" element={<DivideAttentionGame />} />
                <Route path="/colorblindness/quiz" element={<ColorBlindQuiz />} />
                <Route path="/bia/result" element={<BiaReportRouter />} />
                {/* All screening routes — get the top progress bar automatically */}
                <Route element={<ScreeningLayout />}>
                    <Route path="/faceCapture" element={<FaceCapture />} />
                    <Route path="/confirmation" element={<ConfirmationScreen />} />
                    <Route path="/login-father" element={<LoginFather />} />
                    <Route path="/verified" element={<RegisterCard />} />
                    <Route path="/bia/:screenType" element={<BIACalcuate />} />
                    <Route path="/voice" element={<VoiceAnalysis />} />
                    <Route path="/fingerprint" element={<FingerPrintScreen />} />
                    <Route path="/colorblindness" element={<ColorBlindPlate />} />
                    <Route path="/perilous-path" element={<PerilousPath />} />
                    <Route path="/adaptive-eye" element={<AdaptiveEyeVisionC />} />
                    <Route path="/beat-drop" element={<BeatDropGame />} />

                    <Route path="/identify-student" element={<IdentifyStudent />} />
                    <Route path="/play" element={<NoActivityFrame />} />
                </Route>
            </Routes>
        </>
    )
}

export default App
