/**
 * audioConstants.js — Central single source of truth for audio asset keys
 *
 * Categorized audio constants for error clips and instruction clips.
 */

export const ERROR_AUDIO = {
  ARE_YOU_STILL_THERE: 'errors/are_you_still_there',
  CANNOT_SCAN_THE_FACE_PLEASE_ALIGN: 'errors/cannot_scan_the_face_please_align',
  CONTACT_YOUR_KIOSK_COORDINATOR: 'errors/contact_your_kiosk_coordinator',
  COULDNT_GET_STABLE_READING: 'errors/couldnt_get_stable_reading',
  DIFFERENT_USER_FOUND: 'errors/different_user_found',
  FACE_NOT_DETECTED: 'errors/face_not_detected',
  fight_aligned_on_the_kiosk: 'errors/fight_aligned_on_the_kiosk',
  HOLD_BOTH_HANDLES_FIRMLY_TO_CONTINUE: 'errors/hold_both_handles_firmly_to_continue',
  HOLD_BOTH_HANDLES_FIRMLY_WITH_YOUR_PALM: 'errors/hold_both_handles_firmly_with_your_palm',
  INVALID_SUHI_ID_COORDINATE: 'errors/invalid_suhi_id_coordinate',
  LET_TRY_SUHI_ID: 'errors/let_try_suhi_id',
  MULTIPLE_FACES_DETECTED: 'errors/multiple_faces_detected',
  OOPS_COULDNT_DETECT_YOU_TRY_AGAIN: 'errors/oops_couldnt_detect_you_try_again',
  PLEASE_ASK_YOUR_TEACHER: 'errors/please_ask_your_teacher',
  PRESS_START_ONCE_YOU_ARE_READY: 'errors/press_start_once_you_are_ready',
  REMOVE_YOUR_SHOES_AND_SOCKS: 'errors/remove_your_shoes_and_socks',
  STAND_FULLY_ON_THE_PLATFORM: 'errors/stand_fully_on_the_platform',
  STAND_ON_THE_KISOK: 'errors/stand_on_the_kisok',
  STAY_STILL_I_AM_MEASURING_HEIGHT: 'errors/stay_still_i_am_measuring_height',
  TRING_AGAIN_KEEP_HOLDING: 'errors/tring_again_keep_holding',
  UNABLE_TO_DETECT_ANY_ACTIVITY: 'errors/unable_to_detect_any_activity',

  // Raw key aliases for dynamic lookups
  are_you_still_there: 'errors/are_you_still_there',
  cannot_scan_the_face_please_align: 'errors/cannot_scan_the_face_please_align',
  contact_your_kiosk_coordinator: 'errors/contact_your_kiosk_coordinator',
  couldnt_get_stable_reading: 'errors/couldnt_get_stable_reading',
  different_user_found: 'errors/different_user_found',
  face_not_detected: 'errors/face_not_detected',
  fight_aligned_on_the_kiosk: 'errors/fight_aligned_on_the_kiosk',
  hold_both_handles_firmly_to_continue: 'errors/hold_both_handles_firmly_to_continue',
  hold_both_handles_firmly_with_your_palm: 'errors/hold_both_handles_firmly_with_your_palm',
  invalid_suhi_id_coordinate: 'errors/invalid_suhi_id_coordinate',
  let_try_suhi_id: 'errors/let_try_suhi_id',
  multiple_faces_detected: 'errors/multiple_faces_detected',
  oops_couldnt_detect_you_try_again: 'errors/oops_couldnt_detect_you_try_again',
  please_ask_your_teacher: 'errors/please_ask_your_teacher',
  press_start_once_you_are_ready: 'errors/press_start_once_you_are_ready',
  remove_your_shoes_and_socks: 'errors/remove_your_shoes_and_socks',
  stand_fully_on_the_platform: 'errors/stand_fully_on_the_platform',
  stand_on_the_kisok: 'errors/stand_on_the_kisok',
  stay_still_i_am_measuring_height: 'errors/stay_still_i_am_measuring_height',
  tring_again_keep_holding: 'errors/tring_again_keep_holding',
  unable_to_detect_any_activity: 'errors/unable_to_detect_any_activity',
}

export const INSTRUCTION_AUDIO = {
  CAMERA_SCAN: 'instructions/camera_scan',
  COGNITIVE_GAME_INSTRUCTION: 'instructions/cognitive_game_instruction',
  COLORBLINDNESS_INSTRUCTION: 'instructions/colorblindness_instruction',
  COMPLETE_VOICE_INSTRUCTION: 'instructions/complete_voice_instruction',
  CONFIRM_USER: 'instructions/confirm_user',
  IM_COMPLETE: 'instructions/im_complete',
  IMPEDANCE: 'instructions/impedance',
  STANDSTRAIGHT: 'instructions/standstraight',
  VOICE_INSTRUCTION: 'instructions/voice_instruction',
  WELCOME_SCREEN: 'instructions/welcome_screen',
  WH_COMPLETE: 'instructions/wh_complete',
  WH_MEASURING: 'instructions/wh_measuring',

  // Raw key aliases for dynamic lookups
  camera_scan: 'instructions/camera_scan',
  cognitive_game_instruction: 'instructions/cognitive_game_instruction',
  colorblindness_instruction: 'instructions/colorblindness_instruction',
  complete_voice_instruction: 'instructions/complete_voice_instruction',
  confirm_user: 'instructions/confirm_user',
  im_complete: 'instructions/im_complete',
  impedance: 'instructions/impedance',
  standstraight: 'instructions/standstraight',
  voice_instruction: 'instructions/voice_instruction',
  welcome_screen: 'instructions/welcome_screen',
  wh_complete: 'instructions/wh_complete',
  wh_measuring: 'instructions/wh_measuring',
}

// Aliases for user-specified naming
export const Error_AUDIO = ERROR_AUDIO
export const INSTRCUTION_AUDIO = INSTRUCTION_AUDIO
export const Instruction_AUDIO = INSTRUCTION_AUDIO

// Helper functions for dynamic key resolution
export const getErrorAudioKey = (name) => `errors/${name}`
export const getInstructionAudioKey = (name) => `instructions/${name}`
