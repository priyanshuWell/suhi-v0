import { motion } from 'framer-motion';
import BlueGradientButton from '../../ui/BlueGradientButton';
import textbgframe from '../../../assets/textbgframe.svg';

/* ------------------------------------------------------------------ */
/*  "Task completed" modal — smooth top-down entrance animation        */
/* ------------------------------------------------------------------ */
export default function CompletedModal({ results, onNext }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.60, ease: "backOut" }}
    >
      <motion.div
        className="relative w-screen"
        initial={{ y: -180, opacity: 0, scale: 0.94 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -120, opacity: 0, scale: 0.94 }}
        transition={{
          type: "spring",
          stiffness: 280,
          damping: 25,
          mass: 0.85
        }}
        style={{
          filter: "drop-shadow(0px 0px 45px rgba(139, 195, 229, 0.45))",
          willChange: "transform, opacity"
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
          <BlueGradientButton onClick={onNext}>
            Next
          </BlueGradientButton>
        </div>
      </motion.div>
    </motion.div>
  );
}
