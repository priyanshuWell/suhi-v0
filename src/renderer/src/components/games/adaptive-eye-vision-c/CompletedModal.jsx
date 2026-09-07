import BlueGradientButton from '../../ui/BlueGradientButton';
import textbgframe from '../../../assets/textbgframe.svg';

/* ------------------------------------------------------------------ */
/*  "Task completed" modal — now shows each eye's scored acuity          */
/*  (last size level correctly identified -> Snellen/logMAR, or the     */
/*  "below 6/60" referral case) per the spec's scoring section.         */
/* ------------------------------------------------------------------ */
export default function CompletedModal({ results, onNext }) {
  const flagged = results.right?.referral || results.left?.referral;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div
            className="relative w-screen"
            style={{
                filter: "drop-shadow(0px 0px 40px rgba(139, 195, 229, 0.4))"
            }}
        >
            {/* Background frame */}
            <img
                src={textbgframe}
                alt=""
                className="w-full h-full block"
                draggable={false}
            />

            {/* Content */}
            <div
                className="absolute flex flex-col items-center justify-center"
                style={{
                    top: "14%",
                    bottom: "20%",
                    left: "14%",
                    right: "14%"
                }}
            >

                {/* Title */}
                <h2 className="text-[#8BC3E5] text-[42px] font-anta text-center mb-4">
                  Task Completed
                </h2>

                {/* Subtitle */}
                <p className="text-white text-[28px] font-anta text-center mb-12">
                    Responses saved.
                </p>

                {/* Next button */}
                <BlueGradientButton
                    onClick={onNext}
                    // style={{
                    //     opacity: loading ? 0.6 : 1,
                    //     pointerEvents: loading ? "none" : "auto",
                    //     cursor: loading ? "not-allowed" : "pointer"
                    // }}
                >
                    {/* {loading ? (
                        <Loader className="w-6 h-6 animate-spin" />
                    ) : (
                        t("common.next")
                    )}*/}
            Next
                </BlueGradientButton>
            </div>
        </div>
    </div>
  );
}
