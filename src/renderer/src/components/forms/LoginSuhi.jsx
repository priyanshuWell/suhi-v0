import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import LoginComponent from '../ui/LoginComponent'
import fingerprintImg from '../../assets/fingerprint.svg'
import GradientButton from '../ui/BlackGradientButton'
import BlueGradientButton from '../ui/BlueGradientButton'
import BlackGradientButton from '../ui/BlackGradientButton'

const LoginSuhi = () => {
  const navigate = useNavigate()
  const [suhiId, setSuhiId] = useState('')

  const isButtonDisabled = !suhiId.trim()

  return (
    <>
      <div className="fixed top-1/16 left-1/2 -translate-x-1/2 z-30 w-[600px]">
        <p className="text-5xl text-center font-light leading-snug text-white ">
          Log in using your ID or fingerprint
        </p>
      </div>
      <LoginComponent />

      {/* form */}

      <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px]">
        <div className="w-full flex flex-col gap-10 cursor-pointer ">
          <div className="suhi-id">
            <div className=" leading-[28px] relative text-white text-xl tracking-wide">
              Suhi ID <span className="text-[#ff0000cc] font-['Noto_Sans'] absolute">*</span>
            </div>
            <div className="min-h-[50px] text-3xl flex items-center">
              <input
                type="text"
                value={suhiId}
                onChange={(e) => setSuhiId(e.target.value)}
                placeholder="Enter Your Suhi ID"
                className="w-full bg-transparent border-none outline-none text-white placeholder:text-[rgba(255,255,255,0.5)]"
              />
            </div>
            <div className="border-t-2 border-white w-full mt-2" />
          </div>

          <p className=" text-center text-white text-4xl">Or</p>
          <p className=" text-center text-white text-2xl">
            Place your thumb on the fingerprint scanner below the screen.
          </p>

          <div className="fingerprint flex flex-col justify-center items-center">
            <button className="border border-white rounded-3xl p-6 w-[100px]">
              <img src={fingerprintImg} alt="finger-print" />
            </button>
          </div>
        </div>
      </div>

      <div className="fixed  top-[60%] left-1/2 -translate-x-1/2 -translate-y-1/2">
            <BlueGradientButton disabled={isButtonDisabled} width={'w-[clamp(16rem,32vw,31.25rem)]'}>Next </BlueGradientButton>
          </div>
      <div className="fixed left-1/2 bottom-[30%] -translate-x-1/2">
        <BlackGradientButton 
          width={'w-[clamp(16rem,33vw,31.25rem)]'} 
          padX={'px-3'}
          className='text-4xl'
          onClick={() => navigate('/login-dob')}
        >
          Login via name
        </BlackGradientButton>
      </div>
    </>
  )
}

export default LoginSuhi
