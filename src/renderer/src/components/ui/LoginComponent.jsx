import bg1 from '../../assets/lightbg.png'
import bg2 from '../../assets/dmt-bg.svg'
import BackButton from '../ui/BackButton'
import BlueGradientButton from '../ui/BlueGradientButton'
import GradientButton from './BlackGradientButton'
import BlackGradientButton from './BlackGradientButton'
import { useNavigate } from 'react-router'
const LoginComponent = () => {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 w-screen min-h-screen overflow-hidden bg-black font-['Share_Tech_Mono']">
      {/* background */}
      <div
        className="absolute inset-0 bg-no-repeat bg-cover bg-center z-0"
        style={{ backgroundImage: `url(${bg1})` }}
      />
      <div className="fixed top-4 left-4">
        <BackButton />
      </div>

      {/* top text */}
      {/* <div className="fixed top-1/16 left-1/2 -translate-x-1/2 z-30 w-[600px]">
        <p className="text-5xl text-center font-light leading-snug leading-snug text-white ">
         Log In Using Your ID or Fingerprint
        </p>
      </div> */}

      {/* frame section with form inside */}
      <div className="absolute bottom-[8rem] left-1/2 -translate-x-1/2 z-20">
        <div className="relative w-[840px]">
          {/* frame image */}
          <img src={bg2} alt="dmit frame" className="w-full max-w-none h-auto" />

          {/* form positioned inside frame */}

        </div>
      </div>

      {/* <div className="absolute bottom-10 flex justify-center left-1/2 -translate-x-1/2">
        <BlackGradientButton onClick={()=>navigate('/welcome')} width={'w-[clamp(18rem,68vw,35rem)]'} padX={'px-2'} className='text-4xl'>
          New user? Register here
        </BlackGradientButton>
      </div> */}
    </div>
  )
}

export default LoginComponent
