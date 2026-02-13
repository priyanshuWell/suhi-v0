import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import LoginComponent from '../ui/LoginComponent'
import fingerprintImg from '../../assets/fingerprint.svg'
import ArrowDown from '../../assets/ArrowDown.png'

const LoginSuhi = () => {
  const navigate = useNavigate()
  const [suhiId, setSuhiId] = useState('')

  const isButtonDisabled = !suhiId.trim()

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

export default LoginSuhi
