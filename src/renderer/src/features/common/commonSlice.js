import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  cloudSyncData: null,

  user: null,
  lang: "en",
  sessionId: null, // BIA session identifier

  // example shared states
  videoBase64: null,
  recordedVideoInfo: null,

  // any hardware or measurement data
  height: null,
  weight: null,
  biaResult: null,
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

    setLang: (state, action) => {
      state.lang = action.payload;
    },

    setVideoBase64: (state, action) => {
      state.videoBase64 = action.payload;
    },

    setRecordedVideoInfo: (state, action) => {
      state.recordedVideoInfo = action.payload;
    },

    setHeight: (state, action) => {
      state.height = action.payload;
    },

    setWeight: (state, action) => {
      state.weight = action.payload;
    },

    setBiaResult: (state, action) => {
      state.biaResult = action.payload;
    },
     setBmiResult: (state, action) => {
      state.bmiResult = action.payload;
    },

    setSessionId: (state, action) => {
      state.sessionId = action.payload;
    },

    resetCommonState: () => initialState,
  },
});

export const {
  setCloudSyncData,
  setUser,
  setLang,
  setVideoBase64,
  setRecordedVideoInfo,
  setHeight,
  setWeight,
  setBiaResult,
  resetCommonState,
  setBmiResult,
  setSessionId
} = commonSlice.actions;

export default commonSlice.reducer;
