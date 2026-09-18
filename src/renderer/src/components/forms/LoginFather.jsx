import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import LoginComponent from "../ui/LoginComponent"
import GradientButton from "../ui/BlackGradientButton"
import BlueGradientButton from "../ui/BlueGradientButton"

const LoginFather = () => {
    const { t } = useTranslation()
    const [fatherName, setFatherName] = useState("")
    const [mobileNumber, setMobileNumber] = useState("")

    const isButtonDisabled = !fatherName.trim() || !mobileNumber.trim()

    return (
        <>
            <div className="fixed top-1/16 left-1/2 -translate-x-1/2 z-30 w-[750px]">
                <p className="text-5xl text-center font-light leading-snug text-white ">
                    {t("forms.login_father.title", "Log in via Father's name and phone number")}
                </p>
            </div>
            <LoginComponent />

            {/* form */}

            <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px]">
                <div className="w-full flex flex-col gap-10 cursor-pointer ">
                    <div className="suhi-id">
                        <div className=" leading-[28px] relative text-white text-xl tracking-wide">
                            {t("forms.login_father.father_name", "Father's name")}{" "}
                            <span className="text-[#ff0000cc] font-['Noto_Sans'] absolute">*</span>
                        </div>
                        <div className="min-h-[50px] text-3xl flex items-center">
                            <input
                                type="text"
                                value={fatherName}
                                onChange={(e) => setFatherName(e.target.value)}
                                placeholder={t("forms.login_father.enter_father_name", "Enter Your Father's name")}
                                className="w-full bg-transparent border-none outline-none text-white placeholder:text-[rgba(255,255,255,0.5)]"
                            />
                        </div>
                        <div className="border-t-2 border-white w-full mt-2" />
                    </div>
                    {/* Mobile */}
                    <div className="w-full flex flex-col gap-3.5 ">
                        <div className=" leading-[28px] relative text-white text-[20px]">
                            {t("forms.login_father.registered_mobile", "Registered Mobile number")}{" "}
                            <span className="text-[rgba(255,0,0,0.8)] absolute">*</span>
                        </div>
                        <div className="min-h-[50px] text-3xl text-white flex items-center gap-3">
                            <span className="text-4xl">+91</span>
                            <input
                                type="tel"
                                value={mobileNumber}
                                onChange={(e) =>
                                    setMobileNumber(e.target.value.replace(/\D/g, "").slice(0, 10))
                                }
                                placeholder={t("forms.login_father.enter_number", "Enter number")}
                                className="w-full bg-transparent border-none outline-none text-white placeholder:text-[rgba(255,255,255,0.5)]"
                            />
                        </div>
                        <div className="border-t-2 border-white w-full" />
                    </div>
                </div>
            </div>

            <div className="fixed left-1/2 bottom-[40%] -translate-x-1/2">
                <BlueGradientButton
                    width={"w-[clamp(16rem,33vw,31.25rem)]"}
                    padX={"px-3"}
                    disabled={isButtonDisabled}
                >
                    {t("forms.login_father.next", "Next")}
                </BlueGradientButton>
            </div>
        </>
    )
}

export default LoginFather
