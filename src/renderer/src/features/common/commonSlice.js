import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  cloudSyncData: null,

  user: null,
  lang: "en",
  sessionId: null, // BIA session identifier
  screening: {
    sessionId: null,
    isResumed: false,
    resumeCount: 0,
    nextStage: null,
    completedStages: [],
  },

  // example shared states
  videoBase64: null,
  recordedVideoInfo: null,

  // any hardware or measurement data
  height: {
    fptHeight:null,
    preliminaryHeight:null,
    finalHeight:null,
  },
  weight: {
    fptWeight:"",
    preliminaryWeight:null,  
    finalWeight:null,  
  },
  biaResult: {
    biaLegs:null,
    biaArms:null,
    biaFinal:null
  },
  bmiResult:null,
};

const commonSlice = createSlice({
  name: "common",
  initialState,
  reducers: {
    setCloudSyncData: (state, action) => {
      state.cloudSyncData = action.payload;
    },

    setUser: (state, action) => {
      state.user = action.payload;
    },

    //  The ONLY action that may set sessionId. Called once, from the
    // login/realtime-capture response. This is the single source of truth
    // for sessionId for the entire screening flow — every later stage
    // response (BIA, voice, DMIT, etc.) also includes a `session_id`, but
    // we deliberately ignore it there and rely on this value instead.
    setLoginScreening: (state, action) => {
      if (action.payload) {
        state.screening = {
          sessionId: action.payload.session_id || null,
          isResumed: action.payload.is_resumed || false,
          resumeCount: action.payload.resume_count || 0,
          nextStage: action.payload.next_stage || null,
          completedStages: action.payload.completed_stages || [],
        };
      } else {
        state.screening = initialState.screening;
      }
    },

    setLang: (state, action) => {
      state.lang = action.payload;
    },

    setVideoBase64: (state, action) => {
      state.videoBase64 = action.payload;
    },

    setRecordedVideoInfo: (state, action) => {
      state.recordedVideoInfo = action.payload;
    },

    // update finalHeight while preserving the height object structure
    setHeight: (state, action) => {
      // ensure height is an object
      if (typeof state.height !== "object" || state.height === null) {
        state.height = { finalHeight: action.payload };
      } else {
        state.height.finalHeight = action.payload;
      }
    },

    // update finalWeight while preserving the weight object structure
    setWeight: (state, action) => {
      if (typeof state.weight !== "object" || state.weight === null) {
        state.weight = { finalWeight: action.payload };
      } else {
        state.weight.finalWeight = action.payload;
      }
    },

    setFptHeight: (state, action) => {
      if (typeof state.height !== "object" || state.height === null) {
        // migrate numeric height -> finalHeight
        const prev =
          typeof state.height === "number" ? { finalHeight: state.height } : {};
        state.height = { ...prev, fptHeight: action.payload };
      } else {
        state.height.fptHeight = action.payload;
      }
    },

    setFptWeight: (state, action) => {
      if (typeof state.weight !== "object" || state.weight === null) {
        const prev =
          typeof state.weight === "number" ? { finalWeight: state.weight } : {};
        state.weight = { ...prev, fptWeight: action.payload };
      } else {
        state.weight.fptWeight = action.payload;
      }
    },

    setPreliminaryHeight: (state, action) => {
      if (typeof state.height !== "object" || state.height === null) {
        const prev =
          typeof state.height === "number" ? { finalHeight: state.height } : {};
        state.height = { ...prev, preliminaryHeight: action.payload };
      } else {
        state.height.preliminaryHeight = action.payload;
      }
    },

    setPreliminaryWeight: (state, action) => {
      if (typeof state.weight !== "object" || state.weight === null) {
        const prev =
          typeof state.weight === "number" ? { finalWeight: state.weight } : {};
        state.weight = { ...prev, preliminaryWeight: action.payload };
      } else {
        state.weight.preliminaryWeight = action.payload;
      }
    },

    setBiaResult: (state, action) => {
      state.biaResult.biaFinal = action.payload;
    },

    setLegBiaResult: (state, action) => {
      state.biaResult.biaLegs = action.payload;
    },

    setArmBiaResult: (state, action) => {
      state.biaResult.biaArms = action.payload;
    },

    setBmiResult: (state, action) => {
      state.bmiResult = action.payload;
    },

    setSessionId: (state, action) => {
      state.sessionId = action.payload;
    },

    //  Used for every stage-complete call AFTER login (BIA, voice, DMIT, etc.)
    // Deliberately NEVER touches sessionId — that is locked in once by
    // setLoginScreening and must persist for the entire screening flow,
    // per product requirement: "screening session id always from login API."
    setScreening: (state, action) => {
      if (action.payload) {
        state.screening = {
          ...state.screening,
          // sessionId intentionally NOT updated here — see setLoginScreening
          isResumed: action.payload.is_resumed ?? state.screening.isResumed,
          resumeCount: action.payload.resume_count ?? state.screening.resumeCount,
          nextStage: action.payload.next_stage ?? state.screening.nextStage,
          completedStages: action.payload.completed_stages ?? state.screening.completedStages,
        };
      }
      // Note: removed the "else → reset to initialState" branch that existed
      // previously, since setScreening should never be called with a falsy
      // payload during normal stage progression. Use resetCommonState() to
      // clear the session on logout instead.
    },

    resetCommonState: () => initialState,
  },
});

export const {
  setCloudSyncData,
  setUser,
  setLoginScreening,
  setLang,
  setVideoBase64,
  setRecordedVideoInfo,
  setHeight,
  setWeight,
  setFptHeight,
  setFptWeight,
  setPreliminaryHeight,
  setPreliminaryWeight,
  setBiaResult,
  setLegBiaResult,
  setArmBiaResult,
  resetCommonState,
  setBmiResult,
  setSessionId,
  setScreening
} = commonSlice.actions;

export default commonSlice.reducer;