import React, { useState, useCallback } from 'react'

/* ─────────────── layout data ─────────────── */
const QWERTY_ROWS = [
  [
    { main: 'Q', sub: '%' }, { main: 'W', sub: '^' }, { main: 'E', sub: '~' },
    { main: 'R', sub: '|' }, { main: 'T', sub: '[' }, { main: 'Y', sub: ']' },
    { main: 'U', sub: '<' }, { main: 'I', sub: '>' }, { main: 'O', sub: '{' },
    { main: 'P', sub: '}' },
  ],
  [
    { main: 'A', sub: '@' }, { main: 'S', sub: '#' }, { main: 'D', sub: '&' },
    { main: 'F', sub: '*' }, { main: 'G', sub: '-' }, { main: 'H', sub: '+' },
    { main: 'J', sub: '=' }, { main: 'K', sub: '(' }, { main: 'L', sub: ')' },
  ],
  [
    { main: 'Z', sub: '_' }, { main: 'X', sub: '₹' }, { main: 'C', sub: '"' },
    { main: 'V', sub: "'" }, { main: 'B', sub: ':' }, { main: 'N', sub: ';' },
    { main: 'M', sub: '/' },
  ],
]

const NUMPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['del', '0', 'ok'],
]

/* ─────────────── shared constants ─────────────── */
const CYAN = '#46a8cb'
const GREY = '#797980'
const KEY_BG = '#262626'
const GLOW = '0 4px 5px rgba(68,171,190,0.35)'
const GLOW_ACTIVE = '0 0 16px 3px rgba(0,230,255,0.4), 0 4px 8px rgba(68,171,190,0.5)'

/* ─────────────── icons ─────────────── */
const DeleteIcon = () => (
  <svg width="28" height="22" viewBox="0 0 44 34" fill="none">
    <path d="M14 2h25a3 3 0 013 3v24a3 3 0 01-3 3H14l-12-15 12-15z"
      stroke={CYAN} strokeWidth="2.2" fill="none" strokeLinejoin="round" />
    <path d="M22 12l8 10M30 12l-8 10"
      stroke={CYAN} strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const CheckIcon = () => (
  <svg width="34" height="28" viewBox="0 0 48 38" fill="none">
    <path d="M6 20l13 13L42 5" stroke={CYAN} strokeWidth="4.5"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ filter: 'drop-shadow(0 0 6px rgba(70,168,203,0.5))' }} />
  </svg>
)

const CapsIcon = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ opacity: active ? 1 : 0.65 }}>
    <path d="M12 3L3 14h5v5h8v-5h5L12 3z"
      stroke={CYAN} strokeWidth="1.8" fill={active ? 'rgba(70,168,203,0.2)' : 'none'} strokeLinejoin="round" />
  </svg>
)

const MicIcon = () => (
  <svg width="16" height="22" viewBox="0 0 18 28" fill="none">
    <rect x="5" y="1" width="8" height="15" rx="4" stroke={CYAN} strokeWidth="1.5" />
    <path d="M1 13c0 5 3.5 8 8 8s8-3 8-8" stroke={CYAN} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="9" y1="21" x2="9" y2="26" stroke={CYAN} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const EmojiIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke={CYAN} strokeWidth="1.5" />
    <circle cx="9" cy="10" r="1.2" fill={CYAN} />
    <circle cx="15" cy="10" r="1.2" fill={CYAN} />
    <path d="M8 14.5c1.5 2 6.5 2 8 0" stroke={CYAN} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
)

const EnterIcon = () => (
  <svg width="26" height="20" viewBox="0 0 28 22" fill="none">
    <path d="M24 2v10a4 4 0 01-4 4H5" stroke={CYAN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 11l-5 5 5 5" stroke={CYAN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke={CYAN} strokeWidth="2" strokeLinecap="round" />
  </svg>
)

/* ─────────────── reusable key button ─────────────── */
function Key({ id, active, onPress, onRelease, children, style = {} }) {
  const isDown = active === id
  return (
    <button
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
        borderRadius: 12,
        border: 'none', outline: 'none',
        cursor: 'pointer',
        background: isDown ? '#333' : KEY_BG,
        boxShadow: isDown ? GLOW_ACTIVE : GLOW,
        transform: isDown ? 'scale(0.95)' : 'scale(1)',
        transition: 'all 0.08s ease',
        WebkitTapHighlightColor: 'transparent',
        overflow: 'hidden',
        padding: 0,
        ...style,
      }}
      onPointerDown={() => onPress(id)}
      onPointerUp={onRelease}
      onPointerLeave={onRelease}
    >
      {children}
    </button>
  )
}

/* ═══════════════ QWERTY KEYBOARD ═══════════════ */
function QwertyKeyboard({ onKeyPress, onBackspace, onSubmit, onSwitchNumeric }) {
  const [active, setActive] = useState(null)
  const [caps, setCaps] = useState(false)
  const press = (id) => setActive(id)
  const release = () => setActive(null)

  const letterKey = (k) => {
    const display = caps ? k.main : k.main.toLowerCase()
    return (
      <Key key={k.main} id={`l-${k.main}`} active={active} onPress={(id) => { press(id); onKeyPress(display) }} onRelease={release}
        style={{ aspectRatio: '1 / 1.05', padding: '3px 0' }}>
        <span style={{ color: GREY, fontSize: 'clamp(10px, 2.2vw, 16px)', lineHeight: 1, marginBottom: 1 }}>{k.sub}</span>
        <span style={{ color: CYAN, fontSize: 'clamp(16px, 3.8vw, 28px)', fontWeight: 400, lineHeight: 1 }}>{display}</span>
      </Key>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {/* QWERTY row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 5 }}>
        {QWERTY_ROWS[0].map(letterKey)}
      </div>

      {/* ASDF row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 5, padding: '0 5%' }}>
        {QWERTY_ROWS[1].map(letterKey)}
      </div>

      {/* ZXCV row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr repeat(7, 1fr) 1.3fr', gap: 5 }}>
        {/* CapsLock */}
        <Key id="caps" active={active}
          onPress={() => { press('caps'); setCaps(c => !c) }} onRelease={release}
          style={{ background: caps ? 'rgba(70,168,203,0.12)' : 'rgba(217,217,217,0.05)', boxShadow: 'none', border: caps ? '1px solid rgba(70,168,203,0.25)' : 'none' }}>
          <CapsIcon active={caps} />
        </Key>
        {QWERTY_ROWS[2].map(letterKey)}
        {/* Delete */}
        <Key id="del-q" active={active}
          onPress={(id) => { press(id); onBackspace() }} onRelease={release}
          style={{ background: 'rgba(217,217,217,0.05)', boxShadow: 'none' }}>
          <DeleteIcon />
        </Key>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 4fr 1fr 1fr', gap: 5, padding: '0 4px', height: 77 }}>
        {/* 123 */}
        <Key id="123" active={active}
          onPress={() => { press('123'); onSwitchNumeric() }} onRelease={release}
          style={{ background: 'rgba(217,217,217,0.05)', boxShadow: 'none' }}>
          <span style={{ color: CYAN, fontSize: 'clamp(12px, 2.5vw, 18px)', fontWeight: 400 }}>123</span>
        </Key>
        {/* Emoji */}
        <Key id="emoji" active={active} onPress={() => press('emoji')} onRelease={release}
          style={{ background: 'rgba(217,217,217,0.05)', boxShadow: 'none' }}>
          <EmojiIcon />
        </Key>
        {/* Mic */}
        <Key id="mic" active={active} onPress={() => press('mic')} onRelease={release}
          style={{ background: 'rgba(217,217,217,0.05)', boxShadow: 'none' }}>
          <MicIcon />
        </Key>
        {/* Space */}
        <Key id="space" active={active}
          onPress={(id) => { press(id); onKeyPress(' ') }} onRelease={release}
          style={{ borderRadius: 14 }}>
          <div style={{ width: '100%', height: '100%' }} />
        </Key>
        {/* Punctuation */}
        <Key id="punct" active={active}
          onPress={(id) => { press(id); onKeyPress('.') }} onRelease={release}
          style={{ background: 'rgba(217,217,217,0.05)', boxShadow: 'none' }}>
          <span style={{ color: GREY, fontSize: 'clamp(10px, 2.2vw, 15px)' }}>,!?</span>
        </Key>
        {/* Enter / Submit */}
        <Key id="enter" active={active}
          onPress={(id) => { press(id); onSubmit() }} onRelease={release}
          style={{ background: 'transparent', boxShadow: 'none' }}>
          <EnterIcon />
        </Key>
      </div>
    </div>
  )
}

/* ═══════════════ NUMERIC KEYPAD ═══════════════ */
function NumericKeypad({ onKeyPress, onBackspace, onSubmit, onSwitchQwerty }) {
  const [active, setActive] = useState(null)
  const press = (id) => setActive(id)
  const release = () => setActive(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {NUMPAD_ROWS.map((row, ri) => (
        <div key={ri} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {row.map(key => {
            const isDel = key === 'del'
            const isOk = key === 'ok'
            return (
              <Key key={key} id={`np-${key}`} active={active}
                onPress={(id) => {
                  press(id)
                  if (isDel) onBackspace()
                  else if (isOk) onSubmit()
                  else onKeyPress(key)
                }}
                onRelease={release}
                style={{ height: 88 }}>
                {isDel ? <DeleteIcon /> : isOk ? <CheckIcon /> : (
                  <span style={{
                    color: CYAN, fontSize: 40, fontWeight: 400, lineHeight: 1,
                    textShadow: '0 0 8px rgba(70,168,203,0.25)'
                  }}>{key}</span>
                )}
              </Key>
            )
          })}
        </div>
      ))}

      {/* Switch to ABC */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
        <button
          style={{
            background: 'rgba(217,217,217,0.05)', border: 'none', outline: 'none',
            borderRadius: 10, padding: '10px 32px', cursor: 'pointer',
            color: CYAN, fontSize: 16, fontWeight: 400,
            WebkitTapHighlightColor: 'transparent',
          }}
          onClick={onSwitchQwerty}
        >
          ABC
        </button>
      </div>
    </div>
  )
}

/* ═══════════════ KEYBOARD CONTAINER ═══════════════ */
export default function KeyboardContainer({ onKeyPress, onBackspace, onSubmit, onClose }) {
  const [mode, setMode] = useState('qwerty') // 'qwerty' | 'numeric'

  return (
    <div
      onTouchStart={e => e.preventDefault()}
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 50,
        background: '#000',
        borderTop: '1px solid #1a1a1a',
        padding: '8px 8px 16px',
        boxSizing: 'border-box',
        fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif",
        animation: 'slideUp 0.25s ease-out',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>

      {/* Close / drag handle bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 6, padding: '0 4px',
      }}>
        <div style={{
          width: 40, height: 4, borderRadius: 2,
          background: '#333', margin: '0 auto',
        }} />
        <button
          onClick={onClose}
          style={{
            position: 'absolute', right: 14, top: 8,
            background: 'none', border: 'none', outline: 'none',
            cursor: 'pointer', padding: 4,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Active keyboard */}
      {mode === 'qwerty' ? (
        <QwertyKeyboard
          onKeyPress={onKeyPress}
          onBackspace={onBackspace}
          onSubmit={onSubmit}
          onSwitchNumeric={() => setMode('numeric')}
        />
      ) : (
        <NumericKeypad
          onKeyPress={onKeyPress}
          onBackspace={onBackspace}
          onSubmit={onSubmit}
          onSwitchQwerty={() => setMode('qwerty')}
        />
      )}
    </div>
  )
}