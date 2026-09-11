const BarefootCTAModal = ({ onRemoveShoe, onContinueWithShoes, onClose }) => {
    const [step, setStep] = useState("choose") // "choose" | "barefoot"

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div
                className="relative w-screen"
                style={{ filter: "drop-shadow(0px 0px 40px rgba(139, 195, 229, 0.4))" }}
            >
                {/* ── textbgframe background ── */}
                <img src={textbgframe} alt="" className="w-full h-full block" draggable={false} />

                {/* ── Content ── */}
                <div
                    className="absolute flex flex-col justify-center"
                    style={{
                        top: "18%",
                        bottom: "20%",
                        left: "6%",
                        right: "6%"
                    }}
                >
                    {step === "choose" ? (
                        <>
                            {/* Title */}
                            <div className="flex items-center justify-center mb-10">
                                <h2 className="text-[#8BC3E5] text-[35px]  m-0 font-anta w-2/3 text-center">
                                    Choose how you'd like to continue.
                                </h2>
                            </div>

                            {/* Two-choice buttons */}
                            <div className="w-full flex gap-x-10">
                                <button
                                    onClick={() => setStep("barefoot")}
                                    className="
                    w-[clamp(16rem,33vw,31.25rem)]
                    h-[clamp(4rem,8vh,6.25rem)]
                    flex items-center justify-center
                    text-center
                    rounded-[30px]
                    border-2 border-white/30
                    bg-white/5
                    backdrop-blur-sm
                    shadow-[0px_5px_40px_0px_rgba(154,217,255,0.3)]
                    text-white
                    text-[clamp(1.25rem,3vw,3rem)]
                    tracking-wide
                    active:scale-[0.98]
                    transition-all duration-300 ease-in-out
                    hover:bg-white/10
                    hover:border-white/50
                    px-2
                    font-anta
                  "
                                >
                                    🦶 Without Shoes
                                </button>

                                <button
                                    onClick={onContinueWithShoes}
                                    className="
                    w-[clamp(16rem,33vw,31.25rem)]
                    h-[clamp(4rem,8vh,6.25rem)]
                    flex items-center justify-center
                    text-center
                    rounded-[30px]
                    border-2 border-white/50
                    bg-[radial-gradient(43.11%_181.04%_at_50%_50%,#003FFD_0%,#00B3FF_100%)]
                    shadow-[0px_0px_30px_rgba(0,179,255,0.5),inset_0px_0px_20px_rgba(255,255,255,0.3)]
                    text-white
                    text-[clamp(1.5rem,3vw,3rem)]
                    tracking-wide
                    active:scale-[0.98]
                    transition-all duration-300 ease-in-out
                    hover:border-white
                    font-anta
                  "
                                >
                                    👟 With Shoes
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Instruction screen */}
                            <div className="flex items-center gap-2.5 mb-[6%]">
                                <p className="text-[#8BC3E5] text-3xl font-anta text-center">
                                    Remove your socks and shoes and click on start.
                                </p>
                            </div>

                            {/* Start button */}
                            <button
                                onClick={onRemoveShoe}
                                className="
                  ml-36
                  w-[clamp(16rem,33vw,31.25rem)]
                  h-[clamp(4rem,8vh,6.25rem)]
                  flex items-center justify-center
                  text-center
                  rounded-[30px]
                  border-2 border-white/50
                  bg-[radial-gradient(43.11%_181.04%_at_50%_50%,#003FFD_0%,#00B3FF_100%)]
                  shadow-[0px_0px_30px_rgba(0,179,255,0.5),inset_0px_0px_20px_rgba(255,255,255,0.3)]
                  text-white
                  text-[clamp(1.5rem,3vw,3rem)]
                  tracking-wide
                  active:scale-[0.98]
                  transition-all duration-300 ease-in-out
                  hover:border-white
                "
                                style={{ fontFamily: "'Share Tech Mono', monospace" }}
                            >
                                Start
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
