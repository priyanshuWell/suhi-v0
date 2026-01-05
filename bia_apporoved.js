
import {SerialPort} from 'serialport'
import  readline from 'readline';
export let serialPort = null;
export let heightPort = null;
export let biaPort = null;
export let heightWaitingForResponse = false;
export let heightResponseTimeout = null;
export const IS_ELECTRON = true;
// Create readline interface for CLI
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const FREQUENCIES = {
    FIVE_KHZ: 0x01,
    TEN_KHZ: 0x02,
    TWENTY_KHZ: 0x03,
    TWENTY_FIVE_KHZ: 0x04,
    FIFTY_KHZ: 0x05,
    HUNDRED_KHZ: 0x06,
    TWO_HUNDRED_KHZ: 0x07,
    TWO_FIFTY_KHZ: 0x08,
    FIVE_HUNDRED_KHZ: 0x09
};

const IMPEDANCE_MODES = {
    STOP_TEST: 0x00,
    EIGHT_ELECTRODE_SINGLE: 0x01,
    FOUR_ELECTRODE_LEGS: 0x02,
    FOUR_ELECTRODE_ARMS: 0x03,
    EIGHT_ELECTRODE_DUAL: 0x04
};

// ======================== HEIGHT MEASUREMENT ========================
const STABILITY_COUNT = 10;
const STABILITY_THRESHOLD = 2;
export let stableReadings = [];
export let isMeasurementStopped = false;
let heightBuffer = Buffer.alloc(0);
let impedance20kHzResults = null;
let impedance100kHzResults = null;
export let finalweight = null;
export let finalheight = null;

export const READ_CMD = Buffer.from([0x55, 0xaa, 0x01, 0x01, 0x01]);

export function verifyChecksum(frame) {
    let sum = 0;
    for (let i = 0; i < 6; i++) sum += frame[i];
    return (sum & 0xff) === frame[6];
}

export function parseDistance(frame) {
    return (frame[4] << 8) + frame[5];
}

export function checkStability(value) {
    stableReadings.push(value);

    if (stableReadings.length > STABILITY_COUNT) {
        stableReadings.shift();
    }

    const max = Math.max(...stableReadings);
    const min = Math.min(...stableReadings);

    return max - min <= STABILITY_THRESHOLD;
}

export function collectBodyCompositionOnce(timeout = 8000) {
  return new Promise((resolve, reject) => {
    let packages = {};
    let expectedTotal = null;

    const timer = setTimeout(() => {
      biaPort.off("data", onData);
      reject(new Error("BIA response timeout"));
    }, timeout);

    const onData = (data) => {
      if (data[0] !== 0xAA || data[2] !== 0xD0) return;

      const parsed = parseBodyCompositionResponse(data);
      if (!parsed) return;

      packages[parsed.currentPackage] = parsed.data;
      expectedTotal = parsed.totalPackages;

      if (Object.keys(packages).length === expectedTotal) {
        clearTimeout(timer);
        biaPort.off("data", onData);

        const ordered = {};
        for (let i = 1; i <= expectedTotal; i++) {
          ordered[`package${i}`] = packages[i];
        }

        resolve(ordered);
      }
    };

    biaPort.on("data", onData);
  });
}


// ======================== BIA FUNCTIONS ========================
// Calculate checksum for BMH05108 protocol
export function calculateChecksum(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i];
    }
    // Checksum = ~(sum) + 1 (two's complement)
    return (~sum + 1) & 0xFF;
}
export function calculateChecksum1(frameData) {
    let sum = frameData.reduce((acc, byte) => acc + byte, 0);
    return ~sum + 1 & 0xFF;
}

// Create BMH05108 command packet
export function createCommand(commandByte, dataBytes = []) {
    const frameLength = 4 + dataBytes.length;
    const buffer = Buffer.alloc(frameLength);

    buffer[0] = 0x55;
    buffer[1] = frameLength;
    buffer[2] = commandByte;

    for (let i = 0; i < dataBytes.length; i++) {
        buffer[3 + i] = dataBytes[i];
    }

    const checksumData = buffer.slice(0, frameLength - 1);
    buffer[frameLength - 1] = calculateChecksum(checksumData);

    return buffer;
}

// Create 8-electrode body composition command (0xD0)
export function create8ElectrodeBodyCompositionCommand(gender, height, age, weight,
    rh20, lh20, tr20, rf20, lf20, rh100, lh100, tr100, rf100, lf100) {

    const buffer = Buffer.alloc(39);

    buffer[0] = 0x55;
    buffer[1] = 0x27;
    buffer[2] = 0xD0;
    buffer[3] = gender & 0xFF;
    buffer[4] = 0x00;
    buffer[5] = height & 0xFF;
    buffer[6] = age & 0xFF;

    const weightInt = Math.round(weight * 10);
    buffer.writeUInt16LE(weightInt, 7);

    buffer.writeUInt16LE(Math.round(rh20 * 10), 9);
    buffer.writeUInt16LE(Math.round(lh20 * 10), 11);
    buffer.writeUInt16LE(Math.round(tr20 * 10), 13);
    buffer.writeUInt16LE(Math.round(rf20 * 10), 15);
    buffer.writeUInt16LE(Math.round(lf20 * 10), 17);

    buffer.writeUInt16LE(Math.round(rh100 * 10), 19);
    buffer.writeUInt16LE(Math.round(lh100 * 10), 21);
    buffer.writeUInt16LE(Math.round(tr100 * 10), 23);
    buffer.writeUInt16LE(Math.round(rf100 * 10), 25);
    buffer.writeUInt16LE(Math.round(lf100 * 10), 27);

    for (let i = 29; i < 38; i++) {
        buffer[i] = 0x00;
    }

    const checksumData = buffer.slice(0, 38);
    buffer[38] = calculateChecksum(checksumData);

    return buffer;
}


// Get available serial ports
export async  function getPorts() {
    try {
        const ports = await SerialPort.list();
        
        console.log('\n Available Serial Ports:');
        console.log('========================');
        if (ports.length === 0) {
            console.log('No serial ports found!');
        } else {
            ports.forEach((port, index) => {
                console.log(`${index + 1}. ${port.path}`);
                if (port.manufacturer) console.log(`   Manufacturer: ${port.manufacturer}`);
                if (port.serialNumber) console.log(`   Serial Number: ${port.serialNumber}`);
                console.log('');
            });
        }
        return ports;
    } catch (error) {
        console.error(' Error listing ports:', error.message);
        return [];
    }
}


export function parseBodyCompositionResponse(data) {

    console.log('Parsing Body Composition Response:');
    console.log(`Full Response Length: ${data.length}`);
    console.log(`First Byte: 0x${data[0].toString(16).toUpperCase()}`);
    console.log(`Second Byte: 0x${data[1].toString(16).toUpperCase()}`);
    console.log(`Third Byte: 0x${data[2].toString(16).toUpperCase()}`);
    console.log(`Fourth Byte: 0x${data[3].toString(16).toUpperCase()}`);
    // Validate response
    if (data[0] !== 0xAA || data[2] !== 0xD0) {
        console.log('❌ Invalid body composition response');
        return null;
    }


    const parsePackages = {
        // Package 1: Whole Body Composition (page 15-16)
        1: (data) => ({
            bodyWeight: ((data[5] & 0xFF) | ((data[6] & 0xFF) << 8)) / 10,
            bodyWeightStandardMin: ((data[7] & 0xFF) | ((data[8] & 0xFF) << 8)) / 10,
            bodyWeightStandardMax: ((data[9] & 0xFF) | ((data[10] & 0xFF) << 8)) / 10,

            moistureContent: ((data[11] & 0xFF) | ((data[12] & 0xFF) << 8)) / 10,
            moistureContentStandardMin: ((data[13] & 0xFF) | ((data[14] & 0xFF) << 8)) / 10,
            moistureContentStandardMax: ((data[15] & 0xFF) | ((data[16] & 0xFF) << 8)) / 10,

            bodyFatMass: ((data[17] & 0xFF) | ((data[18] & 0xFF) << 8)) / 10,
            bodyFatMassStandardMin: ((data[19] & 0xFF) | ((data[20] & 0xFF) << 8)) / 10,
            bodyFatMassStandardMax: ((data[21] & 0xFF) | ((data[22] & 0xFF) << 8)) / 10,

            proteinMass: ((data[23] & 0xFF) | ((data[24] & 0xFF) << 8)) / 10,
            proteinMassStandardMin: ((data[25] & 0xFF) | ((data[26] & 0xFF) << 8)) / 10,
            proteinMassStandardMax: ((data[27] & 0xFF) | ((data[28] & 0xFF) << 8)) / 10,

            inorganicSaltMass: ((data[29] & 0xFF) | ((data[30] & 0xFF) << 8)) / 10,
            inorganicSaltMassStandardMin: ((data[31] & 0xFF) | ((data[32] & 0xFF) << 8)) / 10,
            inorganicSaltMassStandardMax: ((data[33] & 0xFF) | ((data[34] & 0xFF) << 8)) / 10,

            leanBodyWeight: ((data[35] & 0xFF) | ((data[36] & 0xFF) << 8)) / 10,
            leanBodyWeightStandardMin: ((data[37] & 0xFF) | ((data[38] & 0xFF) << 8)) / 10,
            leanBodyWeightStandardMax: ((data[39] & 0xFF) | ((data[40] & 0xFF) << 8)) / 10,

            muscleMass: ((data[41] & 0xFF) | ((data[42] & 0xFF) << 8)) / 10,
            muscleMassStandardMin: ((data[43] & 0xFF) | ((data[44] & 0xFF) << 8)) / 10,
            muscleMassStandardMax: ((data[45] & 0xFF) | ((data[46] & 0xFF) << 8)) / 10,

            boneMass: ((data[47] & 0xFF) | ((data[48] & 0xFF) << 8)) / 10,
            boneMassStandardMin: ((data[49] & 0xFF) | ((data[50] & 0xFF) << 8)) / 10,
            boneMassStandardMax: ((data[51] & 0xFF) | ((data[52] & 0xFF) << 8)) / 10,

            skeletalMuscleMass: ((data[53] & 0xFF) | ((data[54] & 0xFF) << 8)) / 10,
            skeletalMuscleMassStandardMin: ((data[55] & 0xFF) | ((data[56] & 0xFF) << 8)) / 10,
            skeletalMuscleMassStandardMax: ((data[57] & 0xFF) | ((data[58] & 0xFF) << 8)) / 10,

            subcutaneousFatMass: ((data[77] & 0xFF) | ((data[78] & 0xFF) << 8)) / 10
        }),

        // Package 2: Segmental Fat and Muscle Information (page 17-18)
        2: (data) => ({
            segmentalFatMass: {
                rightHand: ((data[5] & 0xFF) | ((data[6] & 0xFF) << 8)) / 10,
                leftHand: ((data[7] & 0xFF) | ((data[8] & 0xFF) << 8)) / 10,
                trunk: ((data[9] & 0xFF) | ((data[10] & 0xFF) << 8)) / 10,
                rightFoot: ((data[11] & 0xFF) | ((data[12] & 0xFF) << 8)) / 10,
                leftFoot: ((data[13] & 0xFF) | ((data[14] & 0xFF) << 8)) / 10
            },
            segmentalFatPercentage: {
                rightHand: ((data[15] & 0xFF) | ((data[16] & 0xFF) << 8)) / 10,
                leftHand: ((data[17] & 0xFF) | ((data[18] & 0xFF) << 8)) / 10,
                trunk: ((data[19] & 0xFF) | ((data[20] & 0xFF) << 8)) / 10,
                rightFoot: ((data[21] & 0xFF) | ((data[22] & 0xFF) << 8)) / 10,
                leftFoot: ((data[23] & 0xFF) | ((data[24] & 0xFF) << 8)) / 10
            },
            segmentalMuscleMass: {
                rightHand: ((data[25] & 0xFF) | ((data[26] & 0xFF) << 8)) / 10,
                leftHand: ((data[27] & 0xFF) | ((data[28] & 0xFF) << 8)) / 10,
                trunk: ((data[29] & 0xFF) | ((data[30] & 0xFF) << 8)) / 10,
                rightFoot: ((data[31] & 0xFF) | ((data[32] & 0xFF) << 8)) / 10,
                leftFoot: ((data[33] & 0xFF) | ((data[34] & 0xFF) << 8)) / 10
            }
        }),

        // Package 3: Evaluation Suggestions (page 19-20)
        3: (data) => ({
            bodyScore: data[5],
            physicalAge: data[6],
            bodyType: data[7],
            skeletalMuscleMassIndex: data[8],

            waistToHipRatio: data[9] / 100,
            waistToHipRatioStandardMin: data[10] / 100,
            waistToHipRatioStandardMax: data[11] / 100,

            visceralFatLevel: data[12],
            visceralFatLevelStandardMin: data[13],
            visceralFatLevelStandardMax: data[14],

            obesityPercentage: ((data[15] & 0xFF) | ((data[16] & 0xFF) << 8)) / 10,
            obesityPercentageStandardMin: ((data[17] & 0xFF) | ((data[18] & 0xFF) << 8)) / 10,
            obesityPercentageStandardMax: ((data[19] & 0xFF) | ((data[20] & 0xFF) << 8)) / 10,

            bodyMassIndex: ((data[21] & 0xFF) | ((data[22] & 0xFF) << 8)) / 10,
            bodyMassIndexStandardMin: ((data[23] & 0xFF) | ((data[24] & 0xFF) << 8)) / 10,
            bodyMassIndexStandardMax: ((data[25] & 0xFF) | ((data[26] & 0xFF) << 8)) / 10,

            bodyFatPercentage: ((data[27] & 0xFF) | ((data[28] & 0xFF) << 8)) / 10,
            bodyFatPercentageStandardMin: ((data[29] & 0xFF) | ((data[30] & 0xFF) << 8)) / 10,
            bodyFatPercentageStandardMax: ((data[31] & 0xFF) | ((data[32] & 0xFF) << 8)) / 10,

            basalMetabolism: ((data[33] & 0xFF) | ((data[34] & 0xFF) << 8)),
            basalMetabolismStandardMin: ((data[35] & 0xFF) | ((data[36] & 0xFF) << 8)),
            basalMetabolismStandardMax: ((data[37] & 0xFF) | ((data[38] & 0xFF) << 8)),

            recommendedIntake: ((data[39] & 0xFF) | ((data[40] & 0xFF) << 8)),
            idealWeight: ((data[41] & 0xFF) | ((data[42] & 0xFF) << 8)) / 10,
            targetWeight: ((data[43] & 0xFF) | ((data[44] & 0xFF) << 8)) / 10,

            weightControlAmount: ((data[45] & 0xFF) | ((data[46] & 0xFF) << 8)) / 10,
            muscleControlAmount: ((data[47] & 0xFF) | ((data[48] & 0xFF) << 8)) / 10,
            fatControlAmount: ((data[49] & 0xFF) | ((data[50] & 0xFF) << 8)) / 10,

            subcutaneousFatPercentage: ((data[51] & 0xFF) | ((data[52] & 0xFF) << 8)) / 10,
            subcutaneousFatPercentageStandardMin: ((data[53] & 0xFF) | ((data[54] & 0xFF) << 8)) / 10,
            subcutaneousFatPercentageStandardMax: ((data[55] & 0xFF) | ((data[56] & 0xFF) << 8)) / 10
        }),

        // Package 4: Exercise Consumption (page 21)
        4: (data) => ({
            exerciseConsumption: {
                walk: ((data[5] & 0xFF) | ((data[6] & 0xFF) << 8)),
                golf: ((data[7] & 0xFF) | ((data[8] & 0xFF) << 8)),
                croquet: ((data[9] & 0xFF) | ((data[10] & 0xFF) << 8)),
                tennis: ((data[11] & 0xFF) | ((data[12] & 0xFF) << 8)),
                squash: ((data[13] & 0xFF) | ((data[14] & 0xFF) << 8)),
                mountainClimbing: ((data[15] & 0xFF) | ((data[16] & 0xFF) << 8)),
                swimming: ((data[17] & 0xFF) | ((data[18] & 0xFF) << 8)),
                badminton: ((data[19] & 0xFF) | ((data[20] & 0xFF) << 8))
            }
        }),

        // Package 5: Segment Standards (page 22)
        5: (data) => ({
            segmentalFatStandards: {
                rightHand: data[5],
                leftHand: data[6],
                trunk: data[7],
                rightFoot: data[8],
                leftFoot: data[9]
            },
            segmentalMuscleStandards: {
                rightHand: data[10],
                leftHand: data[11],
                trunk: data[12],
                rightFoot: data[13],
                leftFoot: data[14]
            }
        })
    };

    // Determine package number
    const packageNumber = data[3];
    const totalPackages = (packageNumber >> 4) & 0x0F;
    const currentPackage = packageNumber & 0x0F;

    console.log(`Total Packages: ${totalPackages}, Current Package: ${currentPackage}`);

    // Parse based on current package
    const packageParser = parsePackages[currentPackage];

    if (packageParser) {
        return {
            totalPackages,
            currentPackage,
            data: packageParser(data)
        };
    }

    return null;
}

let bodyCompositionPackages = {};
let totalPackages = 0;

export function processBodyCompositionResponse(data) {
    const parsedData = parseBodyCompositionResponse(data);

    if (parsedData) {
        // Store the package
        bodyCompositionPackages[parsedData.currentPackage] = parsedData.data;
        totalPackages = parsedData.totalPackages;

        console.log(`\n📦 Body Composition Package ${parsedData.currentPackage} of ${parsedData.totalPackages}`);
        console.log(JSON.stringify(parsedData.data, null, 2));

        // Check if all packages are collected
        if (Object.keys(bodyCompositionPackages).length === totalPackages) {
            console.log('\n🏁 Complete Body Composition Data:');

            // Organize packages in order
            const orderedPackages = {};
            for (let i = 1; i <= totalPackages; i++) {
                orderedPackages[`package${i}`] = bodyCompositionPackages[i];
            }

            console.log(JSON.stringify(orderedPackages, null, 2));

            // Reset for next measurement
            bodyCompositionPackages = {};
            totalPackages = 0;
        }
    }
}

export function collectBodyComposition(timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (!biaPort || !biaPort.isOpen) {
      reject(new Error("BIA port not open"));
      return;
    }

    const packages = {};
    let expectedTotal = null;
    let resolved = false;

    const cleanup = () => {
      clearTimeout(timer);
      biaPort.off("data", onData);
    };

    const timer = setTimeout(() => {
      if (resolved) return;
      cleanup();
      reject(new Error("BIA response timeout"));
    }, timeout);

    const onData = (data) => {
      try {
        if (!data || data.length < 5) return;
        if (data[0] !== 0xAA || data[2] !== 0xD0) return;

        const parsed = parseBodyCompositionResponse(data);
        if (!parsed) return;

        const { currentPackage, totalPackages, data: pkgData } = parsed;

        // Capture expected total once
        if (!expectedTotal && totalPackages) {
          expectedTotal = totalPackages;
        }

        // Ignore duplicates
        const key = `package${currentPackage}`;
        if (!packages[key]) {
          packages[key] = pkgData;
        }

        // Resolve only when ALL expected packages collected
        if (
          expectedTotal &&
          Object.keys(packages).length === expectedTotal &&
          !resolved
        ) {
          resolved = true;
          cleanup();
          resolve(packages);
        }
      } catch (err) {
        console.error("[BIA] Parse error:", err);
      }
    };

    biaPort.on("data", onData);
  });
}

export function parseImpedanceResponse(data) {
    console.log('\n🔍 DETAILED IMPEDANCE RESPONSE');

    // Validate basic response
    /*  if (data[0] !== 0xAA || data[2] !== 0xB1) {
        console.log('❌ Invalid impedance response');
        return;
      }*/
    if (data[1] !== 0xB1 || data[1] !== 0xB0) {
        console.log(' Invalid impedance response');
        return;
    }

    // Extract frequency and response type
    const responseFrequency = (data[2] >> 4) & 0x0F;
    const responseType = data[2] & 0x0F;

    console.log(`📡 Frequency: ${getFrequencyName(responseFrequency)}`);
    console.log(`📝 Response Type: ${getResponseTypeName(responseType)}`);

    // Additional status information
    const measurementStatus = data[3];
    const mode = data[4];

    console.log(`🔬 Measurement Status: 0x${measurementStatus.toString(16).toUpperCase()}`);
    console.log(`🔄 Mode: 0x${mode.toString(16).toUpperCase()}`);

    // Parsing 8-electrode response
    if (data.length >= 26) {
        console.log('\n🌐 Eight-Electrode Impedance Details:');
        const segments = [
            { name: 'Right Hand', offset: 5 },
            { name: 'Left Hand', offset: 9 },
            { name: 'Trunk', offset: 13 },
            { name: 'Right Foot', offset: 17 },
            { name: 'Left Foot', offset: 21 }
        ];

        segments.forEach(segment => {
            // Safely read 32-bit value
            const rawValue = data[segment.offset] |
                (data[segment.offset + 1] << 8) |
                (data[segment.offset + 2] << 16) |
                (data[segment.offset + 3] << 24);

            const impedanceValue = rawValue / 10;
            console.log(`   ${segment.name}: ${impedanceValue}Ω ${impedanceValue === 0 ? '❌ No contact' : '✅'}`);
        });

        // Check if all impedances are zero
        const allZero = segments.every(segment =>
            (data[segment.offset] |
                data[segment.offset + 1] |
                data[segment.offset + 2] |
                data[segment.offset + 3]) === 0
        );

        if (allZero) {
            console.log('\n⚠️  ALL IMPEDANCE VALUES ARE ZERO!');
            console.log('Possible reasons:');
            console.log('1. No electrode contact');
            console.log('2. Incorrect measurement mode');
            console.log('3. Device not in proper measurement state');
        }
    }
    // Parsing 4-electrode response
    else if (data.length >= 12) {
        console.log('\n🌐 Four-Electrode Impedance Details:');

        // Phase Angle (16-bit signed, little-endian)
        const phaseAngleRaw = data[6] | (data[7] << 8);
        const phaseAngle = phaseAngleRaw / 10;

        // Impedance (32-bit unsigned, little-endian)
        const impedanceRaw = data[8] |
            (data[9] << 8) |
            (data[10] << 16) |
            (data[11] << 24);

        console.log(`📐 Phase Angle: ${phaseAngle.toFixed(1)}°`);
        console.log(`Ω Impedance: ${impedanceRaw}Ω ${impedanceRaw === 0 ? '❌ No contact' : '✅'}`);

        // Mode interpretation for 4-electrode
        const modeNames = {
            0x00: 'Feet',
            0x01: 'Feet (Alt)',
            0x02: 'Hands',
            0x03: '8-Electrode'
        };

        console.log(`   Mode Type: ${modeNames[mode] || 'Unknown'}`);

        if (impedanceRaw === 0) {
            console.log('\n⚠️  ZERO IMPEDANCE DETECTED!');
            console.log('Possible reasons:');
            console.log('1. No electrode contact');
            console.log('2. Incorrect measurement mode');
            console.log('3. Improper electrode placement');
        }
    }
    // If response is too short
    else {
        console.log('\n⚠️ Insufficient data for impedance parsing');
        console.log(`   Received data length: ${data.length} bytes`);
    }
}



// Connect to BIA port
export async  function connectBiaPort(portPath, baudRate = 38400) {
    try {
        if (biaPort && biaPort.isOpen) {
            await new Promise((resolve) => biaPort.close(resolve));
        }

        biaPort = new SerialPort({
            path: portPath,
            baudRate: baudRate,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });

        biaPort.on('data', (data) => {
            if (heightResponseTimeout) {
                clearTimeout(heightResponseTimeout);
                heightResponseTimeout = null;
            }

            const hex = Buffer.from(data).toString('hex').toUpperCase();
            const bytes = Array.from(data).map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(', ');

            console.log(`\n${'='.repeat(60)}`);
            console.log(`BIA RESPONSE RECEIVED`);
            console.log(`${'='.repeat(60)}`);
            //  console.log(`Time: ${new Date().toLocaleTimeString()}`);
            console.log(`Length: ${data.length} bytes`);
            console.log(`Hex: ${hex}`);
            console.log(`Bytes: [${bytes}]`);


            if (data[1] === 0xB1 || data[1] === 0xB0) {

                parseImpedanceResponse(data);
            }

            // Body Composition response parsing
            if (data[0] === 0xAA && data[2] === 0xD0) {
                try {
                    processBodyCompositionResponse(data);
                } catch (error) {
                    console.error('Error parsing body composition response:', error);
                }
            }

            /*  if (data[0] === 0xAA && data[2] === 0xB1) {
                  // Check if it's a 4-electrode response (length >= 12)
                  if (data.length >= 12) {
                      try {
                          const parsedPhaseAngleResult = parse4Electrode100kHzImpedance(data);
  
                          if (parsedPhaseAngleResult) {
                              console.log('\n📐 Phase Angle Measurement:');
                              console.log(`Frequency: ${parsedPhaseAngleResult.frequency}`);
                              console.log(`Phase Angle: ${parsedPhaseAngleResult.phaseAngle.value.toFixed(1)}°`);
                              console.log(`Impedance: ${parsedPhaseAngleResult.impedance.value.toFixed(1)} Ω`);
                              console.log(`Measurement Status: ${parsedPhaseAngleResult.measurementStatus.description}`);
                          }
                      } catch (error) {
                          console.error('Error parsing phase angle response:', error);
                      }
                  }
              }*/

            /* if (data[2] === 0xA1 && data.length >= 14) {
                 console.log(`\n WEIGHT STATUS:`);
 
                 // Status byte interpretation
                 const statusByte = data[3];
 
                 // Raw weight from device (little-endian)
             
                 const rawWeight = ((data[6] << 8) | data[5]) / 10.0;
 
                 // Calibration factor (adjust as needed)
                 const CALIBRATION_FACTOR = 1.84;  // You might need to fine-tune this
 
                 // Calibrated weight
                 const calibratedWeight = rawWeight * CALIBRATION_FACTOR;
                 finalweight = rawWeight * CALIBRATION_FACTOR;
 
                 // Status interpretation
                 const isStable = (statusByte & 0x01) !== 0;
                 const isZero = (statusByte & 0x02) !== 0;
                 const isOverload = (statusByte & 0x10) !== 0;
                 const peeling = data[4];
                 const adcValue = ((data[10] << 24) | (data[9] << 16) | (data[8] << 8) | data[7]);
 
                 console.log(`   Status Byte: 0x${statusByte.toString(16).toUpperCase()}`);
                 console.log(`   Stability: ${isStable ? '✅ Stable' : '❌ Unstable'}`);
                 console.log(`   Raw Weight: ${rawWeight.toFixed(2)} kg`);
                 console.log(`   ➝ Calibrated Weight: ${calibratedWeight.toFixed(2)} kg`);
 
 
                 if (isZero) console.log('   🔶 Zero Weight Detected');
                 if (isOverload) console.log('   ⚠️ OVERLOAD!');
             }*/

            console.log(`${'='.repeat(60)}\n`);

            heightWaitingForResponse = false;
            showMenu();
        });

        biaPort.on('error', (err) => {
            console.error(' BIA Serial Error:', err.message);
        });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 10000);

            biaPort.on('open', () => {
                clearTimeout(timeout);
                console.log(`✅ BIA Connected to ${portPath} at ${baudRate} baud`);
                resolve();
            });
        });
    } catch (error) {
        console.error('❌ BIA Connection failed:', error.message);
        throw error;
    }
}

// Connect to Height port
export async function connectHeightPort(portPath, baudRate = 9600) {
    try {
        if (heightPort && heightPort.isOpen) {
            await new Promise((resolve) => heightPort.close(resolve));
        }
        heightPort = new SerialPort({
            path: portPath,
            baudRate: baudRate,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });
        heightPort.on('data', (data) => {
            if (isMeasurementStopped) return;
            heightBuffer = Buffer.concat([heightBuffer, data]);
            while (heightBuffer.length >= 7) {
                const start = heightBuffer.indexOf(Buffer.from([0x55, 0xaa]));
                if (start === -1) {
                    heightBuffer = Buffer.alloc(0);
                    return;
                }
                if (heightBuffer.length - start < 7) return;
                const frame = heightBuffer.slice(start, start + 7);
                heightBuffer = heightBuffer.slice(start + 7);
                if (!verifyChecksum(frame)) continue;
                const distance = parseDistance(frame);
                const distanceCm = distance / 10;
                const calculatedHeight = 216.2 - distanceCm;
                finalheight = calculatedHeight;
                console.log(`\n${'='.repeat(60)}`);
                console.log(`:ruler: HEIGHT MEASUREMENT`);
                console.log(`${'='.repeat(60)}`);
                console.log(`:ruler: Distance: ${distance} mm (${distanceCm.toFixed(1)} cm)`);
                console.log(`:ruler: Calculated Height: ${calculatedHeight.toFixed(1)} cm`);
                if (checkStability(distance)) {
                    if (stableReadings.length >= STABILITY_COUNT) {
                        console.log(`\n${'='.repeat(60)}`);
                        console.log(`:tada: STABLE HEIGHT FOUND: ${calculatedHeight.toFixed(1)} cm`);
                        console.log(`${'='.repeat(60)}\n`);
                        isMeasurementStopped = true;
                        heightPort.close();
                        console.log(":octagonal_sign: Height measurement stopped.\n");
                        stableReadings = [];
                        // showMenu();
                    }
                } else {
                    console.log(`   Readings: ${stableReadings.length}/${STABILITY_COUNT}`);
                    console.log(`${'='.repeat(60)}\n`);
                }
            }
        });
        heightPort.on('error', (err) => {
            console.error(':x: Height Serial Error:', err.message);
        });
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 10000);
            heightPort.on('open', () => {
                clearTimeout(timeout);
                console.log(`:white_tick: Height Connected to ${portPath} at ${baudRate} baud`);
                resolve();
            });
        });
    } catch (error) {
        console.error(':x: Height Connection failed:', error.message);
        throw error;
    }
}




// Send BIA command
export async function sendBiaCommand(command, options = {}) {
    const defaultOptions = {
        waitForResponse: true,
        timeout: 10000,  // 10 seconds
        verbose: true,
        responseHandler: null
    };

    const config = { ...defaultOptions, ...options };

    return new Promise((resolve, reject) => {
        // Check port connection
        if (!biaPort || !biaPort.isOpen) {
            const error = new Error('BIA Port not connected');
            if (config.verbose) console.error(`❌ ${error.message}`);
            reject(error);
            return;
        }

        // Ensure command is a buffer
        const buffer = Buffer.isBuffer(command) ? command : Buffer.from(command);
        const hexString = buffer.toString('hex').toUpperCase();

        // Verbose logging
        if (config.verbose) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(` SENDING BIA COMMAND`);
            console.log(`${'='.repeat(60)}`);
            console.log(` Hex: ${hexString}`);
            //console.log(`Time: ${new Date().toLocaleTimeString()}`);
            console.log(`${'='.repeat(60)}`);
        }

        // Write command
        biaPort.write(buffer, (err) => {
            if (err) {
                if (config.verbose) console.error(' Write error:', err.message);
                reject(err);
                return;
            }

            if (config.verbose) console.log('✅ BIA Command sent successfully\n');

            // Response handling
            if (config.waitForResponse) {
                let responseTimeout;

                const responseListener = (data) => {
                    // Clear timeout
                    if (responseTimeout) clearTimeout(responseTimeout);

                    // Custom or default response handling
                    if (config.responseHandler) {
                        config.responseHandler(data);
                    } else {
                        // Default parsing
                        // parseBodyComposition1(data);
                    }

                    // Remove listener to prevent memory leaks
                    biaPort.removeListener('data', responseListener);

                    resolve(data);
                };

                // Set timeout
                responseTimeout = setTimeout(() => {
                    biaPort.removeListener('data', responseListener);
                    const timeoutError = new Error('No response received');
                    if (config.verbose) console.warn('\n  WARNING:', timeoutError.message);
                    reject(timeoutError);
                }, config.timeout);

                // Add response listener
                biaPort.on('data', responseListener);
            } else {
                resolve();
            }
        });
    });
}

export function getFrequencyName(frequencyCode) {
    const frequencyNames = {
        0x00: 'Current Measurement',
        0x01: '5 kHz',
        0x02: '10 kHz',
        0x03: '20 kHz',
        0x04: '25 kHz',
        0x05: '50 kHz',
        0x06: '100 kHz',
        0x07: '200 kHz',
        0x08: '250 kHz',
        0x09: '500 kHz'
    };
    return frequencyNames[frequencyCode] || `Unknown (0x${frequencyCode.toString(16).toUpperCase()})`;
}
export function getResponseTypeName(responseTypeCode) {
    const responseTypes = {
        0x01: 'Original Impedance',
        0x02: 'Encrypted Impedance',
        0x03: 'ADC Value'
    };
    return responseTypes[responseTypeCode] || `Unknown (0x${responseTypeCode.toString(16).toUpperCase()})`;
}





export function extractFrequencyInfo(responseByte) {
    return {
        frequency: (responseByte >> 4) & 0x0F,
        responseType: responseByte & 0x0F
    };
}


export async function case38_20kHzImpedanceQuery() {
    try {
        // Step 1: Stop current test
        await sendBiaCommand([0x55, 0x06, 0xB0, 0x00, 0x00, 0xF5]);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 2: Set impedance mode for 8-electrode 20 kHz
        await sendBiaCommand([0x55, 0x06, 0xB0, 0x01, 0x03, 0xF1]);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Query command for 20 kHz
        const query20kHzCommand = [0x55, 0x05, 0xB1, 0x31, 0xC4];

        // Track results
        const results = {
            totalAttempts: 50,
            meaningfulResponses: [],
            zeroResponses: [],
            errorResponses: []
        };

        // Function to check if responses are stable
        const isStableResponse = (responses) => {
            if (responses.length < 5) return false;

            // Get the last 5 responses
            const lastFive = responses.slice(-5);

            // Check if all last 5 responses are meaningful and similar
            const allMeaningful = lastFive.every(isMeaningful20kHzResult);

            if (!allMeaningful) return false;

            // Compare segments across last 5 responses
            const segments = ['rightHand', 'leftHand', 'trunk', 'rightFoot', 'leftFoot'];

            return segments.every(segment => {
                const values = lastFive.map(r => r.segments[segment]);
                const max = Math.max(...values);
                const min = Math.min(...values);
                return (max - min) / max < 0.1; // Within 10% variation
            });
        };

        // 50 attempts
        for (let attempt = 1; attempt <= 50; attempt++) {
            try {
                console.log(`\n📡 Attempt ${attempt}: Querying 20 kHz Impedance`);

                const responseData = await sendBiaCommand(query20kHzCommand, {
                    timeout: 5000,
                    verbose: true
                });

                // Parse response
                const parsedResult = parse20kHzImpedanceResponse(responseData);

                console.log("-----");
                console.log(parsedResult);

                // Check if result is meaningful
                if (isMeaningful20kHzResult(parsedResult)) {
                    results.meaningfulResponses.push(parsedResult);
                } else {
                    results.zeroResponses.push({
                        attempt,
                        rawResponse: responseData
                    });
                }

                // Check for stable responses
                if (isStableResponse(results.meaningfulResponses)) {
                    console.log('✅ Stable impedance values detected!');
                    break;
                }

                // Delay between attempts
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (queryError) {
                console.error(`Attempt ${attempt} failed:`, queryError);
                results.errorResponses.push({
                    attempt,
                    error: queryError.message
                });
            }
        }

        // Display comprehensive results
        console.log('\n20 kHz Impedance Query Results:');
        console.log(`Total Attempts: ${results.totalAttempts}`);
        console.log(`Meaningful Responses: ${results.meaningfulResponses.length}`);
        console.log(`Zero Responses: ${results.zeroResponses.length}`);
        console.log(`Error Responses: ${results.errorResponses.length}`);

        // Detailed meaningful responses
        if (results.meaningfulResponses.length > 0) {
            console.log('\n Final Meaningful Data:');
            const finalResponse = results.meaningfulResponses[results.meaningfulResponses.length - 1];
            console.log(JSON.stringify(finalResponse, null, 2));
        }
        // Save the results globally
            const finalResult =
  results.meaningfulResponses.length > 0
    ? results.meaningfulResponses[results.meaningfulResponses.length - 1]
    : null;

impedance20kHzResults = finalResult;

return finalResult;
    } catch (error) {
        console.error('Overall 20 kHz impedance query failed:', error);
        throw error;
    }
}

// Helper functions remain the same as in previous implementation
export function parse20kHzImpedanceResponse(data) {
    console.log("coming 20khz frequency")
    // Validate response
    if (data[0] !== 0xAA || data[2] !== 0xB1) {
        console.log('❌ Invalid impedance response');
        return null;
    }
    console.log(data.length);
    // 8-electrode parsing
    if (data.length >= 26) {
        return {
            frequency: getFrequencyName((data[3] >> 4) & 0x0F),
            responseType: getResponseTypeName(data[3] & 0x0F),
            measurementStatus: data[4],
            segments: {
                rightHand: readImpedanceValue(data, 6),   // Bytes 6-9
                leftHand: readImpedanceValue(data, 10),   // Bytes 10-13
                trunk: readImpedanceValue(data, 14),      // Bytes 14-17
                rightFoot: readImpedanceValue(data, 18),  // Bytes 18-21
                leftFoot: readImpedanceValue(data, 22)    // Bytes 22-25
            }
        };
    }

    return null;
}


export function isMeaningful20kHzResult(result) {
    if (!result || !result.segments) return false;

    return Object.values(result.segments).some(value => value > 0);
}

export async function case39_100kHzImpedanceQuery() {
    try {
        // Step 1: Stop current test
        await sendBiaCommand([0x55, 0x06, 0xB0, 0x00, 0x00, 0xF5]);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 2: Set impedance mode for 8-electrode 100 kHz
        await sendBiaCommand([0x55, 0x06, 0xB0, 0x01, 0x06, 0xEE]);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Query command for 100 kHz
        const query100kHzCommand = [0x55, 0x05, 0xB1, 0x61, 0x94];

        // Track results
        const results = {
            totalAttempts: 50,
            meaningfulResponses: [],
            zeroResponses: [],
            errorResponses: []
        };

        // Function to check if responses are stable
        const isStableResponse = (responses) => {
            if (responses.length < 5) return false;

            // Get the last 5 responses
            const lastFive = responses.slice(-5);

            // Check if all last 5 responses are meaningful and similar
            const allMeaningful = lastFive.every(isMeaningful100kHzResult);

            if (!allMeaningful) return false;

            // Compare segments across last 5 responses
            const segments = ['rightHand', 'leftHand', 'trunk', 'rightFoot', 'leftFoot'];

            return segments.every(segment => {
                const values = lastFive.map(r => r.segments[segment]);
                const max = Math.max(...values);
                const min = Math.min(...values);
                return (max - min) / max < 0.1; // Within 10% variation
            });
        };

        // 50 attempts
        for (let attempt = 1; attempt <= 50; attempt++) {
            try {
                console.log(`\n📡 Attempt ${attempt}: Querying 100 kHz Impedance`);

                const responseData = await sendBiaCommand(query100kHzCommand, {
                    timeout: 5000,
                    verbose: true
                });

                // Parse response
                const parsedResult = parse100kHzImpedanceResponse(responseData);

                // Check if result is meaningful
                if (isMeaningful100kHzResult(parsedResult)) {
                    results.meaningfulResponses.push(parsedResult);
                } else {
                    results.zeroResponses.push({
                        attempt,
                        rawResponse: responseData
                    });
                }

                // Check for stable responses
                if (isStableResponse(results.meaningfulResponses)) {
                    console.log('✅ Stable impedance values detected!');
                    break;
                }

                // Delay between attempts
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (queryError) {
                console.error(`Attempt ${attempt} failed:`, queryError);
                results.errorResponses.push({
                    attempt,
                    error: queryError.message
                });
            }
        }

        // Display comprehensive results
        console.log('\n📊 100 kHz Impedance Query Results:');
        console.log(`Total Attempts: ${results.totalAttempts}`);
        console.log(`Meaningful Responses: ${results.meaningfulResponses.length}`);
        console.log(`Zero Responses: ${results.zeroResponses.length}`);
        console.log(`Error Responses: ${results.errorResponses.length}`);

        // Detailed meaningful responses
        if (results.meaningfulResponses.length > 0) {
            console.log('\n✅ Final Meaningful Data:');
            const finalResponse = results.meaningfulResponses[results.meaningfulResponses.length - 1];
            console.log(JSON.stringify(finalResponse, null, 2));
        }
      const finalResult =
  results.meaningfulResponses.length > 0
    ? results.meaningfulResponses[results.meaningfulResponses.length - 1]
    : null;

impedance100kHzResults = finalResult;

return finalResult;
    } catch (error) {
        console.error('Overall 100 kHz impedance query failed:', error);
        throw error;
    }
}

// Helper export function to parse 100 kHz impedance response
export function parse100kHzImpedanceResponse(data) {
    // Validate response
    if (data[0] !== 0xAA || data[2] !== 0xB1) {
        console.log('❌ Invalid impedance response');
        return null;
    }

    // 8-electrode parsing
    if (data.length >= 26) {
        return {
            segments: {
                rightHand: readImpedanceValue(data, 6),   // Bytes 6-9
                leftHand: readImpedanceValue(data, 10),   // Bytes 10-13
                trunk: readImpedanceValue(data, 14),      // Bytes 14-17
                rightFoot: readImpedanceValue(data, 18),  // Bytes 18-21
                leftFoot: readImpedanceValue(data, 22)    // Bytes 22-25
            }
        };
    }

    return null;
}

// Helper to read impedance value
export function readImpedanceValue(data, offset) {
    // Read 32-bit little-endian value with resolution 0.1Ω
    const rawValue = data[offset] |
        (data[offset + 1] << 8) |
        (data[offset + 2] << 16) |
        (data[offset + 3] << 24);

    // Convert to decimal value (divide by 10 for 0.1Ω resolution)
    return rawValue / 10.0;
}

// Helper to check if result is meaningful
export function isMeaningful100kHzResult(result) {
    if (!result || !result.segments) return false;

    return Object.values(result.segments).some(value => value > 0);
}

export async function case40_PhaseAngleDetailedQuery() {
    try {
        // Measurement modes for 50 kHz
        const modes = [
            {
                code: IMPEDANCE_MODES.FOUR_ELECTRODE_LEGS,
                name: 'Four-Electrode Legs',
                setImpedanceCommand: [0x55, 0x06, 0xB0, 0x02, 0x05, 0xEE]  // Specific command for legs
            },
            {
                code: IMPEDANCE_MODES.FOUR_ELECTRODE_ARMS,
                name: 'Four-Electrode Arms',
                setImpedanceCommand: [0x55, 0x06, 0xB0, 0x03, 0x05, 0xED]  // Specific command for arms
            }
        ];

        // Results storage
        const phaseAngleResults = {
            'Four-Electrode Legs': [],
            'Four-Electrode Arms': []
        };

        // Stability check export function
        const isStableResponse = (responses) => {
            if (responses.length < 5) return false;

            // Get the last 5 responses
            const lastFive = responses.slice(-5);

            // Check phase angle stability
            const phaseAngles = lastFive.map(r => r.phaseAngle.value);
            const impedanceValues = lastFive.map(r => r.impedance.value);

            // Phase angle variation check
            const phaseAngleMax = Math.max(...phaseAngles);
            const phaseAngleMin = Math.min(...phaseAngles);
            const phaseAngleVariation = (phaseAngleMax - phaseAngleMin) / phaseAngleMax;

            // Impedance variation check
            const impedanceMax = Math.max(...impedanceValues);
            const impedanceMin = Math.min(...impedanceValues);
            const impedanceVariation = impedanceMax > 0
                ? (impedanceMax - impedanceMin) / impedanceMax
                : 0;

            // Stability criteria
            const isStablePhaseAngle = phaseAngleVariation < 0.1;  // Within 10% variation
            const isStableImpedance = impedanceVariation < 0.1;    // Within 10% variation

            return isStableImpedance;
        };

        for (const mode of modes) {
            console.log(`\n📡 Measuring Phase Angle: 50 kHz, ${mode.name}`);

            // Stop current test
            await sendBiaCommand([0x55, 0x06, 0xB0, 0x00, 0x00, 0xF5]);
            await new Promise(resolve => setTimeout(resolve, 500));

            // Set impedance mode with specific command
            await sendBiaCommand(mode.setImpedanceCommand);
            await new Promise(resolve => setTimeout(resolve, 500));

            // Verify mode set
            await sendBiaCommand([0x55, 0x05, 0xB1, 0x01, 0xF4]);
            await new Promise(resolve => setTimeout(resolve, 500));

            // Query command
            const queryCommand = [0x55, 0x05, 0xB1, 0x01, 0xF4];

            // Track results
            const results = {
                attempts: 50,
                meaningfulResponses: [],
                zeroResponses: [],
                errorResponses: []
            };

            // 50 attempts
            for (let attempt = 1; attempt <= 50; attempt++) {
                try {
                    console.log(`Attempt ${attempt}`);

                    const responseData = await sendBiaCommand(queryCommand, {
                        timeout: 5000,
                        verbose: true
                    });

                    // Parse 4-electrode response
                    if (responseData.length === 13) {  // Specific length for 50 kHz 4-electrode response
                        const parsedResult = parse4Electrode50kHzImpedance(responseData);

                        if (parsedResult) {
                            results.meaningfulResponses.push(parsedResult);

                            // Check for stable responses
                            if (isStableResponse(results.meaningfulResponses)) {
                                console.log('✅ Stable measurements detected!');
                                break;
                            }
                        } else {
                            results.zeroResponses.push({
                                attempt,
                                rawResponse: responseData
                            });
                        }
                    }

                    // Delay between attempts
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (queryError) {
                    console.error(`Attempt ${attempt} failed:`, queryError);
                    results.errorResponses.push({
                        attempt,
                        error: queryError.message
                    });
                }
            }

            // Store results
            phaseAngleResults[mode.name] = results;
        }

        // Display comprehensive results
        console.log('\n📊 Phase Angle Measurement Results:');
        Object.entries(phaseAngleResults).forEach(([mode, results]) => {
            console.log(`\n   ${mode}:`);
            console.log(`   Total Attempts: ${results.attempts}`);
            console.log(`   Meaningful Responses: ${results.meaningfulResponses.length}`);
            console.log(`   Zero Responses: ${results.zeroResponses.length}`);
            console.log(`   Error Responses: ${results.errorResponses.length}`);
            console.log("----error responses-------")
            console.log(errorResponses);
            // Analyze phase angle results
            if (results.meaningfulResponses.length > 0) {
                const phaseAngles = results.meaningfulResponses.map(r => r.phaseAngle.value);
                const impedanceValues = results.meaningfulResponses.map(r => r.impedance.value);

                console.log('\n   📐 Phase Angle Statistics:');
                console.log(`   Min: ${Math.min(...phaseAngles).toFixed(1)}°`);
                console.log(`   Max: ${Math.max(...phaseAngles).toFixed(1)}°`);
                console.log(`   Average: ${(phaseAngles.reduce((a, b) => a + b, 0) / phaseAngles.length).toFixed(1)}°`);

                console.log('\n   ⚡ Impedance Statistics:');
                console.log(`   Min: ${Math.min(...impedanceValues).toFixed(1)} Ω`);
                console.log(`   Max: ${Math.max(...impedanceValues).toFixed(1)} Ω`);
                console.log(`   Average: ${(impedanceValues.reduce((a, b) => a + b, 0) / impedanceValues.length).toFixed(1)} Ω`);

                // Correlation between phase angle and impedance
                //  const correlation = calculateCorrelation(phaseAngles, impedanceValues);
                //console.log(`\n   🔗 Phase Angle-Impedance Correlation: ${correlation.toFixed(2)}`);
            }
        });

        showMenu();
    } catch (error) {
        console.error('Overall phase angle query failed:', error);
        showMenu();
    }
}

// Specific parsing export function for 50 kHz 4-electrode response

export function parse4Electrode50kHzImpedance(data) {
    // Validate response
    if (data[0] !== 0xAA || data[2] !== 0xB1) {
        console.log('❌ Invalid 4-electrode impedance response');
        return null;
    }

    // Verify response length for 50 kHz 4-electrode
    if (data.length !== 13) {
        console.log('❌ Incorrect response length for 50 kHz 4-electrode');
        return null;
    }

    // Frequency and response type extraction (page 13)
    const frequencyCode = (data[3] >> 4) & 0x0F;
    const responseTypeCode = data[3] & 0x0F;

    // Measurement status (page 13)
    const measurementStatus = data[4];

    // Phase Angle (16-bit signed, little-endian, resolution 0.1°)
    // From page 13: Phase angle is a signed 16-bit value at bytes 6-7
    const phaseAngleRaw = data[6] | (data[7] << 8);
    const phaseAngle = phaseAngleRaw / 10;

    // Impedance (16-bit unsigned, little-endian, resolution 0.1Ω)
    // From page 13: Impedance is a 16-bit unsigned value at bytes 8-9
    const impedanceRaw =
        (data[8] & 0xFF) |
        ((data[9] & 0xFF) << 8) |
        ((data[10] & 0xFF) << 16) |
        ((data[11] & 0xFF) << 24);
    const impedance = impedanceRaw / 10;

    // Detailed debug logging
    console.log('Raw Byte Details:');
    console.log(`Frequency Code: 0x${frequencyCode.toString(16).padStart(2, '0')}`);
    console.log(`Response Type: 0x${responseTypeCode.toString(16).padStart(2, '0')}`);
    console.log(`Measurement Status: 0x${measurementStatus.toString(16).padStart(2, '0')}`);
    console.log(`Phase Angle Bytes: 0x${data[6].toString(16).padStart(2, '0')} 0x${data[7].toString(16).padStart(2, '0')}`);
    console.log(`Impedance Bytes: 0x${data[8].toString(16).padStart(2, '0')} 0x${data[9].toString(16).padStart(2, '0')} 0x${data[10].toString(16).padStart(2, '0')} 0x${data[11].toString(16).padStart(2, '0')}`);

    return {
        measurementType: '4-Electrode 50 kHz',
        frequency: getFrequencyName(frequencyCode),
        responseType: getResponseTypeName(responseTypeCode),
        measurementStatus: {
            code: measurementStatus,
            description: interpretMeasurementStatus(measurementStatus)
        },
        phaseAngle: {
            value: phaseAngle,
            unit: '°',
            rawBytes: [data[6], data[7]],
            resolution: 0.1
        },
        impedance: {
            value: impedance,
            unit: 'Ω',
            rawBytes: [data[8], data[9], data[10], data[11]],
            resolution: 0.1
        },
        rawData: {
            fullResponse: Array.from(data)
        }
    };
}

export function calculateCorrelation(x, y) {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;

    // Calculate means
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    // Calculate covariance and standard deviations
    let covariance = 0;
    let varX = 0;
    let varY = 0;

    for (let i = 0; i < n; i++) {
        const diffX = x[i] - meanX;
        const diffY = y[i] - meanY;

        covariance += diffX * diffY;
        varX += diffX * diffX;
        varY += diffY * diffY;
    }

    covariance /= n;
    varX /= n;
    varY /= n;

    // Correlation coefficient
    return covariance / (Math.sqrt(varX) * Math.sqrt(varY));
}



// Helper export function to interpret measurement status
export function interpretMeasurementStatus(statusByte) {
    const statusDescriptions = {
        0x00: 'Normal measurement',
        0x01: 'Working mode error',
        0x02: 'Frequency error',
        0x03: 'Impedance measurement error',
        0x04: 'Over range',
        0x05: 'Under range'
    };

    return statusDescriptions[statusByte] || 'Unknown status';
}

//weight case
// export async function case41_WeightMeasurement() {
//     try {
//         // Ensure BIA port is connected
//         if (!biaPort || !biaPort.isOpen) {
//             console.log('❌ BIA port not connected');
//             showMenu();
//             return;
//         }

//         // Results storage
//         const weightResults = {
//             attempts: 0,
//             measurements: [],
//             stabilityChecks: []
//         };

//         // Stability check export function
//         // Stability check export function
//         const isStableWeight = (measurements) => {
//             if (measurements.length < 5) return false;

//             // Get the last 5 measurements
//             const lastFive = measurements.slice(-5);

//             // Ensure all measurements have a valid weight
//             const validMeasurements = lastFive.filter(m =>
//                 m && m.calibratedWeight !== undefined && m.calibratedWeight > 0
//             );

//             if (validMeasurements.length < 5) return false;

//             // Calculate weight variations
//             const weights = validMeasurements.map(m => m.calibratedWeight);
//             const maxWeight = Math.max(...weights);
//             const minWeight = Math.min(...weights);
//             const weightVariation = (maxWeight - minWeight) / maxWeight;

//             console.log('Weight Stability Check:');
//             console.log(`Weights: [${weights.map(w => w.toFixed(2)).join(', ')} kg]`);
//             console.log(`Weight Variation: ${(weightVariation * 100).toFixed(2)}%`);

//             // Stability criteria: within 10% variation
//             return weightVariation < 0.1;
//         };

//         // Set weight mode command
//         const setWeightModeCommand = [0x55, 0x05, 0xA0, 0x01, 0x05];

//         // Weight query command
//         const weightQueryCommand = [0x55, 0x05, 0xA1, 0x00, 0x05];

//         // Stop current test
//         await sendBiaCommand([0x55, 0x06, 0xB0, 0x00, 0x00, 0xF5]);
//         await new Promise(resolve => setTimeout(resolve, 500));

//         // Set weight mode
//         await sendBiaCommand(setWeightModeCommand);
//         await new Promise(resolve => setTimeout(resolve, 500));

//         // Maximum attempts
//         const MAX_ATTEMPTS = 20;

//         while (weightResults.attempts < MAX_ATTEMPTS) {
//             try {
//                 weightResults.attempts++;
//                 console.log(`\n📏 Weight Measurement Attempt ${weightResults.attempts}`);

//                 const responseData = await sendBiaCommand(weightQueryCommand, {
//                     timeout: 5000,
//                     verbose: true
//                 });

//                 // Parse weight response
//                 if (responseData[0] === 0xAA && responseData[2] === 0xA1 && responseData.length >= 14) {
//                     const statusByte = responseData[3];
//                     const rawWeight = ((responseData[6] << 8) | responseData[5]) / 10.0;

//                     // Calibration factor (adjust as needed)
//                     const CALIBRATION_FACTOR = 1.84;
//                     const calibratedWeight = rawWeight * CALIBRATION_FACTOR;

//                     // Measurement details
//                     const measurementDetails = {
//                         rawWeight,
//                         calibratedWeight,
//                         statusByte,
//                         isStable: (statusByte & 0x01) !== 0,
//                         isZero: (statusByte & 0x02) !== 0,
//                         isOverload: (statusByte & 0x10) !== 0
//                     };

//                     weightResults.measurements.push(measurementDetails);

//                     // Check for stable weight
//                     if (isStableWeight(weightResults.measurements)) {
//                         console.log('✅ Stable weight measurement detected!');
//                         break;
//                     }
//                 }

//                 // Delay between attempts
//                 await new Promise(resolve => setTimeout(resolve, 500));

//             } catch (queryError) {
//                 console.error(`Attempt ${weightResults.attempts} failed:`, queryError);
//             }
//         }

//         // Display results
//         console.log('\n Weight Measurement Results:');
//         console.log(`Total Attempts: ${weightResults.attempts}`);
//         console.log(`Measurements Collected: ${weightResults.measurements.length}`);

//         if (weightResults.measurements.length > 0) {
//             const finalMeasurement = weightResults.measurements[weightResults.measurements.length - 1];
//             console.log('\nFinal Weight Measurement:');
//             console.log(`Raw Weight: ${finalMeasurement.rawWeight.toFixed(2)} kg`);
//             console.log(`Calibrated Weight: ${finalMeasurement.calibratedWeight.toFixed(2)} kg`);
//             console.log(`Stability: ${finalMeasurement.isStable ? '✅ Stable' : '❌ Unstable'}`);

//             // Store final weight for global use
//             finalweight = finalMeasurement.calibratedWeight;
//         }
//        if (!IS_ELECTRON) showMenu();
//     } catch (error) {
//         console.error('Weight measurement failed:', error);
//         showMenu();
//     }
// }
export async function case41_WeightMeasurement() {
  if (!biaPort || !biaPort.isOpen) {
    throw new Error("BIA port not connected");
  }

  // Stop other tests
  biaPort.write(Buffer.from([0x55, 0x06, 0xB0, 0x00, 0x00, 0xF5]));
  await delay(300);

  // Enter weight mode
  biaPort.write(Buffer.from([0x55, 0x05, 0xA0, 0x01, 0x05]));
  await delay(300);

  const samples = [];

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      biaPort.off("data", onData);
      clearInterval(poll);
      reject(new Error("Weight timeout"));
    }, 15000);

    const onData = (data) => {
      console.log("[WEIGHT RAW]", data.toString("hex").toUpperCase());

      if (data[0] !== 0xAA) return;

      const cmd = data[2];
      if (cmd !== 0xA1 && cmd !== 0xA0) return;

      const status = data[3];
      const isStable = (status & 0x01) !== 0;
      const isZero = (status & 0x02) !== 0;
      const isOverload = (status & 0x10) !== 0;

      if (isZero || isOverload) return;

      // Try both offsets once
      const wA = data.readUInt16LE(5) / 10;
      const wB = data.readUInt16LE(6) / 10;

      const weight =
        wA > 5 && wA < 300 ? wA :
        wB > 5 && wB < 300 ? wB :
        null;

      if (!weight) return;

      samples.push(weight);
      if (samples.length > 5) samples.shift();

      console.log("Weight:", weight, "Stable:", isStable);

      if (isStable && samples.length === 5) {
        const max = Math.max(...samples);
        const min = Math.min(...samples);

        if (max - min < 0.2) {
          clearTimeout(timeout);
          clearInterval(poll);
          biaPort.off("data", onData);

          finalweight = Number(
            (samples.reduce((a, b) => a + b) / samples.length).toFixed(2)
          );

          console.log("✅ FINAL WEIGHT:", finalweight);
          resolve(finalweight);
        }
      }
    };

    biaPort.on("data", onData);

    // Continuous polling (IMPORTANT)
    const poll = setInterval(() => {
      biaPort.write(Buffer.from([0x55, 0x05, 0xA1, 0x00, 0x05]));
    }, 300);
  });
}



function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}


// Show menu
export function showMenu() {
    if(IS_ELECTRON) return;
    console.log('1. List available ports');
    console.log('2. Connect Height Sensor (9600 baud)');
    console.log('3. Connect BIA Scale (38400 baud)');
    console.log('4. Disconnect Height');
    console.log('5. Disconnect BIA');
    console.log('6. Start Height Measurement');
    //  console.log('7.  Switch to Normal Weighing Mode (0xA0)');
    // console.log('8. Read Weight Status (0xA1)');
    console.log('7. Measure Weight');
    console.log('9. Calculate Impedance 20khz');
    console.log('10. Calculate Impedance 100khz');
    console.log('11. Calculate Full Body Composition');
    console.log('12. Phase Angle Calculation');
    console.log('13. Send Custom Command');
    console.log('0. Exit');
    console.log('='.repeat(60));
    if (!IS_ELECTRON) rl.question('\nSelect option: ', handleMenuChoice);
}

// Handle menu choice
export async function handleMenuChoice(choice) {
    if(IS_ELECTRON) return;
    try {
        switch (choice.trim()) {
            case '1':
                await getPorts();
                showMenu();
                break;

            case '2':
                if (!IS_ELECTRON) rl.question('Enter HEIGHT sensor port path (e.g., /dev/tty.usbserial-XXXX or COM3): ', async (portPath) => {
                    try {
                        console.log("Port path",portPath)
                        await connectHeightPort(portPath, 9600);
                        showMenu();
                    } catch (error) {
                        console.error('Failed:', error.message);
                        showMenu();
                    }
                });
                break;

            case '3':
                if (!IS_ELECTRON) rl.question('Enter BIA scale port path (e.g., /dev/tty.usbserial-YYYY or COM6): ', async (portPath) => {
                    try {
                        await connectBiaPort(portPath, 38400);
                        showMenu();
                    } catch (error) {
                        console.error('Failed:', error.message);
                        showMenu();
                    }
                });
                break;

            case '4':
                if (heightPort && heightPort.isOpen) {
                    await new Promise((resolve) => heightPort.close(resolve));
                    heightPort = null;
                    console.log('✅ Height disconnected');
                } else {
                    console.log('⚠️  Height not connected');
                }
                showMenu();
                break;

            case '5':
                if (biaPort && biaPort.isOpen) {
                    await new Promise((resolve) => biaPort.close(resolve));
                    biaPort = null;
                    console.log('✅ BIA disconnected');
                } else {
                    console.log('⚠️  BIA not connected');
                }
                showMenu();
                break;

            case '6':
                if (!heightPort || !heightPort.isOpen) {
                    console.log(' Height sensor not connected');
                    showMenu();
                    return;
                }

                console.log('\n STARTING HEIGHT MEASUREMENT');
                console.log('='.repeat(60));
                console.log('Please stand still and prepare for measurement.');
                console.log('='.repeat(60));

                if (!IS_ELECTRON) rl.question('Press ENTER to start measuring: ', async () => {
                    isMeasurementStopped = false;
                    stableReadings = [];

                    const interval = setInterval(() => {
                        if (!isMeasurementStopped && heightPort && heightPort.isOpen) {
                            heightPort.write(READ_CMD);
                        } else {
                            clearInterval(interval);
                        }
                    }, 200);
                });
                break;

            case '7':
                await case41_WeightMeasurement();
                /*    try {
                        if (!biaPort || !biaPort.isOpen) {
                            console.log(' BIA not connected');
                            showMenu();
                            return;
                        }
                        const cmd = createCommand(0xA0, [0x01]);
                        await sendBiaCommand(cmd, true);
                    } catch (error) {
                        console.error('Failed:', error.message);
                        showMenu();
                    }*/
                break;


            case '8':
                try {
                    if (!biaPort || !biaPort.isOpen) {
                        console.log(' BIA not connected');
                        showMenu();
                        return;
                    }
                    const cmd = createCommand(0xA1, [0x00]);
                    await sendBiaCommand(cmd, true);
                } catch (error) {
                    console.error('Failed:', error.message);
                    showMenu();
                }
                break;

            case '9':
                console.log('\n 20 kHz Impedance Query with Controlled Delay');
                if (!IS_ELECTRON) rl.question('Press ENTER to start 20 kHz impedance measurement, or "q" to quit: ', async (input) => {
                    if (input.toLowerCase() === 'q') {
                        showMenu();
                        return;
                    }

                    try {
                        // Call the 20 kHz impedance query export function
                        await case38_20kHzImpedanceQuery();
                    } catch (error) {
                        console.error('Error in 20 kHz impedance query:', error);
                    } finally {
                        showMenu();
                    }
                });
                break;

            case '10':
                console.log('\n 100 kHz Impedance Query with Stability Check');
                if (!IS_ELECTRON) rl.question('Press ENTER to start 100 kHz impedance measurement, or "q" to quit: ', async (input) => {
                    if (input.toLowerCase() === 'q') {
                        showMenu();
                        return;
                    }

                    try {
                        // Call the 100 kHz impedance query export function
                        await case39_100kHzImpedanceQuery();
                    } catch (error) {
                        console.error('Error in 100 kHz impedance query:', error);
                    } finally {
                        showMenu();
                    }
                });
                break;

            case '11':
                try {
                    if (!biaPort || !biaPort.isOpen) {
                        console.log('❌ BIA not connected');
                        showMenu();
                        return;
                    }

                    // Check if impedance results are available
                    if (!impedance20kHzResults || !impedance100kHzResults) {
                        console.log('❌ Please run 20 kHz and 100 kHz impedance queries first');
                        showMenu();
                        return;
                    }

                    //  console.log(' Automatically using impedance and height/weight values from previous measurements');

                    // Use finalheight and finalweight directly
                    const height = finalheight;
                    const weight = finalweight;

                    // Prompt for gender and age
                    if (!IS_ELECTRON) rl.question('Gender (0=Female, 1=Male): ', (gender) => {
                        if (!IS_ELECTRON) rl.question('Age (years): ', async (age) => {
                            try {
                                const cmd = create8ElectrodeBodyCompositionCommand(
                                    parseInt(gender),
                                    parseInt(height),
                                    parseInt(age),
                                    parseFloat(weight),
                                    // 20 kHz impedance values
                                    impedance20kHzResults.segments.rightHand,
                                    impedance20kHzResults.segments.leftHand,
                                    impedance20kHzResults.segments.trunk,
                                    impedance20kHzResults.segments.rightFoot,
                                    impedance20kHzResults.segments.leftFoot,
                                    // 100 kHz impedance values
                                    impedance100kHzResults.segments.rightHand,
                                    impedance100kHzResults.segments.leftHand,
                                    impedance100kHzResults.segments.trunk,
                                    impedance100kHzResults.segments.rightFoot,
                                    impedance100kHzResults.segments.leftFoot
                                );

                                console.log('\nBody Composition Command Details:');
                                console.log(`Gender: ${gender === '1' ? 'Male' : 'Female'}`);
                                console.log(`Height: ${height} cm`);
                                console.log(`Age: ${age} years`);
                                console.log(`Weight: ${weight} kg`);

                                await sendBiaCommand(cmd, true);
                            } catch (error) {
                                console.error('Failed to create body composition command:', error.message);
                                showMenu();
                            }
                        });
                    });
                } catch (error) {
                    console.error('Failed:', error.message);
                    showMenu();
                }
                break;
            case '12':
                await case40_PhaseAngleDetailedQuery();
                break;
            case '13': // Custom command
                if (!IS_ELECTRON) rl.question('Enter hex command (e.g., 55 05 A1 00 05): ', async (cmd) => {
                    try {
                        await sendBiaCommand(cmd, true);
                       
                    } catch (error) {
                        console.error('Failed to send command:', error.message);
                        showMenu();
                    }
                });
                break;
            case '0':
                console.log('\n Shutting down...');
                if (heightPort && heightPort.isOpen) {
                    await new Promise((resolve) => heightPort.close(resolve));
                }
                if (biaPort && biaPort.isOpen) {
                    await new Promise((resolve) => biaPort.close(resolve));
                }
                rl.close();
                process.exit(0);
                break;

            default:
                console.log(' Invalid option');
                showMenu();
        }
    } catch (error) {
        console.error('Error:', error.message);
        showMenu();
    }
}

// Main startup
showMenu();

// Graceful shutdown
if (!IS_ELECTRON) {
    process.on('SIGINT', async () => {
    console.log('\n Shutting down...');
    if (heightPort && heightPort.isOpen) {
        await new Promise((resolve) => heightPort.close(resolve));
    }
    if (biaPort && biaPort.isOpen) {
        await new Promise((resolve) => biaPort.close(resolve));
    }
    process.exit(0);
});
}


