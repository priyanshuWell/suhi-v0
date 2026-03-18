import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import LoginComponent from '../ui/LoginComponent'
import fingerprintImg from '../../assets/fingerprint.svg'
import BlueGradientButton from '../ui/BlueGradientButton'
import BlackGradientButton from '../ui/BlackGradientButton'
import KeyboardContainer from '../ui/KeyboardContainer'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

const LoginSuhi = () => {
  const navigate = useNavigate()
  const [suhiId, setSuhiId] = useState('')
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isButtonDisabled = !suhiId.trim() || loading

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Backspace') {
        setSuhiId(v => v.slice(0, -1))
        setError('')
      } else if (e.key === 'Enter') {
        handleNext()
      } else if (e.key.length === 1) {
        setSuhiId(v => v + e.key)
        setError('')
        setKeyboardVisible(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [suhiId, loading])

  const handleNext = async () => {
    if (!suhiId.trim()) return

    setLoading(true)
    setError('')

    try {
      const fullSuhiId = `DPKS${suhiId}`
      const response = await fetch(`${API_BASE_URL}/kiosk_user/${fullSuhiId}`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('User not found. Please check your Suhi ID.')
        }
        throw new Error('Something went wrong. Please try again.')
      }

      const data = await response.json()

      // Navigate to next screen, passing user data along
      navigate('/login-dob', { state: { user: data, suhiId: fullSuhiId } })
    } catch (err) {
      setError(err.message || 'Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed top-1/16 left-1/2 -translate-x-1/2 z-30 w-[600px]">
        <p className="text-5xl text-center font-light leading-snug text-white">
          Log in using your ID or fingerprint
        </p>
      </div>
      <LoginComponent />

      {/* form */}
      <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px]">
        <div className="w-full flex flex-col gap-10 cursor-pointer">
          <div className="suhi-id">
            <div className="leading-[28px] relative text-white text-xl tracking-wide">
              Suhi ID{' '}
              <span className="text-[#ff0000cc] font-['Noto_Sans'] absolute">*</span>
            </div>
            <div className="relative min-h-[50px] text-3xl flex items-center">
              <p className="absolute left-2 text-white">DPKS</p>
              <div className="border-t-2 border-white w-10 mt-2 h-12 rotate-90 absolute left-12" />
              <input
                type="text"
                value={suhiId}
                readOnly
                className="w-full bg-transparent border-none outline-none text-white pl-28 caret-transparent"
                onFocus={() => {
                  setKeyboardVisible(true)
                  setError('')
                }}
              />
            </div>
            <div className="border-t-2 border-white w-full mt-2" />

            {/* Error message */}
            {error && (
              <p className="text-red-400 text-sm mt-3 text-center animate-pulse">
                {error}
              </p>
            )}
          </div>

          <p className="text-center text-white text-4xl">Or</p>
          <p className="text-center text-white text-2xl">
            Place your thumb on the fingerprint scanner below the screen.
          </p>

          <div className="fingerprint flex flex-col justify-center items-center">
            <button
              onClick={() => navigate('/fingerprint')}
              className="border border-white cursor-pointer rounded-3xl p-6 w-[100px]"
            >
              <img src={fingerprintImg} alt="finger-print" />
            </button>
          </div>
        </div>
      </div>

      <div className="fixed top-[62%] left-1/2 -translate-x-1/2 -translate-y-1/2">
        <BlueGradientButton
          disabled={isButtonDisabled}
          width={'w-[clamp(16rem,32vw,31.25rem)]'}
          onClick={handleNext}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-3">
              <svg
                className="animate-spin h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12" cy="12" r="10"
                  stroke="white" strokeWidth="3" opacity="0.3"
                />
                <path
                  d="M12 2a10 10 0 019.8 8"
                  stroke="white" strokeWidth="3" strokeLinecap="round"
                />
              </svg>
              Verifying...
            </span>
          ) : (
            'Next'
          )}
        </BlueGradientButton>
      </div>

      {keyboardVisible && (
        <KeyboardContainer
          onKeyPress={(k) => {
            setSuhiId((v) => v + k)
            setError('')
          }}
          onBackspace={() => {
            setSuhiId((v) => v.slice(0, -1))
            setError('')
          }}
          onSubmit={() => { setKeyboardVisible(false); handleNext() }}
          onClose={() => setKeyboardVisible(false)}
        />
      )}
    </>
  )
}

export default LoginSuhi