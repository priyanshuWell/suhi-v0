import React, { useState, useEffect, useRef } from 'react'
import { PORT_PATHS } from '../../utils/portConfig'

/* ─── keyframes injected once ─────────────────────────────────────────────── */
const CAL_STYLES = `
  @keyframes calPulse {
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50%       { opacity: 1;   transform: scale(1.08); }
  }
  @keyframes calSpin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes calFadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes calSlideUp {
    from { opacity: 0; transform: translateY(40px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes calGlow {
    0%, 100% { box-shadow: 0 0 20px rgba(0,179,255,0.3); }
    50%       { box-shadow: 0 0 50px rgba(0,179,255,0.7), 0 0 80px rgba(0,63,253,0.3); }
  }
`

/* ─── Step indicator ───────────────────────────────────────────────────────── */
const StepDot = ({ num, label, active, done }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
    <div style={{
      width: '48px', height: '48px', borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '20px', fontWeight: 700, fontFamily: "'Anta', sans-serif",
      transition: 'all 0.4s',
      background: done
        ? 'radial-gradient(circle, #00c97a, #006640)'
        : active
          ? 'radial-gradient(43.11% 181.04% at 50% 50%, #003FFD 0%, #00B3FF 100%)'
          : 'rgba(255,255,255,0.08)',
      border: `2px solid ${done ? '#00c97a' : active ? '#00B3FF' : 'rgba(255,255,255,0.2)'}`,
      color: 'white',
      boxShadow: active ? '0 0 20px rgba(0,179,255,0.5)' : 'none',
      animation: active ? 'calGlow 2s ease-in-out infinite' : 'none',
    }}>
      {done ? '✓' : num}
    </div>
    <span style={{
      color: active ? '#9ad9ff' : done ? '#00c97a' : 'rgba(255,255,255,0.4)',
      fontSize: '14px', fontFamily: "'Anta', sans-serif",
      textAlign: 'center', whiteSpace: 'nowrap'
    }}>{label}</span>
  </div>
)

const StepLine = ({ done }) => (
  <div style={{
    flex: 1, height: '2px', marginTop: '-24px', marginBottom: '24px',
    background: done
      ? 'linear-gradient(90deg, #00c97a, #006640)'
      : 'rgba(255,255,255,0.1)',
    transition: 'background 0.4s'
  }} />
)

/* ─── Spinner ──────────────────────────────────────────────────────────────── */
const Spinner = ({ size = 40 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    border: `${size / 10}px solid rgba(0,179,255,0.15)`,
    borderTopColor: '#00B3FF',
    animation: 'calSpin 0.9s linear infinite',
    flexShrink: 0
  }} />
)

/* ─── Status pill ──────────────────────────────────────────────────────────── */
const StatusPill = ({ type, text }) => {
  const colors = {
    success: { bg: 'rgba(0,201,122,0.15)', border: '#00c97a', text: '#00c97a' },
    error: { bg: 'rgba(255,80,80,0.15)', border: '#ff5050', text: '#ff5050' },
    info: { bg: 'rgba(0,179,255,0.12)', border: '#00B3FF', text: '#9ad9ff' },
    warn: { bg: 'rgba(255,185,0,0.12)', border: '#ffb900', text: '#ffb900' },
  }
  const c = colors[type] || colors.info
  return (
    <div style={{
      padding: '10px 20px', borderRadius: '30px',
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.text, fontSize: '16px', fontFamily: "'Anta', sans-serif",
      textAlign: 'center', animation: 'calFadeIn 0.3s ease',
    }}>
      {text}
    </div>
  )
}

/* ─── Main CalibrationModal ────────────────────────────────────────────────── */
/**
 * CalibrationModal
 * Props:
 *   onClose()   — close without completing
 *   onDone(cal) — called with updated calibration after full calibration succeeds
 */
export default function CalibrationModal({ onClose, onDone }) {
  const [step, setStep] = useState(1)        // 1 = connect, 2 = tare, 3 = calibrate
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null) // { type, text }
  const [tareResult, setTareResult] = useState(null)
  const [knownWeight, setKnownWeight] = useState('')
  const [finalCal, setFinalCal] = useState(null)
  const inputRef = useRef(null)

  const biaPort = PORT_PATHS.BIA

  /* ── Step 1: Connect BIA port ─────────────────────────────────────────── */
  const handleConnect = async () => {
    setBusy(true)
    setStatus({ type: 'info', text: 'Connecting to BIA scale…' })
    try {
      const result = await window.api.connectBiaPort(biaPort)
      if (result?.success === false) {
        setStatus({ type: 'error', text: `Connection failed: ${result.error || 'Unknown error'}` })
      } else {
        setStatus({ type: 'success', text: `Connected to ${biaPort}` })
        setTimeout(() => { setStatus(null); setStep(2) }, 1000)
      }
    } catch (err) {
      setStatus({ type: 'error', text: `Error: ${err.message}` })
    } finally {
      setBusy(false)
    }
  }

  /* ── Step 2: Tare ─────────────────────────────────────────────────────── */
  const handleTare = async () => {
    setBusy(true)
    setStatus({ type: 'info', text: 'Reading zero point — ensure scale is empty…' })
    try {
      const result = await window.api.runTare(biaPort)
      if (result?.success) {
        setTareResult(result.calibration)
        setStatus({ type: 'success', text: `Zero offset captured: ${result.calibration.zeroOffset.toFixed(4)} raw` })
        setTimeout(() => { setStatus(null); setStep(3) }, 1200)
      } else {
        setStatus({ type: 'error', text: `Tare failed: ${result?.error || 'Unknown error'}` })
      }
    } catch (err) {
      setStatus({ type: 'error', text: `Error: ${err.message}` })
    } finally {
      setBusy(false)
    }
  }

  /* ── Step 3: Full calibration with known weight ───────────────────────── */
  const handleCalibrate = async () => {
    const kg = parseFloat(knownWeight)
    if (isNaN(kg) || kg <= 0) {
      setStatus({ type: 'warn', text: 'Please enter a valid weight (e.g. 20)' })
      inputRef.current?.focus()
      return
    }
    setBusy(true)
    setStatus({ type: 'info', text: `Reading scale with ${kg} kg reference…` })
    try {
      const result = await window.api.runFullCalibration(kg, biaPort)
      if (result?.success) {
        setFinalCal(result.calibration)
        setStatus({ type: 'success', text: `Calibration factor: ${result.calibration.factor.toFixed(6)}` })
      } else {
        setStatus({ type: 'error', text: `Calibration failed: ${result?.error || 'Unknown error'}` })
      }
    } catch (err) {
      setStatus({ type: 'error', text: `Error: ${err.message}` })
    } finally {
      setBusy(false)
    }
  }

  const handleDone = () => {
    onDone?.(finalCal)
    onClose?.()
  }

  /* ── Number pad input for known weight ───────────────────────────────── */
  const appendDigit = (d) => {
    setKnownWeight((prev) => {
      if (d === '.' && prev.includes('.')) return prev
      if (prev.length >= 5) return prev
      return prev + d
    })
  }
  const backspace = () => setKnownWeight((prev) => prev.slice(0, -1))

  const numPadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']

  return (
    <>
      {/* <style>{CAL_STYLES}</style> */}

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 210,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />

      {/* Modal card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed', zIndex: 211,
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(680px, 90vw)',
          background: 'rgba(8,15,30,0.95)',
          border: '1px solid rgba(0,179,255,0.25)',
          borderRadius: '28px',
          boxShadow: '0 0 60px rgba(0,63,253,0.2), 0 40px 100px rgba(0,0,0,0.7)',
          padding: '40px',
          animation: 'calSlideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
          fontFamily: "'Anta', sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
          <div>
            <h2 style={{ color: '#9ad9ff', fontSize: '28px', margin: 0, fontWeight: 700, letterSpacing: '0.03em' }}>
              ⚖️ Scale Calibration
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px', margin: '6px 0 0', fontFamily: 'sans-serif' }}>
              One-time setup — results are saved permanently
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '50%', width: '36px', height: '36px',
              color: 'rgba(255,255,255,0.5)', fontSize: '18px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >✕</button>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '36px' }}>
          <StepDot num={1} label="Connect" active={step === 1} done={step > 1} />
          <StepLine done={step > 1} />
          <StepDot num={2} label="Tare" active={step === 2} done={step > 2} />
          <StepLine done={step > 2} />
          <StepDot num={3} label="Calibrate" active={step === 3} done={!!finalCal} />
        </div>

        {/* ── STEP 1: Connect ── */}
        {step === 1 && (
          <div style={{ animation: 'calFadeIn 0.3s ease' }}>
            <div style={{
              background: 'rgba(0,179,255,0.06)', border: '1px solid rgba(0,179,255,0.15)',
              borderRadius: '16px', padding: '24px', marginBottom: '24px',
            }}>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '17px', margin: 0, lineHeight: 1.6, fontFamily: 'sans-serif' }}>
                1. Make sure the <strong style={{ color: '#9ad9ff' }}>BIA scale</strong> is plugged in via USB.<br />
                2. Ensure the scale is <strong style={{ color: '#9ad9ff' }}>empty</strong> (no weight on it).<br />
                3. Click <strong style={{ color: '#9ad9ff' }}>Connect</strong> to proceed.
              </p>
              {biaPort && (
                <div style={{ marginTop: '12px', fontSize: '13px', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
                  Port: {biaPort}
                </div>
              )}
            </div>
            {status && <div style={{ marginBottom: '16px' }}><StatusPill {...status} /></div>}
            <button
              onClick={handleConnect}
              disabled={busy}
              style={{
                width: '100%', height: '64px', borderRadius: '20px',
                background: busy ? 'rgba(0,179,255,0.1)' : 'radial-gradient(43.11% 181.04% at 50% 50%, #003FFD 0%, #00B3FF 100%)',
                border: '2px solid rgba(0,179,255,0.5)',
                boxShadow: busy ? 'none' : '0 0 30px rgba(0,179,255,0.4)',
                color: 'white', fontSize: '20px', cursor: busy ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                transition: 'all 0.2s', fontFamily: "'Anta', sans-serif",
              }}
            >
              {busy ? <><Spinner size={28} /> Connecting…</> : '🔌 Connect Scale'}
            </button>
          </div>
        )}

        {/* ── STEP 2: Tare ── */}
        {step === 2 && (
          <div style={{ animation: 'calFadeIn 0.3s ease' }}>
            <div style={{
              background: 'rgba(0,179,255,0.06)', border: '1px solid rgba(0,179,255,0.15)',
              borderRadius: '16px', padding: '24px', marginBottom: '24px',
            }}>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '17px', margin: 0, lineHeight: 1.6, fontFamily: 'sans-serif' }}>
                ✅ Scale connected!<br /><br />
                Now ensure the scale is <strong style={{ color: '#ff9f40' }}>completely empty</strong> with no weight on it.<br />
                Click <strong style={{ color: '#9ad9ff' }}>Read Zero</strong> to capture the baseline offset.
              </p>
            </div>
            {status && <div style={{ marginBottom: '16px' }}><StatusPill {...status} /></div>}
            <button
              onClick={handleTare}
              disabled={busy}
              style={{
                width: '100%', height: '64px', borderRadius: '20px',
                background: busy ? 'rgba(0,179,255,0.1)' : 'radial-gradient(43.11% 181.04% at 50% 50%, #003FFD 0%, #00B3FF 100%)',
                border: '2px solid rgba(0,179,255,0.5)',
                boxShadow: busy ? 'none' : '0 0 30px rgba(0,179,255,0.4)',
                color: 'white', fontSize: '20px', cursor: busy ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                transition: 'all 0.2s', fontFamily: "'Anta', sans-serif",
              }}
            >
              {busy ? <><Spinner size={28} /> Reading…</> : '📏 Read Zero Point'}
            </button>
          </div>
        )}

        {/* ── STEP 3: Full calibration ── */}
        {step === 3 && !finalCal && (
          <div style={{ animation: 'calFadeIn 0.3s ease' }}>
            <div style={{
              background: 'rgba(0,179,255,0.06)', border: '1px solid rgba(0,179,255,0.15)',
              borderRadius: '16px', padding: '24px', marginBottom: '24px',
            }}>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '17px', margin: '0 0 16px', lineHeight: 1.6, fontFamily: 'sans-serif' }}>
                Tare captured ✅<br /><br />
                Place a <strong style={{ color: '#ff9f40' }}>known reference weight</strong> on the scale.<br />
                Enter the exact weight in kg, then click <strong style={{ color: '#9ad9ff' }}>Calibrate</strong>.
              </p>

              {/* Weight display */}
              <div style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,179,255,0.25)',
                borderRadius: '14px', padding: '14px 20px',
                fontSize: '36px', color: knownWeight ? '#9ad9ff' : 'rgba(255,255,255,0.2)',
                textAlign: 'center', letterSpacing: '0.1em', fontVariantNumeric: 'tabular-nums',
                marginBottom: '16px', minHeight: '60px',
              }}>
                {knownWeight || '0'} <span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.4)' }}>kg</span>
              </div>

              {/* Number pad */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {numPadKeys.map((k) => (
                  <button
                    key={k}
                    onClick={() => k === '⌫' ? backspace() : appendDigit(k)}
                    style={{
                      height: '52px', borderRadius: '12px', fontSize: '20px',
                      background: k === '⌫' ? 'rgba(255,80,80,0.12)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${k === '⌫' ? 'rgba(255,80,80,0.3)' : 'rgba(255,255,255,0.12)'}`,
                      color: k === '⌫' ? '#ff8080' : 'white',
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: "'Anta', sans-serif",
                    }}
                  >{k}</button>
                ))}
              </div>
            </div>

            {status && <div style={{ marginBottom: '16px' }}><StatusPill {...status} /></div>}

            <button
              onClick={handleCalibrate}
              disabled={busy || !knownWeight}
              style={{
                width: '100%', height: '64px', borderRadius: '20px',
                background: (busy || !knownWeight)
                  ? 'rgba(0,179,255,0.1)'
                  : 'radial-gradient(43.11% 181.04% at 50% 50%, #003FFD 0%, #00B3FF 100%)',
                border: '2px solid rgba(0,179,255,0.5)',
                boxShadow: (busy || !knownWeight) ? 'none' : '0 0 30px rgba(0,179,255,0.4)',
                color: 'white', fontSize: '20px', cursor: (busy || !knownWeight) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                transition: 'all 0.2s', fontFamily: "'Anta', sans-serif",
              }}
            >
              {busy ? <><Spinner size={28} /> Calibrating…</> : '✅ Calibrate'}
            </button>
          </div>
        )}

        {/* ── SUCCESS STATE ── */}
        {finalCal && (
          <div style={{ animation: 'calFadeIn 0.4s ease', textAlign: 'center' }}>
            <div style={{
              fontSize: '72px', marginBottom: '16px',
              animation: 'calPulse 1.5s ease-in-out 2',
            }}>🎉</div>
            <h3 style={{ color: '#00c97a', fontSize: '28px', margin: '0 0 8px' }}>
              Calibration Complete!
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 24px', fontSize: '14px', fontFamily: 'sans-serif' }}>
              Values saved to disk and active immediately.
            </p>

            {/* Summary card */}
            <div style={{
              background: 'rgba(0,201,122,0.06)', border: '1px solid rgba(0,201,122,0.25)',
              borderRadius: '16px', padding: '20px', marginBottom: '28px', textAlign: 'left',
            }}>
              {[
                { label: 'Zero Offset', value: finalCal.zeroOffset.toFixed(4) + ' raw' },
                { label: 'Calibration Factor', value: finalCal.factor.toFixed(6) },
                { label: 'Calibrated At', value: new Date(finalCal.calibratedAt).toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontFamily: 'sans-serif' }}>{label}</span>
                  <span style={{ color: '#9ad9ff', fontSize: '14px', fontFamily: 'monospace' }}>{value}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleDone}
              style={{
                width: '100%', height: '64px', borderRadius: '20px',
                background: 'radial-gradient(circle, #00a060, #005030)',
                border: '2px solid rgba(0,201,122,0.5)',
                boxShadow: '0 0 30px rgba(0,201,122,0.3)',
                color: 'white', fontSize: '20px', cursor: 'pointer',
                fontFamily: "'Anta', sans-serif",
              }}
            >Done</button>
          </div>
        )}
      </div>
    </>
  )
}
