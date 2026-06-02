import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useDispatch } from 'react-redux'
import LoginComponent from '../ui/LoginComponent'
import fingerprintImg from '../../assets/fingerprint.svg'
import BlueGradientButton from '../ui/BlueGradientButton'
import BlackGradientButton from '../ui/BlackGradientButton'
import KeyboardContainer from '../ui/KeyboardContainer'
import ErrorAlert from '../ErrorAlert'
import { loginSuhi } from '../../utils/api'
import { setUser, setScreening } from '../../features/common/commonSlice'
import { getNextRoute } from '../../utils/stageRouter'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

const LoginSuhi = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [suhiId, setSuhiId] = useState('')
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showErrorAlert, setShowErrorAlert] = useState(false)
  const retryRef = useRef(0)

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
      const response = await loginSuhi(suhiId)

      // loginSuhi() returns { success, ...data } — not a raw Response object
      if (!response.success) {
        throw new Error(response.error || 'Something went wrong. Please try again.')
      }

      // Persist user and screening info to Redux
      dispatch(setUser(response))
      if (response.screening) {
        dispatch(setScreening(response.screening))
      }

      // Reset retry count on success
      retryRef.current = 0

      // If this is a resumed session, navigate directly to the correct next stage
      if (response.screening?.is_resumed && response.screening?.next_stage) {
        const nextRoute = getNextRoute(response.screening.next_stage, '/verified')
        console.log('[LoginSuhi] Resumed session — navigating to:', nextRoute)
        navigate(nextRoute)
      } else {
        // First login → show the user card for confirmation
        navigate('/verified')
      }
    } catch (err) {
      if (retryRef.current < 2) {
        setError(err.message || 'Network error. Retrying...')
        setShowErrorAlert(true)
      } else {
        setError('Maximum retries reached. Redirecting...')
        setTimeout(() => {
          retryRef.current = 0
          navigate('/welcome')
        }, 1500)
      }
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

      <ErrorAlert
        visible={showErrorAlert}
        title="Login Failed"
        description={error}
        onRetry={() => {
          setShowErrorAlert(false)
          retryRef.current += 1
          handleNext()
        }}
        onClose={() => {
          setShowErrorAlert(false)
          retryRef.current = 0
        }}
      />
    </>
  )
}

export default LoginSuhi