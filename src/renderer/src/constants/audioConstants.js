/**
 * audioConstants.js — Central single source of truth for audio asset keys
 *
 * Categorized audio constants for error clips and instruction clips.
 */

export const ERROR_AUDIO = {
    ARE_YOU_STILL_THERE: "errors/are_you_still_there",
    CANNOT_SCAN_THE_FACE_PLEASE_ALIGN: "errors/cannot_scan_the_face_please_align",
    CONTACT_YOUR_KIOSK_COORDINATOR: "errors/contact_your_kiosk_coordinator",
    COULDNT_GET_STABLE_READING: "errors/couldnt_get_stable_reading",
    DIFFERENT_USER_FOUND: "errors/different_user_found",
    FACE_NOT_DETECTED: "errors/face_not_detected",
    fight_aligned_on_the_kiosk: "errors/fight_aligned_on_the_kiosk",
    HOLD_BOTH_HANDLES_FIRMLY_TO_CONTINUE: "errors/hold_both_handles_firmly_to_continue",
    HOLD_BOTH_HANDLES_FIRMLY_WITH_YOUR_PALM: "errors/hold_both_handles_firmly_with_your_palm",
    INVALID_SUHI_ID_COORDINATE: "errors/invalid_suhi_id_coordinate",
    LET_TRY_SUHI_ID: "errors/let_try_suhi_id",
    MULTIPLE_FACES_DETECTED: "errors/multiple_faces_detected",
    OOPS_COULDNT_DETECT_YOU_TRY_AGAIN: "errors/oops_couldnt_detect_you_try_again",
    PLEASE_ASK_YOUR_TEACHER: "errors/please_ask_your_teacher",
    PRESS_START_ONCE_YOU_ARE_READY: "errors/press_start_once_you_are_ready",
    REMOVE_YOUR_SHOES_AND_SOCKS: "errors/remove_your_shoes_and_socks",
    STAND_FULLY_ON_THE_PLATFORM: "errors/stand_fully_on_the_platform",
    stand_on_the_kiosk: "errors/stand_on_the_kiosk",
    STAY_STILL_I_AM_MEASURING_HEIGHT: "errors/stay_still_i_am_measuring_height",
    TRING_AGAIN_KEEP_HOLDING: "errors/tring_again_keep_holding",
    UNABLE_TO_DETECT_ANY_ACTIVITY: "errors/unable_to_detect_any_activity",

    // Raw key aliases for dynamic lookups
    are_you_still_there: "errors/are_you_still_there",
    cannot_scan_the_face_please_align: "errors/cannot_scan_the_face_please_align",
    contact_your_kiosk_coordinator: "errors/contact_your_kiosk_coordinator",
    couldnt_get_stable_reading: "errors/couldnt_get_stable_reading",
    different_user_found: "errors/different_user_found",
    face_not_detected: "errors/face_not_detected",
    fight_aligned_on_the_kiosk: "errors/fight_aligned_on_the_kiosk",
    hold_both_handles_firmly_to_continue: "errors/hold_both_handles_firmly_to_continue",
    hold_both_handles_firmly_with_your_palm: "errors/hold_both_handles_firmly_with_your_palm",
    invalid_suhi_id_coordinate: "errors/invalid_suhi_id_coordinate",
    let_try_suhi_id: "errors/let_try_suhi_id",
    multiple_faces_detected: "errors/multiple_faces_detected",
    oops_couldnt_detect_you_try_again: "errors/oops_couldnt_detect_you_try_again",
    please_ask_your_teacher: "errors/please_ask_your_teacher",
    press_start_once_you_are_ready: "errors/press_start_once_you_are_ready",
    remove_your_shoes_and_socks: "errors/remove_your_shoes_and_socks",
    stand_fully_on_the_platform: "errors/stand_fully_on_the_platform",
    stand_on_the_kiosk: "errors/stand_on_the_kiosk",
    stay_still_i_am_measuring_height: "errors/stay_still_i_am_measuring_height",
    tring_again_keep_holding: "errors/tring_again_keep_holding",
    unable_to_detect_any_activity: "errors/unable_to_detect_any_activity"
}

export const INSTRUCTION_AUDIO = {
    CAMERA_SCAN: "instructions/camera_scan",
    COGNITIVE_GAME_INSTRUCTION: "instructions/cognitive_game_instruction",
    COLORBLINDNESS_INSTRUCTION: "instructions/colorblindness_instruction",
    COMPLETE_VOICE_INSTRUCTION: "instructions/complete_voice_instruction",
    CONFIRM_USER: "instructions/confirm_user",
    IM_COMPLETE: "instructions/im_complete",
    IMPEDANCE: "instructions/impedance",
    STANDSTRAIGHT: "instructions/standstraight",
    VOICE_INSTRUCTION: "instructions/voice_instruction",
    WELCOME_SCREEN: "instructions/welcome_screen",
    WH_COMPLETE: "instructions/wh_complete",
    WH_MEASURING: "instructions/wh_measuring",

    // Perilous Path intro instructions
    PERILOUS_LETS_LEARN_HOW_TO_PLAY: "instructions/perilous_path_lets_learn_how_to_play",
    PERILOUS_COMPLETE_THE_PATH: "instructions/perilous_path_complete_the_path",
    PERILOUS_REMEMBER_DANGER: "instructions/perilous_path_remember_danger",
    PERILOUS_AVOID_AND_COMPLETE: "instructions/perilous_path_avoid_and_complete",
    PERILOUS_PRESS_START_WHEN_READY: "instructions/perilous_path_press_start_when_ready",

    // Visual Acuity intro instructions
    VISUAL_ACUITY_LETS_LEARN_HOW_TO_PLAY: "instructions/visual_acuity_lets_learn_how_to_play",
    VISUAL_ACUITY_COVER_YOUR_LEFT_EYE: "instructions/visual_acuity_cover_your_left_eye",
    VISUAL_ACUITY_COVER_YOUR_RIGHT_EYE: "instructions/visual_acuity_cover_your_right_eye",
    VISUAL_ACUITY_LOOK_CAREFULLY_AT_THE_C_SHAPE: "instructions/visual_acuity_look_carefully_at_the_c_shape",
    VISUAL_ACUITY_PRESS_START_WHEN_READY: "instructions/visual_acuity_press_start_when_ready",

    // Beat Drop intro instructions
    BEAT_DROP_LETS_LEARN_HOW_TO_PLAY: "instructions/beat_drop_lets_learn_how_to_play",
    BEAT_DROP_PRESS_THE_PIANO_KEY: "instructions/beat_drop_press_the_piano_key",
    BEAT_DROP_HIT_EACH_NOTE: "instructions/beat_drop_hit_each_note",
    BEAT_DROP_KEEP_ACCURATE_TIMING: "instructions/beat_drop_keep_accurate_timing",
    BEAT_DROP_PRESS_START_WHEN_READY: "instructions/beat_drop_press_start_when_ready",

    // Smoothie Slash intro instructions
    SMOOTHIE_SLASH_INSTRUCTION: "instructions/smoothie_slash_instruction",

    // Raw key aliases for dynamic lookups
    camera_scan: "instructions/camera_scan",
    cognitive_game_instruction: "instructions/cognitive_game_instruction",
    colorblindness_instruction: "instructions/colorblindness_instruction",
    complete_voice_instruction: "instructions/complete_voice_instruction",
    confirm_user: "instructions/confirm_user",
    im_complete: "instructions/im_complete",
    impedance: "instructions/impedance",
    standstraight: "instructions/standstraight",
    voice_instruction: "instructions/voice_instruction",
    welcome_screen: "instructions/welcome_screen",
    wh_complete: "instructions/wh_complete",
    wh_measuring: "instructions/wh_measuring",
    perilous_lets_learn_how_to_play: "instructions/perilous_path_lets_learn_how_to_play",
    perilous_complete_the_path: "instructions/perilous_path_complete_the_path",
    perilous_remember_danger: "instructions/perilous_path_remember_danger",
    perilous_avoid_and_complete: "instructions/perilous_path_avoid_and_complete",
    perilous_press_start_when_ready: "instructions/perilous_path_press_start_when_ready",
    visual_acuity_lets_learn_how_to_play: "instructions/visual_acuity_lets_learn_how_to_play",
    visual_acuity_cover_your_left_eye: "instructions/visual_acuity_cover_your_left_eye",
    visual_acuity_cover_your_right_eye: "instructions/visual_acuity_cover_your_right_eye",
    visual_acuity_look_carefully_at_the_c_shape: "instructions/visual_acuity_look_carefully_at_the_c_shape",
    visual_acuity_press_start_when_ready: "instructions/visual_acuity_press_start_when_ready",
    beat_drop_lets_learn_how_to_play: "instructions/beat_drop_lets_learn_how_to_play",
    beat_drop_press_the_piano_key: "instructions/beat_drop_press_the_piano_key",
    beat_drop_hit_each_note: "instructions/beat_drop_hit_each_note",
    beat_drop_keep_accurate_timing: "instructions/beat_drop_keep_accurate_timing",
    beat_drop_press_start_when_ready: "instructions/beat_drop_press_start_when_ready",
    smoothie_slash_instruction: "instructions/smoothie_slash_instruction"
}

// Aliases for user-specified naming
export const Error_AUDIO = ERROR_AUDIO
export const INSTRCUTION_AUDIO = INSTRUCTION_AUDIO
export const Instruction_AUDIO = INSTRUCTION_AUDIO

// Helper functions for dynamic key resolution
export const getErrorAudioKey = (name) => `errors/${name}`
export const getInstructionAudioKey = (name) => `instructions/${name}`
