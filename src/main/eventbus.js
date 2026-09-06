import { EventEmitter } from "events"

export const eventBus = new EventEmitter()

export const EVENTS = {
    HEIGHT_STATUS: "height:status",
    HEIGHT_ERROR: "height:error",

    WEIGHT_STATUS: "weight:status",
    WEIGHT_ERROR: "weight:error",

    IMPEDANCE_STATUS: "impedance:status",
    IMPEDANCE_ERROR: "impedance:error",

    LEG_STATUS: "leg:status",
    LEG_ERROR: "leg:error",

    ARM_STATUS: "arm:status",
    ARM_ERROR: "arm:error",

    // 4-electrode body composition results
    LEGS_COMP_COMPLETE: "leg:calc:result",
    ARMS_COMP_COMPLETE: "arm:calc:result"
}
