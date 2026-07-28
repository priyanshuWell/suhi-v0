# SUHI — Student Health & Intelligence Kiosk

> **Version:** 1.0.6 · **Stack:** Electron + React + Vite · **Platform:** Windows / macOS / Linux

SUHI is a **self-service health screening kiosk** application designed for schools and educational institutions. Students step up to the kiosk, identify themselves via face recognition, and undergo a full biometric screening — height, weight, body composition (BIA), cognitive assessments, and colour-blindness tests — all without staff intervention. Results are stored and synced to a backend API in real time.

---

## Table of Contents

- [What It Does](#what-it-does)
- [Architecture](#architecture)
- [Key Features](#key-features)
- [Hardware Requirements](#hardware-requirements)
- [Prerequisites](#prerequisites)
- [Project Setup](#project-setup)
- [Environment Configuration](#environment-configuration)
- [Running in Development](#running-in-development)
- [Building for Production](#building-for-production)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)

---

## What It Does

SUHI guides a student through a structured **multi-stage screening workflow**:

1. **Student Identification** — A short video clip is captured and sent to the FPT (Face Processing Technology) API to identify the student. Handles both single-match and multiple-match scenarios.
2. **Registration / Welcome** — Displays the identified student's info and transitions to the screening flow.
3. **Height & Weight Measurement** — Communicates over serial port with a height sensor and weight scale in real time.
4. **BIA (Bioelectrical Impedance Analysis)** — Drives a BIA module via serial port to collect leg impedance, arm impedance, and impedance at 20 kHz / 100 kHz to compute body composition metrics (body fat %, muscle mass, BMI, etc.).
5. **Cognitive Games** — Includes an embedded mini-game (*Smoothie Slash*, *Space Convoy*) used as a quick cognitive/motor screening tool.
6. **Colour Blindness Test** — An Ishihara-style colour vision screening.
7. **DMIT / Dermatoglyphics** — Fingerprint-based intelligence type screening.
8. **Results & Report** — Displays a rich visual BIA result report and syncs all data to the backend.

Each stage is driven by a **Redux-managed screening state machine** that resolves the next route dynamically from the API response.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Electron Shell                    │
│  ┌──────────────────┐   ┌─────────────────────────┐ │
│  │   Main Process   │   │     Renderer Process    │ │
│  │  (index.js)      │◄──│  React + Redux + Vite   │ │
│  │                  │   │                         │ │
│  │  Serial Port     │   │  React Router DOM       │ │
│  │  BIA Script      │   │  Framer Motion (anim.)  │ │
│  │  IPC Handlers    │   │  i18next (i18n)         │ │
│  │  Express Server  │   │  Tailwind CSS v4        │ │
│  └──────────────────┘   └─────────────────────────┘ │
└─────────────────────────────────────────────────────┘
          │                         │
          ▼                         ▼
   Hardware Sensors           Backend APIs
  (Height / BIA / Weight)   (FastAPI on :8000)
                             (Voice API on :9100)
                             (FPT API on :9000)
                             (Image Server on :5174)
```

- **Main process** (`src/main/index.js`): Manages the Electron window, serial port communication, BIA measurement logic (`bia-scriptv1.js`), and IPC bridge to the renderer.
- **Renderer process** (`src/renderer/`): The full React SPA — routing, UI components, Redux store, and API service calls.
- **Preload** (`src/preload/`): Secure context bridge that exposes only whitelisted IPC methods to the renderer.
- **Redux Store** (`src/store/`): Global state for screening session, student info, BIA data, and stage navigation.

---

## Key Features

| Feature | Details |
|---|---|
| 🎯 Face Identification | Video capture → FPT API → student match |
| 📏 Height Sensor | Real-time serial port reading with stability tracking |
| ⚖️ Weight / BIA | Full BIA module protocol via serial port |
| 🧠 Cognitive Games | Smoothie Slash & Space Convoy mini-games |
| 🎨 Colour Blindness | Embedded Ishihara screening |
| 🖐 DMIT | Dermatoglyphic intelligence profiling |
| 📊 BIA Report | Detailed body composition results with charts |
| 🌐 i18n | Multi-language support via i18next |
| 🔄 Stage Machine | API-driven dynamic stage routing |
| 🖥️ Kiosk Mode | Full-screen, touch-friendly, scaled UI |

---

## Hardware Requirements

| Device | Interface | Default Path |
|---|---|---|
| Height Sensor | Serial (USB) | `/dev/height_sensor` |
| BIA / Weight Module | Serial (USB) | `/dev/bia_module` |
| Camera | USB / Built-in | Auto-detected |

> Serial port paths are fully configurable via `.env` (see [Environment Configuration](#environment-configuration)).

---

## Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- **Python** ≥ 3.8 (required by `node-gyp` for native modules like `serialport`)
- **Build tools**: `gcc`, `make` (Linux) / Visual Studio Build Tools (Windows) / Xcode CLI (macOS)

---

## Project Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd suhi-v0
```

### 2. Install dependencies

```bash
npm install
```

> **Note:** `serialport` and `loudness` are native Node.js modules. `postinstall` will automatically rebuild them for your platform via `electron-builder install-app-deps`.

### 3. Configure environment

Copy the example environment file and fill in your values:

```bash
cp .env .env.local
```

Edit `.env.local` — see [Environment Configuration](#environment-configuration) for all available keys.

---

## Environment Configuration

Create a `.env` file in the project root. All variables are prefixed with `VITE_` and accessible in the renderer via `import.meta.env`.

```env
# ── Kiosk Identity ──────────────────────────────────
VITE_KIOSK_ID=KIOSK_001

# ── API Base URLs ────────────────────────────────────
VITE_API_BASE_URL=http://127.0.0.1:8000       # Main backend (FastAPI)
VITE_VOICE_API_BASE_URL=http://127.0.0.1:9100 # Voice/audio API
VITE_FPT_API_BASE_URL=http://127.0.0.1:9000   # Face Processing API
VITE_IMAGE_SERVER_URL=http://127.0.0.1:5174   # Image server

# ── Video Capture ────────────────────────────────────
VITE_VIDEO_DURATION=2000   # Recording duration in ms (2000 = 2s)

# ── Serial Port Configuration ────────────────────────
VITE_HEIGHT_PORT_PATH=/dev/height_sensor
VITE_HEIGHT_PORT_INDEX=1
VITE_BIA_PORT_PATH=/dev/bia_module
VITE_BIA_PORT_INDEX=0

VITE_SERIAL_BAUD_RATE=9600
VITE_SERIAL_DATA_BITS=8
VITE_SERIAL_STOP_BITS=1
VITE_SERIAL_PARITY=none

# ── Measurement Timeouts (ms) ────────────────────────
VITE_PORT_CONNECT_TIMEOUT=5000
VITE_PORT_READ_TIMEOUT=10000
VITE_WEIGHT_MEASUREMENT_TIMEOUT=6000
VITE_HEIGHT_MEASUREMENT_TIMEOUT=10000
VITE_LEG_IMPEDANCE_TIMEOUT=15000
VITE_ARM_IMPEDANCE_TIMEOUT=15000
VITE_IMPEDANCE_20KHZ_TIMEOUT=20000
VITE_IMPEDANCE_100KHZ_TIMEOUT=20000
```

---

## Running in Development

```bash
npm run dev
```

This starts the **electron-vite** dev server with HMR (Hot Module Replacement) for the renderer and restarts the main process on changes.

Other useful scripts:

```bash
npm run lint      # Run ESLint
npm run format    # Run Prettier
npm start         # Preview production build locally (electron-vite preview)
```

---

## Building for Production

```bash
# Windows (.exe installer via NSIS)
npm run build:win

# macOS (.dmg)
npm run build:mac

# Linux (.deb)
npm run build:linux

# Unpackaged directory (for quick testing)
npm run build:unpack
```

Build output is placed in the `dist/` directory. The app ID is `com.suhi.smooth`.

---

## Project Structure

```
suhi-v0/
├── build/                    # Icons and electron-builder assets
│   └── icons/
├── resources/                # Bundled runtime resources (audio, etc.)
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.js          # App entry, window setup, IPC handlers
│   │   ├── bia-scriptv1.js   # BIA hardware communication logic
│   │   └── eventbus.js       # Internal event emitter
│   ├── preload/              # Context bridge (main ↔ renderer)
│   ├── renderer/
│   │   └── src/
│   │       ├── App.jsx       # Root component & router
│   │       ├── components/   # All UI components
│   │       │   ├── bia/      # BIA measurement & results screens
│   │       │   ├── games/    # Smoothie Slash, Space Convoy
│   │       │   ├── color-blindness/
│   │       │   ├── dmit/
│   │       │   ├── forms/
│   │       │   ├── voice/
│   │       │   └── ui/       # Shared UI primitives
│   │       ├── services/     # Axios API service functions
│   │       ├── utils/        # config.js, api helpers, route utils
│   │       ├── hooks/        # Custom React hooks
│   │       ├── hoc/          # Higher-order components
│   │       └── config/       # i18n and app-level config
│   └── store/                # Redux store & slices
├── .env                      # Environment variables (see above)
├── electron-builder.yml      # Packaging & distribution config
├── electron.vite.config.mjs  # Vite config for electron-vite
└── package.json
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Shell | Electron 39 |
| Build Tool | electron-vite 5 + Vite 7 |
| UI Framework | React 19 |
| State Management | Redux Toolkit 2 |
| Routing | React Router 7 |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion 12 |
| Icons | Lucide React |
| i18n | i18next + react-i18next |
| HTTP Client | Axios |
| Serial Port | serialport 13 |
| Linting | ESLint 9 |
| Formatting | Prettier 3 |

---

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)