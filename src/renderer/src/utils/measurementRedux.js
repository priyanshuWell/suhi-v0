import { 
  setFptHeight, 
  setFptWeight, 
  setPreliminaryHeight, 
  setPreliminaryWeight 
} from '../features/common/commonSlice';

/**
 * Store FPT measurements (from face recognition)
 * @param {Function} dispatch - Redux dispatch function
 * @param {number} weight - Weight in kg
 * @param {number} height - Height in cm
 */
export const storeFptMeasurements = (dispatch, weight, height) => {
  console.log('[REDUX] Storing FPT measurements:', { weight, height });
  
  if (weight !== null && weight !== undefined) {
    dispatch(setFptWeight(weight));
  }
  
  if (height !== null && height !== undefined) {
    dispatch(setFptHeight(height));
  }
};

/**
 * Store preliminary measurements (from BIA)
 * @param {Function} dispatch - Redux dispatch function
 * @param {number} weight - Weight in kg
 * @param {number} height - Height in cm
 */
export const storePreliminaryMeasurements = (dispatch, weight, height) => {
  console.log('[REDUX] Storing preliminary measurements:', { weight, height });
  
  if (weight !== null && weight !== undefined) {
    dispatch(setPreliminaryWeight(weight));
  }
  
  if (height !== null && height !== undefined) {
    dispatch(setPreliminaryHeight(height));
  }
};
