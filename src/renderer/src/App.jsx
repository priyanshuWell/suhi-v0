import HeightWeightCalculate from "./components/bia/HeightWeightCalculate"
import { StartScreen } from "./components/StartScreen"
import SplashScreen from "./components/SplashScreen"
import { useNavigate } from "react-router"

function App() {
    const navigate = useNavigate()

    return (
        <Routes>
            {/* Optional splash screen */}
            <Route path="/" element={<SplashScreen />} />
            <Route path="/welcome" element={<StartScreen />} />

            {/* Height and Weight Route */}
            <Route
                path="/height-weight"
                element={
                    <HeightWeightCalculate
                        onComplete={() => navigate("/welcome")}
                    />
                }
            />

            {/* Fallback to welcome */}
            <Route path="*" element={<StartScreen />} />
        </Routes>
    )
}
