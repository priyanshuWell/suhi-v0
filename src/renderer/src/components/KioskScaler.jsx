// KioskScaler.jsx
import { useEffect, useState } from "react";

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;

export default function KioskScaler({ children }) {
    const [scale, setScale] = useState(1);

    const updateScale = () => {
        const scaleX = window.innerWidth / BASE_WIDTH;
        const scaleY = window.innerHeight / BASE_HEIGHT;
        setScale(Math.min(scaleX, scaleY));
    };

    useEffect(() => {
        updateScale();
        window.addEventListener("resize", updateScale);
        return () => window.removeEventListener("resize", updateScale);
    }, []);

    return (
        <div
            style={{
                width: BASE_WIDTH,
                height: BASE_HEIGHT,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                overflow: "hidden",
            }}
        >
            {children}
        </div>
    );
}