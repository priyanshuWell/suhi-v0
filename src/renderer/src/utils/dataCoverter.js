export function mapLegsPayloadToBIAMeasurement({
    payload,
    sessionId,
    userId,
    gender,
    heightCm,
    ageYears,
    weightKg
}) {
    const body = payload?.bodyComposition || {}
    const evaluation = payload?.evaluation || {}
    const exercise = payload?.exerciseConsumptionKcal || {}

    return {
        // Required fields
        session_id: sessionId,
        user_id: userId,
        gender,
        height_cm: heightCm,
        age_years: ageYears,
        weight_kg: weightKg,

        // ----- BODY COMPOSITION -----
        moisture_content_kg: body.waterPercentage ?? null,
        protein_mass_kg: body.proteinPercentage ?? null,
        muscle_mass_kg: body.muscleMassKg ?? null,
        skeletal_muscle_mass_kg: body.skeletalMuscleMassKg ?? null,
        bone_mass_kg: body.boneMassKg ?? null,
        body_fat_mass_kg: body.fatMassKg ?? null,
        lean_body_weight_kg: body.fatFreeMassKg ?? null,
        subcutaneous_fat_mass_kg: body.subcutaneousFatMassKg ?? null,
        subcutaneous_fat_percentage: body.subcutaneousFatPercentage ?? null,
        body_fat_percentage: body.fatPercentage ?? null,
        visceral_fat_level: body.visceralFatLevel ?? null,

        // ----- EVALUATION -----
        body_score: evaluation.bodyScore ?? null,
        physical_age_years: evaluation.bodyAge ?? null,
        ideal_weight_kg: evaluation.idealWeightKg ?? null,
        bmi: evaluation.bmi ?? null,
        basal_metabolism_kcal: evaluation.bmrKcal ?? null,

        // ----- EXERCISE KCAL -----
        walk_kcal_per_30min: exercise.walk ?? null,
        golf_kcal_per_30min: exercise.golf ?? null,
        croquet_kcal_per_30min: exercise.croquet ?? null,
        tennis_cycling_basketball_kcal_per_30min: exercise.tennis ?? null,
        squash_bouncy_ball_taekwondo_fencing_kcal_per_30min: exercise.squash ?? null,
        climb_mountains_kcal_per_30min: exercise.mountainClimbing ?? null,
        swimming_aerobics_jogging_football_skipping_rope_kcal_per_30min: exercise.swimming ?? null,
        badminton_table_tennis_kcal_per_30min: exercise.badminton ?? null
    }
}

export function mapArmsPayloadToBIAMeasurement({
    payload,
    sessionId,
    userId,
    gender,
    heightCm,
    ageYears,
    weightKg
}) {
    const body = payload?.bodyComposition || {}
    const evaluation = payload?.evaluation || {}
    const exercise = payload?.exerciseConsumptionKcal || {}

    return {
        // ---- REQUIRED ----
        session_id: sessionId,
        user_id: userId,
        gender,
        height_cm: heightCm,
        age_years: ageYears,
        weight_kg: weightKg,

        // ---- BODY COMPOSITION ----
        moisture_content_kg: body.waterPercentage ?? null,
        protein_mass_kg: body.proteinPercentage ?? null,
        muscle_mass_kg: body.muscleMassKg ?? null,
        skeletal_muscle_mass_kg: body.skeletalMuscleMassKg ?? null,
        bone_mass_kg: body.boneMassKg ?? null,
        body_fat_mass_kg: body.fatMassKg ?? null,
        lean_body_weight_kg: body.fatFreeMassKg ?? null,
        subcutaneous_fat_mass_kg: body.subcutaneousFatMassKg ?? null,
        subcutaneous_fat_percentage: body.subcutaneousFatPercentage ?? null,
        body_fat_percentage: body.fatPercentage ?? null,
        visceral_fat_level: body.visceralFatLevel ?? null,

        // ---- EVALUATION ----
        body_score: evaluation.bodyScore ?? null,
        physical_age_years: evaluation.bodyAge ?? null,
        ideal_weight_kg: evaluation.idealWeightKg ?? null,
        bmi: evaluation.bmi ?? null,
        basal_metabolism_kcal: evaluation.bmrKcal ?? null,

        // ---- EXERCISE KCAL ----
        walk_kcal_per_30min: exercise.walk ?? null,
        golf_kcal_per_30min: exercise.golf ?? null,
        croquet_kcal_per_30min: exercise.croquet ?? null,
        tennis_cycling_basketball_kcal_per_30min: exercise.tennis ?? null,
        squash_bouncy_ball_taekwondo_fencing_kcal_per_30min: exercise.squash ?? null,
        climb_mountains_kcal_per_30min: exercise.mountainClimbing ?? null,
        swimming_aerobics_jogging_football_skipping_rope_kcal_per_30min: exercise.swimming ?? null,
        badminton_table_tennis_kcal_per_30min: exercise.badminton ?? null
    }
}
