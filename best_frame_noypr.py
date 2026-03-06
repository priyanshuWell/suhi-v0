"""
best_frame_noypr.py - Best Face Frame Capture WITHOUT Pose Estimation

Captures best frame based on gaze, eye openness, and clarity.
No yaw/pitch/roll required.

FIXES applied in this version:
1. REMOVED _init_face_detection() / _check_and_recover_face_detection() /
   check_multiple_faces() — these created a rogue FaceDetection MediaPipe
   graph that was shared across concurrent requests, causing:
     - Packet timestamp mismatch errors
     - Packet type mismatch errors
     - Process crash (exit code 139 / segfault)
   The FrameContext (frame_context.py) already runs FaceDetection once per
   frame via the per-request MediaPipeInstances. Modules must read
   ctx.multiple_faces and ctx.face_count — never call MediaPipe directly.

2. REMOVED initialization_delay — a 1-second wait that consumed all frames
   from short browser-recorded WebM videos (which often contain only 1 frame
   at the cv2.VideoCapture level due to the 1000fps timebase bug).

3. Frame rotation is handled upstream by VideoReader before frames arrive here.
"""
import cv2
import base64
import numpy as np
from typing import Tuple, Dict, Any, List
from collections import deque

from fpt.modules.gaze_detector import GazeDetector
from fpt.modules.gaze_centre_detector import GazeCenterDetector
from fpt.modules.face_crop import FaceCropper
from fpt.modules import config


class BestFrameCaptureNoPose:
    """
    Best frame capture WITHOUT pose estimation (no yaw/pitch/roll).
    Uses: gaze centering, eye openness, clarity, expression checks.

    Relies entirely on FrameContext for face detection and landmark data.
    Does NOT create or own any MediaPipe graph instances.
    """

    def __init__(self):
        self.gaze = GazeDetector()
        self.gaze_center = GazeCenterDetector(config.GAZE_CENTER_THRESHOLD)
        self.cropper = FaceCropper()

        # Best frame tracking
        self.best_frame_saved = False
        self.best_quality_score = 0.0
        self.best_crop = None
        self.best_full_frame = None
        self.best_frame_data = None

        self.capture_history = deque(maxlen=30)

    def reset(self):
        """Reset capture state between sessions"""
        self.best_frame_saved = False
        self.best_quality_score = 0.0
        self.best_crop = None
        self.best_full_frame = None
        self.best_frame_data = None
        self.capture_history.clear()
        self.gaze.reset()
        self.gaze_center.reset()

    def check_face_clarity(self, face_crop: np.ndarray) -> Tuple[bool, float, Dict[str, float]]:
        """
        Check if face crop is sharp using three complementary metrics.

        Returns:
            (is_clear, overall_score_0_to_100, metrics_dict)
        """
        if face_crop is None or face_crop.size == 0:
            return False, 0.0, {}

        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)

        # Method 1: Laplacian variance (edge sharpness)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()

        # Method 2: Gradient magnitude (overall sharpness)
        sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        gradient_mag = np.sqrt(sobelx ** 2 + sobely ** 2).mean()

        # Method 3: High-frequency energy (fine detail)
        f_shift = np.fft.fftshift(np.fft.fft2(gray))
        magnitude_spectrum = np.abs(f_shift)
        rows, cols = gray.shape
        crow, ccol = rows // 2, cols // 2
        mask = np.ones((rows, cols), np.uint8)
        r = int(min(rows, cols) * 0.35)
        cy, cx = np.ogrid[:rows, :cols]
        mask[(cy - crow) ** 2 + (cx - ccol) ** 2 <= r ** 2] = 0
        high_freq_energy = (magnitude_spectrum * mask).sum() / magnitude_spectrum.sum()

        laplacian_pass = laplacian_var > config.CLARITY_LAPLACIAN_THRESHOLD
        gradient_pass = gradient_mag > config.CLARITY_GRADIENT_THRESHOLD
        high_freq_pass = high_freq_energy > config.CLARITY_HIGH_FREQ_THRESHOLD

        # Clear if at least 2 of 3 metrics pass
        is_clear = sum([laplacian_pass, gradient_pass, high_freq_pass]) >= 2

        overall_score = (
            (min(laplacian_var / 500.0, 1.0) * 40) +
            (min(gradient_mag / 50.0, 1.0) * 40) +
            (min(high_freq_energy / 0.3, 1.0) * 20)
        )

        metrics = {
            "laplacian_variance": float(laplacian_var),
            "gradient_magnitude": float(gradient_mag),
            "high_freq_energy": float(high_freq_energy),
            "laplacian_pass": bool(laplacian_pass),
            "gradient_pass": bool(gradient_pass),
            "high_freq_pass": bool(high_freq_pass),
            "clarity_score": float(overall_score),
        }

        return is_clear, float(overall_score), metrics

    def _calculate_quality_score(self, checks: Dict[str, Any]) -> float:
        """
        Composite quality score (0–100). Higher = better.
          Gaze centering : 40 pts
          Eye openness   : 20 pts
          Clarity        : 40 pts
        """
        score = 0.0

        if checks.get("gaze_centered", False):
            score += 40.0 * checks.get("gaze_confidence", 0.5)

        if checks.get("eyes_fully_open", False):
            ear = checks.get("ear_score", 0.0)
            score += 20.0 * min(ear / 0.3, 1.0)

        score += checks.get("clarity_score", 0.0) * 0.4

        return float(score)

    def _get_detailed_errors(self, checks: Dict[str, Any]) -> List[str]:
        """Return human-readable list of failed checks."""
        errors = []

        if not checks.get("face_detected", False):
            errors.append("no_face_detected")

        if checks.get("multiple_faces", False):
            errors.append(f"multiple_faces_count_{checks.get('face_count', 'unknown')}")

        if not checks.get("gaze_centered", False):
            left_h = checks.get("left_gaze_ratio", 0.5)
            right_h = checks.get("right_gaze_ratio", 0.5)
            vert = checks.get("vertical_gaze_ratio", 0.5)

            if not checks.get("horizontal_centered", False):
                avg_h = (left_h + right_h) / 2
                errors.append(
                    f"gaze_not_centered_horizontally_ratio_{avg_h:.3f}"
                    f"_threshold_0.5±{config.GAZE_THRESHOLD}"
                )
            if not checks.get("vertical_centered", False):
                errors.append(
                    f"gaze_not_centered_vertically_ratio_{vert:.3f}"
                    f"_threshold_0.5±{config.GAZE_VERTICAL_THRESHOLD}"
                )

        errors.extend(checks.get("gaze_errors", []))

        if not checks.get("gaze_center_ok", False):
            errors.append("gaze_center_not_ok")

        if not checks.get("eyes_fully_open", False):
            errors.extend(checks.get("eye_errors", []))

        if checks.get("eyebrow_raised", False):
            errors.append("eyebrow_raised")

        if checks.get("mouth_open", False):
            errors.append("mouth_open")

        if not checks.get("face_aligned", False):
            errors.append("face_not_aligned")

        if not checks.get("face_clear", False):
            m = checks.get("clarity_metrics", {})
            errors.append(f"image_not_clear_score_{checks.get('clarity_score', 0):.1f}")
            if not m.get("laplacian_pass", True):
                errors.append(
                    f"low_edge_sharpness_laplacian_{m.get('laplacian_variance', 0):.1f}"
                    f"_threshold_{config.CLARITY_LAPLACIAN_THRESHOLD}"
                )
            if not m.get("gradient_pass", True):
                errors.append(
                    f"low_gradient_magnitude_{m.get('gradient_magnitude', 0):.1f}"
                    f"_threshold_{config.CLARITY_GRADIENT_THRESHOLD}"
                )
            if not m.get("high_freq_pass", True):
                errors.append(
                    f"low_high_freq_content_{m.get('high_freq_energy', 0):.3f}"
                    f"_threshold_{config.CLARITY_HIGH_FREQ_THRESHOLD}"
                )

        return errors

    def process(self, ctx) -> Dict[str, Any]:
        """
        Process one frame.

        Reads face detection results directly from ctx (set by FrameContext).
        Does NOT call any MediaPipe graph.

        Returns a result dict with module='best_frame_nopose'.

        OPTIMISATIONS vs original:
        1. Early-exit before expensive checks (crop + FFT clarity) when cheap
            checks already disqualify the frame. Saves ~100-300ms/frame on most
            frames in a typical video.
        2. PNG → JPEG encoding on new-best frames. JPEG is ~10x faster to encode
            and ~5x smaller on the wire. Quality 92 is visually lossless.
        3. No frame.copy() / crop.copy() until we actually have a new best.
            Previously copied speculatively on every passing frame.
        """
        # ── STEP 1: Face detection results from FrameContext ──────────────────
        multiple_faces = ctx.multiple_faces
        face_count = ctx.face_count

        if multiple_faces:
            face_errors = [f"multiple_faces_detected_count_{face_count}"]
        elif face_count == 0:
            face_errors = ["no_faces_detected"]
        else:
            face_errors = []

        # No face at all
        if face_count == 0:
            return {
                "module": "best_frame_nopose",
                "ok": False,
                "error": "NO_FACE_DETECTED",
                "message": "No face detected in frame",
                "checks": {"face_detected": False, "face_count": 0},
                "frame_number": ctx.frame_number,
                "timestamp": ctx.timestamp,
                "initialized": True,
                "errors": face_errors,
            }

        # Multiple faces
        if multiple_faces:
            return {
                "module": "best_frame_nopose",
                "ok": False,
                "error": "MULTIPLE_FACES_DETECTED",
                "message": f"Multiple faces detected: {face_count} faces. Only one allowed.",
                "checks": {
                    "face_detected": True,
                    "multiple_faces": True,
                    "face_count": face_count,
                },
                "frame_number": ctx.frame_number,
                "timestamp": ctx.timestamp,
                "initialized": True,
                "errors": face_errors,
            }

        # Face detected by FaceDetection but FaceMesh found no landmarks
        if not ctx.face_detected:
            return {
                "module": "best_frame_nopose",
                "ok": False,
                "error": "NO_LANDMARKS_DETECTED",
                "message": "Face detected but landmarks could not be extracted",
                "checks": {"face_detected": False, "face_count": 1},
                "frame_number": ctx.frame_number,
                "timestamp": ctx.timestamp,
                "initialized": True,
                "errors": ["no_landmarks_detected"],
            }

        h, w = ctx.frame.shape[:2]

        # ── STEP 2: 3D Gaze Analysis ──────────────────────────────────────────
        gaze_result = self.gaze.analyze_gaze_3d(ctx.mesh_points, w, h)
        gaze_ok = gaze_result["gaze_centered"]
        left_ratio = gaze_result["left_h_ratio"]
        right_ratio = gaze_result["right_h_ratio"]
        vert_ratio = gaze_result["vertical_ratio"]
        gaze_conf = gaze_result["confidence"]
        gaze_errors = gaze_result["errors"]

        # ── STEP 3: Eye Openness ──────────────────────────────────────────────
        eye_result = self.gaze.check_eyes_fully_open(ctx.mesh_points)
        eyes_fully_open = eye_result["eyes_fully_open"]
        blink = eye_result["blink_detected"]
        ear_score = eye_result["ear_score"]
        eye_status = eye_result["status"]
        eye_errors = eye_result["errors"]

        # ── STEP 4: Expression & Alignment Checks ────────────────────────────
        eyebrow_raised = self.gaze.detect_eyebrow_raise(
            ctx.mesh_points, pitch=0, yaw=0, roll=0
        )
        mouth_open = self.gaze.detect_mouth_open(ctx.mesh_points)
        face_aligned = self.gaze.check_face_alignment(ctx.mesh_points)
        gaze_center_ok, gaze_status = self.gaze_center.detect_center(ctx.mesh_points, w)

        # ── STEP 5: Early-exit gate before expensive crop + FFT ───────────────
        # OPTIMISATION: check_face_clarity() runs Laplacian + Sobel + FFT on a
        # cropped image. This is the most expensive per-frame operation (~100-300ms).
        # If any of the cheap landmark-based checks already fail, we know
        # passes_all_checks will be False — skip the crop and clarity entirely.
        cheap_checks_pass = (
            gaze_ok
            and eyes_fully_open
            and not eyebrow_raised
            and not mouth_open
            and face_aligned
        )

        face_clear = False
        clarity_score = 0.0
        clarity_metrics = {}
        crop = None
        crop_ok = False

        if cheap_checks_pass:
            # Only do the expensive crop + FFT when the frame has a chance of passing
            crop, crop_ok = self.cropper.crop_from_landmarks(ctx.frame, ctx.mesh_points, padding=None)
            if crop_ok:
                face_clear, clarity_score, clarity_metrics = self.check_face_clarity(crop)

        # ── STEP 6: Build checks dict ─────────────────────────────────────────
        checks = {
            "timestamp": float(ctx.timestamp),
            "frame_number": int(ctx.frame_number),

            # Face
            "face_detected": True,
            "multiple_faces": False,
            "face_count": 1,

            # Gaze (3D)
            "gaze_centered": bool(gaze_ok),
            "horizontal_centered": bool(gaze_result["horizontal_centered"]),
            "vertical_centered": bool(gaze_result["vertical_centered"]),
            "left_gaze_ratio": float(left_ratio),
            "right_gaze_ratio": float(right_ratio),
            "vertical_gaze_ratio": float(vert_ratio),
            "gaze_confidence": float(gaze_conf),
            "gaze_errors": gaze_errors,

            # Gaze center (secondary check)
            "gaze_center_ok": bool(gaze_center_ok),
            "gaze_status": str(gaze_status),

            # Eyes
            "blink_detected": bool(blink),
            "eyes_fully_open": bool(eyes_fully_open),
            "ear_score": float(ear_score),
            "eye_status": str(eye_status),
            "eye_errors": eye_errors,

            # Expressions
            "eyebrow_raised": bool(eyebrow_raised),
            "mouth_open": bool(mouth_open),

            # Alignment
            "face_aligned": bool(face_aligned),

            # Clarity (zeroed-out when skipped by early-exit gate)
            "face_clear": bool(face_clear),
            "clarity_score": float(clarity_score),
            "clarity_metrics": clarity_metrics,
        }

        # ── STEP 7: Pass/fail ─────────────────────────────────────────────────
        # gaze_center_ok is intentionally EXCLUDED from the hard gate.
        # See original comment in this file for full rationale.
        passes_all_checks = (
            cheap_checks_pass   # already computed above — reuse, don't re-evaluate
            and face_clear      # the one expensive check
        )
        checks["passes_all_checks"] = bool(passes_all_checks)

        # Per-check debug log
        if not passes_all_checks:
            failed = []
            if not checks["face_detected"]:     failed.append("face_detected")
            if checks["multiple_faces"]:        failed.append("multiple_faces")
            if not checks["gaze_centered"]:     failed.append("gaze_centered")
            if not checks["eyes_fully_open"]:   failed.append(f"eyes_fully_open(ear={ear_score:.3f})")
            if checks["eyebrow_raised"]:        failed.append("eyebrow_raised")
            if checks["mouth_open"]:            failed.append("mouth_open")
            if not checks["face_aligned"]:      failed.append("face_aligned")
            if not checks["face_clear"]:
                failed.append(
                    f"face_clear(lap={clarity_metrics.get('laplacian_variance', 0):.1f},"
                    f"grad={clarity_metrics.get('gradient_magnitude', 0):.1f})"
                )
            print(f"[FRAME {ctx.frame_number}] FAILED: {', '.join(failed)}")

        quality_score = self._calculate_quality_score(checks)
        checks["quality_score"] = float(quality_score)

        errors = [] if passes_all_checks else self._get_detailed_errors(checks)

        # ── STEP 8: Update best frame ─────────────────────────────────────────
        is_new_best = False
        if passes_all_checks and crop_ok and quality_score > self.best_quality_score:
            self.best_quality_score = quality_score
            # OPTIMISATION: only copy when we actually have a new best.
            # Previously the crop was always copied speculatively.
            self.best_crop = crop.copy()
            self.best_full_frame = ctx.frame.copy()
            self.best_frame_data = {
                "timestamp": float(ctx.timestamp),
                "frame_number": int(ctx.frame_number),
                "quality_score": float(quality_score),
            }
            is_new_best = True
            self.best_frame_saved = True

        checks["is_new_best"] = bool(is_new_best)
        checks["current_best_quality"] = float(self.best_quality_score)

        self.capture_history.append({
            "frame": ctx.frame_number,
            "quality_score": quality_score,
            "passes_checks": passes_all_checks,
            "is_new_best": is_new_best,
        })

        # ── STEP 9: Return ────────────────────────────────────────────────────
        if is_new_best:
            # OPTIMISATION: JPEG instead of PNG.
            # PNG is lossless but slow (~200-500ms for a full frame).
            # JPEG at quality 92 is visually lossless, ~10x faster to encode,
            # and produces ~5x smaller base64 payloads.
            # Change the suffix in your downstream consumer if it expects '.png'.
            encode_params = [cv2.IMWRITE_JPEG_QUALITY, 92]
            _, crop_buffer = cv2.imencode('.jpg', crop, encode_params)
            crop_base64 = base64.b64encode(crop_buffer).decode('utf-8')

            _, full_buffer = cv2.imencode('.jpg', ctx.frame, encode_params)
            full_base64 = base64.b64encode(full_buffer).decode('utf-8')

            return {
                "module": "best_frame_nopose",
                "ok": True,
                "captured": True,
                "updated": True,
                "cropped_face_base64": crop_base64,
                "full_frame_base64": full_base64,
                "checks": checks,
                "quality_score": float(quality_score),
                "previous_best_quality": float(self.best_quality_score - quality_score),
                "frame_number": ctx.frame_number,
                "timestamp": ctx.timestamp,
                "initialized": True,
                "errors": [],
            }

        return {
            "module": "best_frame_nopose",
            "ok": False,
            "captured": False,
            "checks": checks,
            "quality_score": float(quality_score),
            "frame_number": ctx.frame_number,
            "timestamp": ctx.timestamp,
            "best_frame_saved": self.best_frame_saved,
            "best_quality_score": float(self.best_quality_score) if self.best_quality_score > 0 else None,
            "initialized": True,
            "errors": errors,
        }
        
    def get_final_results(self) -> Dict[str, Any]:
        """Get the best frame results after all frames are processed."""
        if self.best_full_frame is None or self.best_crop is None:
            return {
                "best_frame": None,
                "message": "No frame found that passes all quality checks",
            }

        _, crop_buffer = cv2.imencode('.png', self.best_crop)
        crop_base64 = base64.b64encode(crop_buffer).decode('utf-8')

        _, full_buffer = cv2.imencode('.png', self.best_full_frame)
        full_base64 = base64.b64encode(full_buffer).decode('utf-8')

        return {
            "best_frame": {
                "quality_score": float(self.best_quality_score),
                "frame_data": self.best_frame_data,
                "full_frame_base64": full_base64,
                "cropped_face_base64": crop_base64,
            }
        }

    def close(self):
        """Clean up resources. No MediaPipe graphs owned by this class."""
        if hasattr(self.gaze, 'close'):
            self.gaze.close()
        if hasattr(self.gaze_center, 'close'):
            self.gaze_center.close()
        self.cropper.close()