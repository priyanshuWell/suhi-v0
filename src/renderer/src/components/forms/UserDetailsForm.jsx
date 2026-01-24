import React from "react";
import bg1 from "../../assets/lightbg.png";
import bg2 from "../../assets/dmt-bg.svg";
import BlackButton from "../ui/BackButton"
const UserDetailsForm = () => {
    return (
        <div className="fixed inset-0 w-screen min-h-screen overflow-hidden bg-black font-['Share_Tech_Mono']">
            {/* background */}
            <div
                className="absolute inset-0 bg-no-repeat bg-cover bg-center z-0"
                style={{ backgroundImage: `url(${bg1})` }}
            />
            <BlackButton/>

            {/* top text */}
            <div className="absolute top-[20px] left-1/2 -translate-x-1/2 z-30 w-[600px]">
                <p className="text-5xl text-center font-light leading-snug text-white ">
                    Enter the user details
                </p>
            </div>

            {/* frame section with form inside */}
            <div className="absolute bottom-[9rem] left-1/2 -translate-x-1/2 z-20">
                <div className="relative w-[800px]">
                    {/* frame image */}
                    <img src={bg2} alt="dmit frame" className="w-full max-w-none h-auto" />
                    
                    {/* form positioned inside frame */}
                    <div className="absolute top-[30rem] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px]">
                        <div className="flex flex-col items-start gap-2 text-left text-[28px] text-[rgba(255,255,255,0.8)]">

                            {/* Name */}
                            <div className="w-full flex flex-col gap-[12px] cursor-pointer">
                                <div className="tracking-[0.44px] leading-[28px]">
                                    Name <span className="text-[rgba(255,0,0,0.8)] font-['Noto_Sans']">*</span>
                                </div>
                                <div className="min-h-[50px] text-3xl text-[rgba(255,255,255,0.5)] flex items-center">
                                    Enter name
                                </div>
                                <div className="border-t-2 border-white w-full" />
                            </div>

                            {/* Age */}
                            <div className="w-full flex flex-col gap-[12px]">
                                <div className="tracking-[0.44px] leading-[28px]">
                                    Age <span className="text-[rgba(255,0,0,0.8)]">*</span>
                                </div>
                                <div className="min-h-[50px] text-3xl text-[rgba(255,255,255,0.5)] flex items-center">
                                    Enter age
                                </div>
                                <div className="border-t-2 border-white w-full" />
                            </div>

                            {/* Gender */}
                            <div className="w-full flex flex-col gap-[12px]">
                                <div className="tracking-[0.44px] leading-[28px]">
                                    Gender <span className="text-[rgba(255,0,0,0.8)]">*</span>
                                </div>

                                <div className="flex items-center gap-[24px] font-mono text-white text23xl">
                                    {["Male", "Female"].map((label) => (
                                        <div key={label} className="flex flex-row items-center gap-[10px]">
                                            <div className="w-[20px] h-[20px] rounded-full border-2 border-white" />
                                            <span className=" tracking-[0.26px]">{label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Mobile */}
                            <div className="w-full flex flex-col gap-[12px]">
                                <div className="tracking-[0.44px] leading-[28px]">
                                    Mobile number <span className="text-[rgba(255,0,0,0.8)]">*</span>
                                </div>
                                <div className="min-h-[50px] text-3xl text-white flex items-center gap-3">
                                    <span>+91</span>
                                    <span className="opacity-50">Enter number</span>
                                </div>
                                <div className="border-t-2 border-white w-full" />
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserDetailsForm;
