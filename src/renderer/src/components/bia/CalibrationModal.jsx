import React, { useState } from 'react'
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
      width: '44px', height: '44px', borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '18px', fontWeight: 700, fontFamily: "'Anta', sans-serif",
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
      fontSize: '12px', fontFamily: "'Anta', sans-serif",
      textAlign: 'center', whiteSpace: 'nowrap'
    }}>{label}</span>
  </div>
)

const StepLine = ({ done }) => (
  <div style={{
    flex: 1, height: '2px', marginTop: '-22px', marginBottom: '22px',
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
    error:   { bg: 'rgba(255,80,80,0.15)',  border: '#ff5050', text: '#ff5050' },
    info:    { bg: 'rgba(0,179,255,0.12)',  border: '#00B3FF', text: '#9ad9ff' },
    warn:    { bg: 'rgba(255,185,0,0.12)',  border: '#ffb900', text: '#ffb900' },
  }
  const c = colors[type] || colors.info
  return (
    <div style={{
      padding: '10px 20px', borderRadius: '30px',
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.text, fontSize: '15px', fontFamily: "'Anta', sans-serif",
      textAlign: 'center', animation: 'calFadeIn 0.3s ease',
    }}>
      {text}
    </div>
  )
}

/* ─── Instruction card ─────────────────────────────────────────────────────── */
const InfoCard = ({ children }) => (
  <div style={{
    background: 'rgba(0,179,255,0.06)', border: '1px solid rgba(0,179,255,0.15)',
    borderRadius: '16px', padding: '20px', marginBottom: '20px',
  }}>
    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px', margin: 0, lineHeight: 1.6, fontFamily: 'sans-serif' }}>
      {children}
    </p>
  </div>
)

/* ─── Primary button ───────────────────────────────────────────────────────── */
const PrimaryBtn = ({ onClick, disabled, busy, children }) => (
  <button
    onClick={onClick}
    disabled={disabled || busy}
    style={{
      width: '100%', height: '60px', borderRadius: '20px',
      background: (disabled || busy)
        ? 'rgba(0,179,255,0.1)'
        : 'radial-gradient(43.11% 181.04% at 50% 50%, #003FFD 0%, #00B3FF 100%)',
      border: '2px solid rgba(0,179,255,0.5)',
      boxShadow: (disabled || busy) ? 'none' : '0 0 30px rgba(0,179,255,0.4)',
      color: 'white', fontSize: '19px',
      cursor: (disabled || busy) ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
      transition: 'all 0.2s', fontFamily: "'Anta', sans-serif",
    }}
  >
    {children}
  </button>
)

/* ─── Result row ───────────────────────────────────────────────────────────── */
const ResultRow = ({ label, value }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between',
    padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)'
  }}>
    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontFamily: 'sans-serif' }}>{label}</span>
    <span style={{ color: '#9ad9ff', fontSize: '14px', fontFamily: 'monospace' }}>{value}</span>
  </div>
)

/* ─── Main CalibrationModal ────────────────────────────────────────────────── */
/**
 * CalibrationModal — 4-step multi-point calibration
 *
 * Step 1: Connect to BIA port
 * Step 2: Tare at 0 kg (captures zeroOffset)
 * Step 3: Place 50 kg reference → read stable raw, compute factor50
 * Step 4: Place 100 kg reference → read stable raw, compute factor100
 *         → avgFactor = (factor50 + factor100) / 2 → persist to disk
 *
 * Props:
 *   onClose()   — close without completing
 *   onDone(cal) — called with updated calibration after success
 */
export default function CalibrationModal({ onClose, onDone }) {
  // step: 1=connect, 2=tare, 3=cal50, 4=cal100, 5=done
  const [step, setStep]         = useState(1)
  const [busy, setBusy]         = useState(false)
  const [status, setStatus]     = useState(null)   // { type, text }
  const [tareResult, setTareResult]   = useState(null)
  const [point50, setPoint50]   = useState(null)   // { factor, rawAvg, netRaw }
  const [point100, setPoint100] = useState(null)
  const [finalCal, setFinalCal] = useState(null)

  const biaPort = PORT_PATHS.BIA

  /* ── Step 1: Connect ─────────────────────────────────────────────────────── */
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

  /* ── Step 2: Tare (0 kg) ─────────────────────────────────────────────────── */
  const handleTare = async () => {
    setBusy(true)
    setStatus({ type: 'info', text: 'Reading zero point — ensure scale is completely empty…' })
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

  /* ── Step 3: 50 kg calibration point ────────────────────────────────────── */
  const handleCal50 = async () => {
    setBusy(true)
    setStatus({ type: 'info', text: 'Reading scale with 50 kg reference — please wait…' })
    try {
      const result = await window.api.runMultipointCalibration(50, biaPort)
      if (result?.success) {
        setPoint50(result)
        setStatus({ type: 'success', text: `50 kg point captured — factor: ${result.factor.toFixed(6)}` })
        setTimeout(() => { setStatus(null); setStep(4) }, 1200)
      } else {
        setStatus({ type: 'error', text: `50 kg calibration failed: ${result?.error || 'Unknown error'}` })
      }
    } catch (err) {
      setStatus({ type: 'error', text: `Error: ${err.message}` })
    } finally {
      setBusy(false)
    }
  }

  /* ── Step 4: 100 kg calibration point + finalize ─────────────────────────── */
  const handleCal100 = async () => {
    setBusy(true)
    setStatus({ type: 'info', text: 'Reading scale with 100 kg reference — please wait…' })
    try {
      const result = await window.api.runMultipointCalibration(100, biaPort)
      if (result?.success) {
        setPoint100(result)

        // Average the two factors
        const avgFactor = (point50.factor + result.factor) / 2
        setStatus({ type: 'info', text: `Computing averaged factor: ${avgFactor.toFixed(6)}…` })

        // Persist
        const applyResult = await window.api.applyAveragedFactor(avgFactor)
        if (applyResult?.success) {
          setFinalCal(applyResult.calibration)
          setStatus({ type: 'success', text: `Calibration complete! Avg factor: ${avgFactor.toFixed(6)}` })
          setStep(5)
        } else {
          setStatus({ type: 'error', text: `Failed to save factor: ${applyResult?.error || 'Unknown error'}` })
        }
      } else {
        setStatus({ type: 'error', text: `100 kg calibration failed: ${result?.error || 'Unknown error'}` })
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

  const stepLabels = ['Connect', 'Tare 0 kg', '50 kg', '100 kg']

  return (
    <>
      <style>{CAL_STYLES}</style>

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
          width: 'min(680px, 92vw)',
          background: 'rgba(8,15,30,0.97)',
          border: '1px solid rgba(0,179,255,0.25)',
          borderRadius: '28px',
          boxShadow: '0 0 60px rgba(0,63,253,0.2), 0 40px 100px rgba(0,0,0,0.7)',
          padding: '36px 40px',
          animation: 'calSlideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
          fontFamily: "'Anta', sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <h2 style={{ color: '#9ad9ff', fontSize: '26px', margin: 0, fontWeight: 700, letterSpacing: '0.03em' }}>
              ⚖️ Scale Calibration
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', margin: '6px 0 0', fontFamily: 'sans-serif' }}>
              3-point calibration (0 kg → 50 kg → 100 kg) — results averaged &amp; saved permanently
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

        {/* Step indicator — 4 steps */}
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '32px' }}>
          <StepDot num={1} label="Connect"  active={step === 1} done={step > 1} />
          <StepLine done={step > 1} />
          <StepDot num={2} label="Tare 0 kg" active={step === 2} done={step > 2} />
          <StepLine done={step > 2} />
          <StepDot num={3} label="50 kg"    active={step === 3} done={step > 3} />
          <StepLine done={step > 3} />
          <StepDot num={4} label="100 kg"   active={step === 4} done={step >= 5} />
        </div>

        {/* ── STEP 1: Connect ── */}
        {step === 1 && (
          <div style={{ animation: 'calFadeIn 0.3s ease' }}>
            <InfoCard>
              1. Make sure the <strong style={{ color: '#9ad9ff' }}>BIA scale</strong> is plugged in via USB.<br />
              2. Ensure the scale is <strong style={{ color: '#9ad9ff' }}>completely empty</strong> (no weight on it).<br />
              3. Click <strong style={{ color: '#9ad9ff' }}>Connect</strong> to proceed.
              {biaPort && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
                  Port: {biaPort}
                </div>
              )}
            </InfoCard>
            {status && <div style={{ marginBottom: '16px' }}><StatusPill {...status} /></div>}
            <PrimaryBtn onClick={handleConnect} busy={busy}>
              {busy ? <><Spinner size={26} /> Connecting…</> : '🔌 Connect Scale'}
            </PrimaryBtn>
          </div>
        )}

        {/* ── STEP 2: Tare (0 kg) ── */}
        {step === 2 && (
          <div style={{ animation: 'calFadeIn 0.3s ease' }}>
            <InfoCard>
              ✅ Scale connected!<br /><br />
              <strong style={{ color: '#ff9f40' }}>Remove everything from the scale.</strong><br />
              The scale must be completely empty at 0 kg.<br />
              Click <strong style={{ color: '#9ad9ff' }}>Read Zero (0 kg)</strong> to capture the baseline offset.
            </InfoCard>
            {/* Weight label */}
            <div style={{
              textAlign: 'center', fontSize: '56px', fontWeight: 700,
              color: 'rgba(255,255,255,0.15)', letterSpacing: '0.05em', marginBottom: '16px'
            }}>
              0 <span style={{ fontSize: '24px' }}>kg</span>
            </div>
            {status && <div style={{ marginBottom: '16px' }}><StatusPill {...status} /></div>}
            <PrimaryBtn onClick={handleTare} busy={busy}>
              {busy ? <><Spinner size={26} /> Reading zero…</> : '📏 Read Zero (0 kg)'}
            </PrimaryBtn>
          </div>
        )}

        {/* ── STEP 3: 50 kg ── */}
        {step === 3 && (
          <div style={{ animation: 'calFadeIn 0.3s ease' }}>
            <InfoCard>
              Zero offset captured ✅<br /><br />
              Now place a <strong style={{ color: '#ff9f40' }}>50 kg reference weight</strong> on the scale.<br />
              Stand still and wait for a stable reading, then click <strong style={{ color: '#9ad9ff' }}>Read 50 kg</strong>.
            </InfoCard>
            {/* Weight label */}
            <div style={{
              textAlign: 'center', fontSize: '56px', fontWeight: 700,
              color: '#9ad9ff', letterSpacing: '0.05em', marginBottom: '16px'
            }}>
              50 <span style={{ fontSize: '24px', color: 'rgba(255,255,255,0.4)' }}>kg</span>
            </div>
            {/* Tare info */}
            {tareResult && (
              <div style={{ marginBottom: '12px', textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
                Zero offset: {tareResult.zeroOffset.toFixed(4)} raw
              </div>
            )}
            {status && <div style={{ marginBottom: '16px' }}><StatusPill {...status} /></div>}
            <PrimaryBtn onClick={handleCal50} busy={busy}>
              {busy ? <><Spinner size={26} /> Reading 50 kg…</> : '⚖️ Read 50 kg'}
            </PrimaryBtn>
          </div>
        )}

        {/* ── STEP 4: 100 kg ── */}
        {step === 4 && (
          <div style={{ animation: 'calFadeIn 0.3s ease' }}>
            <InfoCard>
              50 kg point captured ✅<br /><br />
              Now place a <strong style={{ color: '#ff9f40' }}>100 kg reference weight</strong> on the scale.<br />
              Stand still and wait for a stable reading, then click <strong style={{ color: '#9ad9ff' }}>Read 100 kg</strong>.
            </InfoCard>
            {/* Weight label */}
            <div style={{
              textAlign: 'center', fontSize: '56px', fontWeight: 700,
              color: '#9ad9ff', letterSpacing: '0.05em', marginBottom: '16px'
            }}>
              100 <span style={{ fontSize: '24px', color: 'rgba(255,255,255,0.4)' }}>kg</span>
            </div>
            {/* 50 kg factor preview */}
            {point50 && (
              <div style={{ marginBottom: '12px', textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
                50 kg factor: {point50.factor.toFixed(6)}
              </div>
            )}
            {status && <div style={{ marginBottom: '16px' }}><StatusPill {...status} /></div>}
            <PrimaryBtn onClick={handleCal100} busy={busy}>
              {busy ? <><Spinner size={26} /> Reading 100 kg…</> : '⚖️ Read 100 kg'}
            </PrimaryBtn>
          </div>
        )}

        {/* ── STEP 5: Success ── */}
        {step === 5 && finalCal && (
          <div style={{ animation: 'calFadeIn 0.4s ease', textAlign: 'center' }}>
            <div style={{ fontSize: '68px', marginBottom: '14px', animation: 'calPulse 1.5s ease-in-out 2' }}>🎉</div>
            <h3 style={{ color: '#00c97a', fontSize: '26px', margin: '0 0 6px' }}>
              Calibration Complete!
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.45)', margin: '0 0 20px', fontSize: '13px', fontFamily: 'sans-serif' }}>
              Averaged factor from 50 kg &amp; 100 kg readings — saved to disk.
            </p>

            {/* Summary card */}
            <div style={{
              background: 'rgba(0,201,122,0.06)', border: '1px solid rgba(0,201,122,0.25)',
              borderRadius: '16px', padding: '18px', marginBottom: '24px', textAlign: 'left',
            }}>
              {point50 && <ResultRow label="50 kg factor"   value={point50.factor.toFixed(6)} />}
              {point100 && <ResultRow label="100 kg factor" value={point100.factor.toFixed(6)} />}
              <ResultRow label="Averaged factor"   value={finalCal.factor.toFixed(6)} />
              <ResultRow label="Zero offset"       value={finalCal.zeroOffset.toFixed(4) + ' raw'} />
              <ResultRow label="Calibrated at"     value={new Date(finalCal.calibratedAt).toLocaleString()} />
            </div>

            <button
              onClick={handleDone}
              style={{
                width: '100%', height: '60px', borderRadius: '20px',
                background: 'radial-gradient(circle, #00a060, #005030)',
                border: '2px solid rgba(0,201,122,0.5)',
                boxShadow: '0 0 30px rgba(0,201,122,0.3)',
                color: 'white', fontSize: '19px', cursor: 'pointer',
                fontFamily: "'Anta', sans-serif",
              }}
            >Done</button>
          </div>
        )}
      </div>
    </>
  )
}
