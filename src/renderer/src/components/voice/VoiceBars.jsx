import { motion } from "framer-motion";

export default function VoiceBars() {
  const BAR_WIDTH = 12.1111;
  const BAR_RADIUS = 6.05556;
  const CENTER_Y = 100;

  const IDLE_HEIGHT = 20;
  const MAX_HEIGHT =90;

  const barPositions = [
    { x: 0, scale: 0.3 },
    { x: 30.2773, scale: 0.9 },
    { x: 60.5547, scale: 0.25 },
    { x: 90.832, scale: 1.1 },
    { x: 121.109, scale: 0.6 },
    { x: 151.391, scale: 0.4 },
    { x: 181.668, scale: 0.7 },
    { x: 211.945, scale: 0.25 },
    { x: 242.223, scale: 0.9 }
  ];

  return (
    <div className="flex items-center justify-center gap-2">
      <svg
        width="400"
        height="200"
        viewBox="0 0 255 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
      >
        {barPositions.map((bar, index) => {
          const maxBarHeight = IDLE_HEIGHT + MAX_HEIGHT * bar.scale;

          return (
            <motion.rect
              key={index}
              x={bar.x}
              width={BAR_WIDTH}
              rx={BAR_RADIUS}
              fill="white"
              initial={{
                height: IDLE_HEIGHT,
                y: CENTER_Y - IDLE_HEIGHT / 2
              }}
              animate={{
                height: [IDLE_HEIGHT, maxBarHeight, IDLE_HEIGHT],
                y: [
                  CENTER_Y - IDLE_HEIGHT / 2,
                  CENTER_Y - maxBarHeight / 2,
                  CENTER_Y - IDLE_HEIGHT / 2
                ]
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: index * 0.08
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}