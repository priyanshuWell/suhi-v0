/**
 * Data Converter Service
 * Converts parsed body composition data from binary packages to API payload format
 */

class DataConverterService {
  constructor() {
    this.sessionId = null;
    this.userId = null;
    this.measurementStatus = 'BIA_NULL';
    this.errorType = 0;
    this.errorDetails = {};
  }

  /**
   * Initialize session and user information
   * @param {string} sessionId - Session identifier
   * @param {string} userId - User UUID
   * @param {string} measurementStatus - Measurement status (default: BIA_NULL)
   */
  initializeSession(sessionId, userId, measurementStatus = 'BIA_NULL') {
    this.sessionId = sessionId;
    this.userId = userId;
    this.measurementStatus = measurementStatus;
  }

  /**
   * Convert parsed packages to API payload
   * @param {object} parsedData - Data from parsePackages (packages 1-5)
   * @param {object} userInfo - User information { height_cm, weight_kg, age_years }
   * @param {object} impedanceData - Impedance measurements { impedance_20khz_ohm, impedance_50khz_ohm, impedance_100khz_ohm }
   * @returns {object} Complete API payload
   */
  convertToApiPayload(parsedData, userInfo = {}, impedanceData = {}) {
    const payload = {
      // Session Information
      session_id: this.sessionId || 'unknown',
      user_id: this.userId || '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      measurement_status: this.measurementStatus,
      error_type: this.errorType,
      error_details: this.errorDetails,

      // User Input Data
      height_cm: userInfo.height_cm || 0,
      weight_kg: userInfo.weight_kg || 0,
      age_years: userInfo.age_years || 0,

      // Impedance Data
      impedance_20khz_ohm: impedanceData.impedance_20khz_ohm || 0,
      impedance_50khz_ohm: impedanceData.impedance_50khz_ohm || 0,
      impedance_100khz_ohm: impedanceData.impedance_100khz_ohm || 0,
    };

    // Package 1: Whole Body Composition
    if (parsedData.package1) {
      const p1 = parsedData.package1;
      Object.assign(payload, {
        body_weight_kg: p1.bodyWeight || 0,
        body_weight_min_kg: p1.bodyWeightStandardMin || 0,
        body_weight_max_kg: p1.bodyWeightStandardMax || 0,
        moisture_content_kg: p1.moistureContent || 0,
        moisture_content_min_kg: p1.moistureContentStandardMin || 0,
        moisture_content_max_kg: p1.moistureContentStandardMax || 0,
        body_fat_mass_kg: p1.bodyFatMass || 0,
        body_fat_mass_min_kg: p1.bodyFatMassStandardMin || 0,
        body_fat_mass_max_kg: p1.bodyFatMassStandardMax || 0,
        protein_mass_kg: p1.proteinMass || 0,
        protein_mass_min_kg: p1.proteinMassStandardMin || 0,
        protein_mass_max_kg: p1.proteinMassStandardMax || 0,
        inorganic_salt_kg: p1.inorganicSaltMass || 0,
        inorganic_salt_min_kg: p1.inorganicSaltMassStandardMin || 0,
        inorganic_salt_max_kg: p1.inorganicSaltMassStandardMax || 0,
        lean_body_weight_kg: p1.leanBodyWeight || 0,
        lean_body_weight_min_kg: p1.leanBodyWeightStandardMin || 0,
        lean_body_weight_max_kg: p1.leanBodyWeightStandardMax || 0,
        muscle_mass_kg: p1.muscleMass || 0,
        muscle_mass_min_kg: p1.muscleMassStandardMin || 0,
        muscle_mass_max_kg: p1.muscleMassStandardMax || 0,
        bone_mass_kg: p1.boneMass || 0,
        bone_mass_min_kg: p1.boneMassStandardMin || 0,
        bone_mass_max_kg: p1.boneMassStandardMax || 0,
        skeletal_muscle_mass_kg: p1.skeletalMuscleMass || 0,
        skeletal_muscle_mass_min_kg: p1.skeletalMuscleMassStandardMin || 0,
        skeletal_muscle_mass_max_kg: p1.skeletalMuscleMassStandardMax || 0,
        intracellular_water_kg: p1.intracellularWaterVolume || 0,
        intracellular_water_min_kg: p1.intracellularWaterVolumeMin || 0,
        intracellular_water_max_kg: p1.intracellularWaterVolumeMax || 0,
        extracellular_water_kg: p1.extracellularWaterVolume || 0,
        extracellular_water_min_kg: p1.extracellularWaterVolumeMin || 0,
        extracellular_water_max_kg: p1.extracellularWaterVolumeMax || 0,
        body_cell_mass_kg: p1.bodyCellMass || 0,
        body_cell_mass_min_kg: p1.bodyCellMassMin || 0,
        body_cell_mass_max_kg: p1.bodyCellMassMax || 0,
        subcutaneous_fat_mass_kg: p1.subcutaneousFatMass || 0,
      });
    }

    // Package 2: Segmental Fat and Muscle Information
    if (parsedData.package2) {
      const p2 = parsedData.package2;
      
      // Right Hand
      Object.assign(payload, {
        right_hand_fat_mass_kg: p2.segmentalFatMass?.rightHand || 0,
        right_hand_fat_percentage: p2.segmentalFatPercentage?.rightHand || 0,
        right_hand_muscle_mass_kg: p2.segmentalMuscleMass?.rightHand || 0,
        right_hand_muscle_ratio: p2.segmentalMuscleRatio?.rightHand || 0,
      });

      // Left Hand
      Object.assign(payload, {
        left_hand_fat_mass_kg: p2.segmentalFatMass?.leftHand || 0,
        left_hand_fat_percentage: p2.segmentalFatPercentage?.leftHand || 0,
        left_hand_muscle_mass_kg: p2.segmentalMuscleMass?.leftHand || 0,
        left_hand_muscle_ratio: p2.segmentalMuscleRatio?.leftHand || 0,
      });

      // Trunk
      Object.assign(payload, {
        trunk_fat_mass_kg: p2.segmentalFatMass?.trunk || 0,
        trunk_fat_percentage: p2.segmentalFatPercentage?.trunk || 0,
        trunk_muscle_mass_kg: p2.segmentalMuscleMass?.trunk || 0,
        trunk_muscle_ratio: p2.segmentalMuscleRatio?.trunk || 0,
      });

      // Right Foot
      Object.assign(payload, {
        right_foot_fat_mass_kg: p2.segmentalFatMass?.rightFoot || 0,
        right_foot_fat_percentage: p2.segmentalFatPercentage?.rightFoot || 0,
        right_foot_muscle_mass_kg: p2.segmentalMuscleMass?.rightFoot || 0,
        right_foot_muscle_ratio: p2.segmentalMuscleRatio?.rightFoot || 0,
      });

      // Left Foot
      Object.assign(payload, {
        left_foot_fat_mass_kg: p2.segmentalFatMass?.leftFoot || 0,
        left_foot_fat_percentage: p2.segmentalFatPercentage?.leftFoot || 0,
        left_foot_muscle_mass_kg: p2.segmentalMuscleMass?.leftFoot || 0,
        left_foot_muscle_ratio: p2.segmentalMuscleRatio?.leftFoot || 0,
      });
    }

    // Package 5: Segment Standards (these map to standard fields in package 2 areas)
    if (parsedData.package5) {
      const p5 = parsedData.package5;
      Object.assign(payload, {
        right_hand_fat_standard: p5.segmentalFatStandards?.rightHand || 0,
        right_hand_muscle_standard: p5.segmentalMuscleStandards?.rightHand || 0,
        left_hand_fat_standard: p5.segmentalFatStandards?.leftHand || 0,
        left_hand_muscle_standard: p5.segmentalMuscleStandards?.leftHand || 0,
        trunk_fat_standard: p5.segmentalFatStandards?.trunk || 0,
        trunk_muscle_standard: p5.segmentalMuscleStandards?.trunk || 0,
        right_foot_fat_standard: p5.segmentalFatStandards?.rightFoot || 0,
        right_foot_muscle_standard: p5.segmentalMuscleStandards?.rightFoot || 0,
        left_foot_fat_standard: p5.segmentalFatStandards?.leftFoot || 0,
        left_foot_muscle_standard: p5.segmentalMuscleStandards?.leftFoot || 0,
      });
    }

    // Package 3: Evaluation Suggestions
    if (parsedData.package3) {
      const p3 = parsedData.package3;
      Object.assign(payload, {
        body_score: p3.bodyScore || 0,
        physical_age_years: p3.physicalAge || 0,
        body_type: p3.bodyType || 'THIN',
        skeletal_muscle_mass_index: p3.skeletalMuscleMassIndex || 0,
        waist_hip_ratio: p3.waistToHipRatio || 0,
        waist_hip_ratio_min: p3.waistToHipRatioStandardMin || 0,
        waist_hip_ratio_max: p3.waistToHipRatioStandardMax || 0,
        visceral_fat_level: p3.visceralFatLevel || 0,
        visceral_fat_level_min: p3.visceralFatLevelStandardMin || 0,
        visceral_fat_level_max: p3.visceralFatLevelStandardMax || 0,
        obesity_percentage: p3.obesityPercentage || 0,
        obesity_percentage_min: p3.obesityPercentageStandardMin || 0,
        obesity_percentage_max: p3.obesityPercentageStandardMax || 0,
        bmi: p3.bodyMassIndex || 0,
        bmi_min: p3.bodyMassIndexStandardMin || 0,
        bmi_max: p3.bodyMassIndexStandardMax || 0,
        body_fat_percentage: p3.bodyFatPercentage || 0,
        body_fat_percentage_min: p3.bodyFatPercentageStandardMin || 0,
        body_fat_percentage_max: p3.bodyFatPercentageStandardMax || 0,
        basal_metabolism_kcal: p3.basalMetabolism || 0,
        basal_metabolism_min_kcal: p3.basalMetabolismStandardMin || 0,
        basal_metabolism_max_kcal: p3.basalMetabolismStandardMax || 0,
        recommended_intake_kcal: p3.recommendedIntake || 0,
        ideal_weight_kg: p3.idealWeight || 0,
        target_weight_kg: p3.targetWeight || 0,
        weight_control_kg: p3.weightControlAmount || 0,
        muscle_control_kg: p3.muscleControlAmount || 0,
        fat_control_kg: p3.fatControlAmount || 0,
        subcutaneous_fat_percentage: p3.subcutaneousFatPercentage || 0,
        subcutaneous_fat_percentage_min: p3.subcutaneousFatPercentageStandardMin || 0,
        subcutaneous_fat_percentage_max: p3.subcutaneousFatPercentageStandardMax || 0,
      });
    }

    // Package 4: Exercise Consumption
    if (parsedData.package4) {
      const p4 = parsedData.package4;
      const exercises = p4.exerciseConsumption || {};
      Object.assign(payload, {
        walk_kcal_per_30min: exercises.walk || 0,
        golf_kcal_per_30min: exercises.golf || 0,
        croquet_kcal_per_30min: exercises.croquet || 0,
        tennis_cycling_basketball_kcal_per_30min: exercises.tennis || 0,
        squash_bouncy_ball_taekwondo_fencing_kcal_per_30min: exercises.squash || 0,
        climb_mountains_kcal_per_30min: exercises.mountainClimbing || 0,
        swimming_aerobics_jogging_football_skipping_rope_kcal_per_30min: exercises.swimming || 0,
        badminton_table_tennis_kcal_per_30min: exercises.badminton || 0,
      });
    }

    return payload;
  }

  /**
   * Set error information
   * @param {number} errorType - Error type code
   * @param {object} errorDetails - Error details object
   */
  setError(errorType, errorDetails = {}) {
    this.errorType = errorType;
    this.errorDetails = errorDetails;
  }
}

export default DataConverterService;