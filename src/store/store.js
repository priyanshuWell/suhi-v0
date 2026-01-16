import { configureStore } from "@reduxjs/toolkit";
import commonReducer from "../renderer/src/features/common/commonSlice";

export const store = configureStore({
  reducer: {
    common: commonReducer,
  },
  devTools: import.meta.env.MODE !== "production",
});
