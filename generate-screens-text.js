const fs = require("fs")
const path = require("path")

const rows = [
    ["Screen Name", "Route", "Component File", "Text Key / ID", "Text Content (EN)", "Type"],

    // Splash Screen
    ["Splash Screen", "/", "SplashScreen.jsx", "-", "(No text — video only)", "hardcoded"],

    // Welcome Screen
    ["Welcome", "/welcome", "StartScreen.jsx", "common.start", "Start", "i18n"],

    // Video Capture
    [
        "Video Capture",
        "/capture",
        "VideoCaptureScreen.jsx",
        "-",
        "Look at the top Camera",
        "hardcoded"
    ],
    [
        "Video Capture",
        "/capture",
        "VideoCaptureScreen.jsx",
        "videoCapture.error_unregistered_title",
        "face Not Registered",
        "i18n"
    ],
    [
        "Video Capture",
        "/capture",
        "VideoCaptureScreen.jsx",
        "videoCapture.error_unrecognized_title",
        "Face Not Recognized",
        "i18n"
    ],
    [
        "Video Capture",
        "/capture",
        "VideoCaptureScreen.jsx",
        "videoCapture.error_unregistered_desc",
        "User is not registered in the system. Redirecting to manual login...",
        "i18n"
    ],
    [
        "Video Capture",
        "/capture",
        "VideoCaptureScreen.jsx",
        "videoCapture.error_unrecognized_retry_desc",
        "No face detected OR Multiple faces detected. Retrying......",
        "i18n"
    ],
    [
        "Video Capture",
        "/capture",
        "VideoCaptureScreen.jsx",
        "videoCapture.error_unrecognized_max_desc",
        "Maximum attempts reached. Returning to login screen...",
        "i18n"
    ],

    // Register Card
    ["Register Card", "/verified", "RegisterCard.jsx", "profile.name", "Name", "i18n"],
    ["Register Card", "/verified", "RegisterCard.jsx", "profile.class", "Class", "i18n"],
    ["Register Card", "/verified", "RegisterCard.jsx", "profile.age", "Age", "i18n"],
    ["Register Card", "/verified", "RegisterCard.jsx", "profile.number", "Mobile Number", "i18n"],
    ["Register Card", "/verified", "RegisterCard.jsx", "common.yes_me", "Yes, it's me", "i18n"],
    ["Register Card", "/verified", "RegisterCard.jsx", "common.not_me", "Not You?", "i18n"],

    // BIA Measurement
    [
        "BIA Measurement",
        "/bia/:screenType",
        "bia/BIACalcuate.jsx",
        "measurement.let_measure",
        "Height and Weight and Measurement",
        "i18n"
    ],
    [
        "BIA Measurement",
        "/bia/:screenType",
        "bia/BIACalcuate.jsx",
        "measurement.good_job",
        "Good Job!",
        "i18n"
    ],
    [
        "BIA Measurement",
        "/bia/:screenType",
        "bia/BIACalcuate.jsx",
        "measurement.standStill",
        "Stand straight and still on the platform, facing forward.",
        "i18n"
    ],
    [
        "BIA Measurement",
        "/bia/:screenType",
        "bia/BIACalcuate.jsx",
        "measurement.holdThe_Hands",
        "Hold the two handles and keep your elbows straight and relaxed.",
        "i18n"
    ],
    [
        "BIA Measurement",
        "/bia/:screenType",
        "bia/BIACalcuate.jsx",
        "measurement.weight",
        "Weight",
        "i18n"
    ],
    [
        "BIA Measurement",
        "/bia/:screenType",
        "bia/BIACalcuate.jsx",
        "measurement.height",
        "Height",
        "i18n"
    ],
    [
        "BIA Measurement",
        "/bia/:screenType",
        "bia/BIACalcuate.jsx",
        "-",
        "Please step on the platform barefoot",
        "hardcoded"
    ],
    [
        "BIA Measurement",
        "/bia/:screenType",
        "bia/BIACalcuate.jsx",
        "-",
        "Please make sure you are barefoot",
        "hardcoded"
    ],
    [
        "BIA Measurement",
        "/bia/:screenType",
        "bia/BIACalcuate.jsx",
        "-",
        "Please stand straight & still",
        "hardcoded"
    ],
    [
        "BIA Measurement",
        "/bia/:screenType",
        "bia/BIACalcuate.jsx",
        "-",
        "Please be barefoot and hold the rods firmly",
        "hardcoded"
    ],
    [
        "BIA Measurement",
        "/bia/:screenType",
        "bia/BIACalcuate.jsx",
        "-",
        "Maximum retries reached. redirecting to dmit.",
        "hardcoded"
    ],
    [
        "BIA Measurement",
        "/bia/:screenType",
        "bia/BIACalcuate.jsx",
        "-",
        "Height port is not connected",
        "hardcoded"
    ],
    [
        "BIA Measurement",
        "/bia/:screenType",
        "bia/BIACalcuate.jsx",
        "-",
        "Preparing camera...",
        "hardcoded"
    ],
    [
        "BIA Measurement",
        "/bia/:screenType",
        "bia/BIACalcuate.jsx",
        "-",
        "Recording 5 seconds...",
        "hardcoded"
    ],
    [
        "BIA Measurement",
        "/bia/:screenType",
        "bia/BIACalcuate.jsx",
        "-",
        "Hand registered ✓",
        "hardcoded"
    ],
    [
        "BIA Measurement",
        "/bia/:screenType",
        "bia/BIACalcuate.jsx",
        "-",
        "All 4 buffers captured successfully ✅",
        "hardcoded"
    ],

    // BIA Result
    [
        "BIA Result",
        "/bia/result",
        "bia/BIAResult.jsx",
        "bia_result.congratulations",
        "Congratulations!",
        "i18n"
    ],
    [
        "BIA Result",
        "/bia/result",
        "bia/BIAResult.jsx",
        "bia_result.here_are_results",
        "Here are your results",
        "i18n"
    ],
    ["BIA Result", "/bia/result", "bia/BIAResult.jsx", "bia_result.weight", "Weight (kg)", "i18n"],
    ["BIA Result", "/bia/result", "bia/BIAResult.jsx", "bia_result.height", "Height (cm)", "i18n"],
    [
        "BIA Result",
        "/bia/result",
        "bia/BIAResult.jsx",
        "bia_result.body_constitution",
        "Body Constitution",
        "i18n"
    ],
    ["BIA Result", "/bia/result", "bia/BIAResult.jsx", "bia_result.vata", "Vata", "i18n"],
    ["BIA Result", "/bia/result", "bia/BIAResult.jsx", "bia_result.pitta", "Pitta", "i18n"],
    ["BIA Result", "/bia/result", "bia/BIAResult.jsx", "bia_result.kapha", "Kapha", "i18n"],
    ["BIA Result", "/bia/result", "bia/BIAResult.jsx", "bia_result.hydration", "Hydration", "i18n"],
    [
        "BIA Result",
        "/bia/result",
        "bia/BIAResult.jsx",
        "bia_result.hydration_low_message",
        "How about having a glass of water after this?",
        "i18n"
    ],
    [
        "BIA Result",
        "/bia/result",
        "bia/BIAResult.jsx",
        "bia_result.study_tip_default",
        "When studying your ears are your hero",
        "i18n"
    ],
    [
        "BIA Result",
        "/bia/result",
        "bia/BIAResult.jsx",
        "bia_result.go_to_homepage",
        "Go to homepage",
        "i18n"
    ],

    // DMIT Hand Scan
    ["DMIT Hand Scan", "/screen1", "dmit/NewDmit.jsx", "-", "Left Hand - Front", "hardcoded"],
    ["DMIT Hand Scan", "/screen1", "dmit/NewDmit.jsx", "-", "Left Hand - Back", "hardcoded"],
    ["DMIT Hand Scan", "/screen1", "dmit/NewDmit.jsx", "-", "Right Hand - Front", "hardcoded"],
    ["DMIT Hand Scan", "/screen1", "dmit/NewDmit.jsx", "-", "Right Hand - Back", "hardcoded"],
    ["DMIT Hand Scan", "/screen1", "dmit/NewDmit.jsx", "-", "Preparing camera...", "hardcoded"],
    ["DMIT Hand Scan", "/screen1", "dmit/NewDmit.jsx", "-", "Opening camera...", "hardcoded"],
    ["DMIT Hand Scan", "/screen1", "dmit/NewDmit.jsx", "-", "Camera ready ✅", "hardcoded"],
    ["DMIT Hand Scan", "/screen1", "dmit/NewDmit.jsx", "-", "Recording 5 seconds...", "hardcoded"],
    ["DMIT Hand Scan", "/screen1", "dmit/NewDmit.jsx", "-", "Storing buffer...", "hardcoded"],
    ["DMIT Hand Scan", "/screen1", "dmit/NewDmit.jsx", "-", "Uploading buffer...", "hardcoded"],
    ["DMIT Hand Scan", "/screen1", "dmit/NewDmit.jsx", "-", "Registering hand...", "hardcoded"],
    ["DMIT Hand Scan", "/screen1", "dmit/NewDmit.jsx", "-", "Hand registered ✓", "hardcoded"],
    [
        "DMIT Hand Scan",
        "/screen1",
        "dmit/NewDmit.jsx",
        "-",
        "Success ✅ moving next...",
        "hardcoded"
    ],
    [
        "DMIT Hand Scan",
        "/screen1",
        "dmit/NewDmit.jsx",
        "-",
        "All hands completed ✓ Redirecting...",
        "hardcoded"
    ],
    [
        "DMIT Hand Scan",
        "/screen1",
        "dmit/NewDmit.jsx",
        "-",
        "All 4 buffers captured successfully ✅",
        "hardcoded"
    ],
    [
        "DMIT Hand Scan",
        "/screen1",
        "dmit/NewDmit.jsx",
        "-",
        "Error occurred. Retrying...",
        "hardcoded"
    ],
    ["DMIT Hand Scan", "/screen1", "dmit/NewDmit.jsx", "-", "Failed to open camera", "hardcoded"],

    // Voice Analysis
    [
        "Voice Analysis",
        "/voice",
        "voice/VoiceAnalysis.jsx",
        "voice.instruction",
        "Look at the image, notice what it makes you feel or think, then click Start and speak freely for 30 seconds.",
        "i18n"
    ],
    ["Voice Analysis", "/voice", "voice/VoiceAnalysis.jsx", "voice.start", "Start", "i18n"],
    ["Voice Analysis", "/voice", "voice/VoiceAnalysis.jsx", "voice.status.idle", "idle", "i18n"],
    [
        "Voice Analysis",
        "/voice",
        "voice/VoiceAnalysis.jsx",
        "voice.status.recording",
        "recording",
        "i18n"
    ],
    [
        "Voice Analysis",
        "/voice",
        "voice/VoiceAnalysis.jsx",
        "voice.status.processing",
        "processing",
        "i18n"
    ],
    [
        "Voice Analysis",
        "/voice",
        "voice/VoiceAnalysis.jsx",
        "voice.status.success",
        "success",
        "i18n"
    ],
    ["Voice Analysis", "/voice", "voice/VoiceAnalysis.jsx", "voice.status.error", "error", "i18n"],

    // Color Blindness Intro
    [
        "Color Blindness Intro",
        "/colorblindness",
        "color-blindness/ColorBlindPlate.jsx",
        "colorBlindness.title",
        "Color Blindness Test",
        "i18n"
    ],
    [
        "Color Blindness Intro",
        "/colorblindness",
        "color-blindness/ColorBlindPlate.jsx",
        "colorBlindness.instructions_line1",
        "You have to click the number/shape for each image.",
        "i18n"
    ],
    [
        "Color Blindness Intro",
        "/colorblindness",
        "color-blindness/ColorBlindPlate.jsx",
        "colorBlindness.instructions_line2",
        "If you don't see anything just click on Cannot read plate.",
        "i18n"
    ],
    [
        "Color Blindness Intro",
        "/colorblindness",
        "color-blindness/ColorBlindPlate.jsx",
        "colorBlindness.instructions_line3",
        "There will be 14 plates.",
        "i18n"
    ],
    [
        "Color Blindness Intro",
        "/colorblindness",
        "color-blindness/ColorBlindPlate.jsx",
        "colorBlindness.instructions_example",
        "Example: This Number is 6. Click on next button to start!",
        "i18n"
    ],
    [
        "Color Blindness Intro",
        "/colorblindness",
        "color-blindness/ColorBlindPlate.jsx",
        "colorBlindness.next",
        "Next",
        "i18n"
    ],

    // Color Blindness Quiz
    [
        "Color Blindness Quiz",
        "/colorblindness/quiz",
        "color-blindness/ColorBlindQuiz.jsx",
        "-",
        "Image {current} of {total}",
        "hardcoded"
    ],
    [
        "Color Blindness Quiz",
        "/colorblindness/quiz",
        "color-blindness/ColorBlindQuiz.jsx",
        "-",
        "Answer options: 12, 8, 5, 29, 74, 7, 45, 2, 16, Line, 35, 96, Two Lines, No number (across 14 plates)",
        "hardcoded"
    ],

    // Login Suhi
    [
        "Login Suhi",
        "/login-suhi",
        "forms/LoginSuhi.jsx",
        "-",
        "Log in using your ID or fingerprint",
        "hardcoded"
    ],
    ["Login Suhi", "/login-suhi", "forms/LoginSuhi.jsx", "-", "Suhi ID *", "hardcoded"],
    ["Login Suhi", "/login-suhi", "forms/LoginSuhi.jsx", "-", "DPKS (ID prefix)", "hardcoded"],
    ["Login Suhi", "/login-suhi", "forms/LoginSuhi.jsx", "-", "Or", "hardcoded"],
    [
        "Login Suhi",
        "/login-suhi",
        "forms/LoginSuhi.jsx",
        "-",
        "Place your thumb on the fingerprint scanner below the screen.",
        "hardcoded"
    ],
    ["Login Suhi", "/login-suhi", "forms/LoginSuhi.jsx", "-", "Next", "hardcoded"],
    [
        "Login Suhi",
        "/login-suhi",
        "forms/LoginSuhi.jsx",
        "-",
        "Verifying... (loading state)",
        "hardcoded"
    ],
    [
        "Login Suhi",
        "/login-suhi",
        "forms/LoginSuhi.jsx",
        "-",
        "Login Failed (error title)",
        "hardcoded"
    ],

    // Login DOB
    [
        "Login DOB",
        "/login-dob",
        "forms/LoginDOB.jsx",
        "-",
        "Log in via your name and date of birth",
        "hardcoded"
    ],
    ["Login DOB", "/login-dob", "forms/LoginDOB.jsx", "-", "Suhi ID *", "hardcoded"],
    ["Login DOB", "/login-dob", "forms/LoginDOB.jsx", "-", "Date Of Birth *", "hardcoded"],
    [
        "Login DOB",
        "/login-dob",
        "forms/LoginDOB.jsx",
        "-",
        "Enter Your Suhi ID (placeholder)",
        "hardcoded"
    ],
    ["Login DOB", "/login-dob", "forms/LoginDOB.jsx", "-", "DD/MM/YY (placeholder)", "hardcoded"],
    ["Login DOB", "/login-dob", "forms/LoginDOB.jsx", "-", "Next", "hardcoded"],

    // Login Father
    [
        "Login Father",
        "/login-father",
        "forms/LoginFather.jsx",
        "-",
        "Log in via Father's name and phone number",
        "hardcoded"
    ],
    ["Login Father", "/login-father", "forms/LoginFather.jsx", "-", "Father's name *", "hardcoded"],
    [
        "Login Father",
        "/login-father",
        "forms/LoginFather.jsx",
        "-",
        "Registered Mobile number *",
        "hardcoded"
    ],
    [
        "Login Father",
        "/login-father",
        "forms/LoginFather.jsx",
        "-",
        "+91 (phone prefix)",
        "hardcoded"
    ],
    [
        "Login Father",
        "/login-father",
        "forms/LoginFather.jsx",
        "-",
        "Enter Your Father's name (placeholder)",
        "hardcoded"
    ],
    [
        "Login Father",
        "/login-father",
        "forms/LoginFather.jsx",
        "-",
        "Enter number (placeholder)",
        "hardcoded"
    ],
    ["Login Father", "/login-father", "forms/LoginFather.jsx", "-", "Next", "hardcoded"],

    // Fingerprint
    [
        "Fingerprint",
        "/fingerprint",
        "forms/FingerPrintScreen.jsx",
        "-",
        "Log in using fingerprint",
        "hardcoded"
    ],
    [
        "Fingerprint",
        "/fingerprint",
        "forms/FingerPrintScreen.jsx",
        "-",
        "Place your thumb on the fingerprint scanner below the screen.",
        "hardcoded"
    ]
]

function escapeCSV(val) {
    const str = String(val)
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return '"' + str.replace(/"/g, '""') + '"'
    }
    return str
}

const csv = rows.map((row) => row.map(escapeCSV).join(",")).join("\n")
const outPath = path.join(__dirname, "screens-text.csv")
fs.writeFileSync(outPath, csv, "utf8")
console.log(`✅ CSV written to: ${outPath}`)
console.log(
    `   ${rows.length - 1} text entries across ${new Set(rows.slice(1).map((r) => r[0])).size} screens`
)
