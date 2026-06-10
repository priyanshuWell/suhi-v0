import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useDispatch } from 'react-redux'
import LoginComponent from '../ui/LoginComponent'
import fingerprintImg from '../../assets/fingerprint.svg'
import profilePicFallback from '../../assets/profile-pic.png'
import BlueGradientButton from '../ui/BlueGradientButton'
import BlackGradientButton from '../ui/BlackGradientButton'
import KeyboardContainer from '../ui/KeyboardContainer'
import ErrorAlert from '../ErrorAlert'
import { loginSuhi, getStudentBySuhi } from '../../utils/api'
import { setUser, setScreening } from '../../features/common/commonSlice'
import { getNextRoute } from '../../utils/stageRouter'
import { useTranslation } from 'react-i18next'

const MAX_RETRIES = 2

const LoginSuhi = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const [suhiId, setSuhiId] = useState('')
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showErrorAlert, setShowErrorAlert] = useState(false)
  const [studentPhoto, setStudentPhoto] = useState(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const retryRef = useRef(0)
  const photoDebounceRef = useRef(null)

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
      // Verify student only when Next is clicked
      const response = await getStudentBySuhi(suhiId.trim())
      const normalizedUser = {
        ...response.data,
        suhi_id:
          response.suhi_id ||
          response.data?.suhi_id ||
          suhiId.trim()
      }

      if (!response.success || !response.data) {
        throw new Error('Student is not available. Please check your SUHI ID')
      }

      // Save student data
      dispatch(
        setUser({
          success: true,
          data: normalizedUser
        })
      )

      // Save screening if API returns it
      if (response.screening) {
        dispatch(setScreening(response.screening))
      }

      retryRef.current = 0

      // Go to RegisterCard
      navigate('/verified')
    } catch (err) {
      const attempt = retryRef.current + 1

      if (attempt < MAX_RETRIES) {
        retryRef.current = attempt
        setError(err.message || t('loginSuhi.student_not_found'))
        setShowErrorAlert(true)
      } else {
        retryRef.current = 0
        setError(t('loginSuhi.student_not_found'))
        setTimeout(() => {
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
          {t('loginSuhi.title')}
        </p>
      </div>
      <LoginComponent />

      {/* form */}
      <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px]">
        <div className="w-full flex flex-col gap-10 cursor-pointer">
          <div className="suhi-id">
            <div className="leading-[28px] relative text-white text-xl tracking-wide">
              {t('loginSuhi.id_label')}{' '}
              <span className="text-[#ff0000cc] font-['Noto_Sans'] absolute">*</span>
            </div>
            <div className="relative min-h-[50px] text-3xl flex items-center">
              {/* <p className="absolute left-2 text-white">DPKS</p> */}
              {/* <div className="border-t-2 border-white w-10 mt-2 h-12 rotate-90 absolute left-12" /> */}
              <input
                type="text"
                value={suhiId}
                autoCapitalize="characters"
                readOnly
                className="w-full bg-transparent border-none outline-none text-white  caret-transparent"
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
              {t('loginSuhi.verifying')}
            </span>
          ) : (
            t('common.next')
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
        title={t('loginSuhi.login_failed')}
        description={error}
        onRetry={() => {
          setShowErrorAlert(false)
          // handleNext()
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