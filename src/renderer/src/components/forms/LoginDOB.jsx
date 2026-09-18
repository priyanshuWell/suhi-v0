import React, { useState } from "react"
import { useNavigate } from "react-router"
import { useDispatch } from "react-redux"
import { useTranslation } from "react-i18next"
import { setUser, setScreening } from "../../features/common/commonSlice"
import LoginComponent from "../ui/LoginComponent"
import BlueGradientButton from "../ui/BlueGradientButton"
import { API_BASE_URL } from "../../utils/config"
import axios from "axios"

const LoginDOB = () => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const [suhiId, setSuhiId] = useState("")
    const [dob, setDob] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const isButtonDisabled = !suhiId.trim() || !dob.trim() || loading

    //  Submit: verify SUHI Id + DOB against backend
    const handleSubmit = async () => {
        if (isButtonDisabled) return
        setError("")
        setLoading(true)
        try {
            const res = await axios.post(`${API_BASE_URL}/auth/login-dob`, {
                suhi_id: suhiId.trim(),
                dob: dob.trim()
            })
            if (res?.data?.success) {
                dispatch(setUser(res.data.user))
                dispatch(setScreening(res.data.screening))
                navigate("/register")
            } else {
                setError(res?.data?.message || "Invalid SUHI Id or Date of Birth")
            }
        } catch (err) {
            setError("Login failed. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    // Format date input as DD/MM/YY
    const handleDobChange = (e) => {
        let value = e.target.value.replace(/\D/g, "") // Remove non-digits
        if (value.length > 6) value = value.slice(0, 6)

        // Auto-format with slashes
        if (value.length >= 4) {
            value = value.slice(0, 2) + "/" + value.slice(2, 4) + "/" + value.slice(4)
        } else if (value.length >= 2) {
            value = value.slice(0, 2) + "/" + value.slice(2)
        }
        setDob(value)
    }

    return (
        <>
            <div className="fixed top-1/16 left-1/2 -translate-x-1/2 z-30 w-[820px]">
                <p className="text-5xl text-center font-light leading-snug text-white ">
                    {t("forms.login_dob.title", "Log in via your name and date of birth")}
                </p>
            </div>
            <LoginComponent />

            {/* form */}

            <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px]">
                <div className="w-full flex flex-col gap-10 cursor-pointer ">
                    <div className="suhi-id">
                        <div className=" leading-[28px] relative text-white text-xl tracking-wide">
                            {t("forms.login_dob.suhi_id", "Suhi ID")}{" "}
                            <span className="text-[#ff0000cc] font-['Noto_Sans'] absolute">*</span>
                        </div>
                        <div className="min-h-[50px] text-3xl flex items-center">
                            <input
                                type="text"
                                value={suhiId}
                                onChange={(e) => setSuhiId(e.target.value)}
                                placeholder={t("forms.login_dob.enter_suhi_id", "Enter Your Suhi ID")}
                                className="w-full bg-transparent border-none outline-none text-white placeholder:text-[rgba(255,255,255,0.5)]"
                            />
                        </div>
                        <div className="border-t-2 border-white w-full mt-2" />
                    </div>
                    <div className="dob">
                        <div className=" leading-[28px] relative text-white text-xl tracking-wide">
                            {t("forms.login_dob.dob", "Date Of Birth")}{" "}
                            <span className="text-[#ff0000cc] font-['Noto_Sans'] absolute">*</span>
                        </div>
                        <div className="min-h-[50px] text-3xl flex items-center">
                            <input
                                type="text"
                                value={dob}
                                onChange={handleDobChange}
                                placeholder={t("forms.login_dob.dob_placeholder", "DD/MM/YY")}
                                className="w-full bg-transparent border-none outline-none text-white placeholder:text-[rgba(255,255,255,0.5)]"
                            />
                        </div>
                        <div className="border-t-2 border-white w-full mt-2" />
                    </div>
                </div>
            </div>

            <div className="fixed left-1/2 bottom-[40%] -translate-x-1/2">
                {error && <p className="text-red-400 text-center text-xl mb-4">{error}</p>}
                <BlueGradientButton
                    width={"w-[clamp(16rem,33vw,31.25rem)]"}
                    padX={"px-3"}
                    disabled={isButtonDisabled}
                    onClick={handleSubmit} //  wired up
                >
                    {loading ? t("forms.login_dob.verifying", "Verifying...") : t("forms.login_dob.next", "Next")}
                </BlueGradientButton>
            </div>
        </>
    )
}

export default LoginDOB
