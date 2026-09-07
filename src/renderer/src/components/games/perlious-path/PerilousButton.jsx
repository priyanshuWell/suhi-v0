import panelFrame from "../../../assets/perilous_path/perilous_start_game_frame.png"

const PerilousButton = ({
    title,
    onClick,
    className = "",
    disabled = false,
    titleColor,
}) => {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`transition-transform active:scale-[0.97] disabled:cursor-not-allowed ${className}`}
        >
            <div className="relative">
                <img
                    src={panelFrame}
                    alt=""
                    className="w-full"
                    draggable={false}
                />

                <div className="absolute inset-0 flex items-center justify-center">
                    <span
                        className="font-anton text-2xl pt-4"
                        style={{ color: titleColor }}
                    >
                        {title}
                    </span>
                </div>
            </div>
        </button>
    );
};

export default PerilousButton;
