import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useDispatch } from 'react-redux'
import { setUser, setScreening } from '../../features/common/commonSlice'
import LoginComponent from '../ui/LoginComponent'
import fingerprintImg from '../../assets/fingerprint.svg'
import ArrowDown from '../../assets/ArrowDown.png'

const FingerPrintScreen = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [status, setStatus] = useState('waiting') // waiting | scanning | success | error
  const [message, setMessage] = useState('Place your thumb on the fingerprint scanner below the screen.')

  useEffect(() => {
    //  Listen for fingerprint scan result from main process via IPC
    if (!window.api?.onFingerprintResult) return
    const cleanup = window.api.onFingerprintResult((result) => {
      if (result?.success) {
        setStatus('success')
        setMessage('Fingerprint verified ')
        dispatch(setUser(result.user))
        dispatch(setScreening(result.screening))
        setTimeout(() => navigate('/register'), 800)
      } else {
        setStatus('error')
        setMessage('Fingerprint not recognised. Please try again.')
        setTimeout(() => setStatus('waiting'), 2000)
      }
    })
    return cleanup
  }, [dispatch, navigate])

  return (
    <>
      <div className="fixed top-1/16 left-1/2 -translate-x-1/2 z-30 w-[600px]">
        <p className="text-5xl text-center font-light leading-snug text-white ">
          Log in using fingerprint
        </p>
      </div>
      <LoginComponent />

      {/* form */}

      <div className="absolute top-[55%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px]">
        <div className="w-full flex flex-col gap-10 cursor-pointer ">

          <div className="fingerprint flex flex-col justify-center items-center">
            <button className="border border-white rounded-3xl p-6 w-[100px]">
              <img src={fingerprintImg} alt="finger-print" />
            </button>
                 <p className=" text-center text-white text-4xl mt-10   tracking-wide">
           Place your thumb on the fingerprint scanner below the screen.
          </p>
          </div>
          <div className='flex flex-col justify-center items-center w-full'>
             <img src={ArrowDown} alt="down-arrow" className='w-2/3 h-2/3' />
          </div>
        </div>
      </div>
    </>
  )
}

export default FingerPrintScreen