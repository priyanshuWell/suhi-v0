import React from 'react'
import lightbg from '../assets/lightbg.png'
import lightblub from '../assets/lightblub.png'
import frame1 from '../assets/verfied-frame.svg'
import profilepic from '../assets/profile-pic.png'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'


export default function RegisterCard() {
const user = useSelector((state) => state.common.user);
const imagePath = user?.data?.image_path; // "/var/lib/suhi/.images/<folder>"
const folderName = imagePath?.split("/").pop(); // "<folder>"
const [isAudioPlaying, setIsAudioPlaying] = useState(false);
const audioRef = React.useRef(null);
const instructionAudio = "/src/assets/audio/confirm_user.mp3";
const profileImageSrc = folderName
  ? `http://127.0.0.1:5174/images/${folderName}/original.jpg`
  : profilepic;

useEffect(() => {
  // Play audio when component mounts
  playAudio();
}, []);

const playAudio = () => {
    if (audioRef.current) {
      setIsAudioPlaying(true);
      audioRef.current.play().catch((err) => {
        console.log("Audio playback failed:", err);
      });
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsAudioPlaying(false);
    }
  };

  const handleAudioEnd = () => {
    setIsAudioPlaying(false);
  };

  console.log(user);
  const navigate = useNavigate()
  const {t}= useTranslation()
    const handleYesClick = () => {
    stopAudio();
    navigate('/bia/wh');
  };

  const handleNoClick = () => {
    stopAudio();
    navigate('/start');
  };
    <audio
    ref={audioRef}
    onEnded={handleAudioEnd}
    onPlay={() => setIsAudioPlaying(true)}
  >
    <source src={instructionAudio} type="audio/mpeg" />
    Your browser does not support the audio element.
  </audio>
  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center">
      {/* Card Wrapper */}
      <div
        className="relative w-[900px] h-[1400px] bg-cover bg-center"
        style={{ backgroundImage: `url(${lightbg})` }}
      >
        <div
          className="
          absolute top-[60px]
          left-1/2 -translate-x-1/2
          z-20
        "
        >
          <img
            src={frame1}
            alt="dmt background"
            className="w-[850px] max-w-none h-auto"
          />
        </div>

        <div
          className="flex flex-col items-center gap-10 absolute top-[140px]
          left-1/2 -translate-x-1/2
          z-30 "
        >
          {/* profile pic */}

          {/* <div className="max-w-full h-auto">
            <img
              src={profilepic}
              alt=" profile pic"
              className="w-full portrait:max-w-105 landscape:max-w-60 h-auto"
            />
          </div> */}


          <img
            src={profileImageSrc}
            onError={(e) => {
              e.currentTarget.src = profilepic;
            }}
            alt="profile pic"
            className="w-[420px] h-auto object-cover"
          />


          {/* text */}

          <div className="info max-w-full mt-8">
            <p className="text-[28px] flex flex-col items-center text-center tracking-wider gap-y-3 text-white text-nowrap">
              <span>{t('profile.name')} - {user?.data?.student_name} </span>
              {user?.data?.class && <span> {t('profile.class')}- 8th A</span>}
              {user?.data?.age && <span>{t('profile.age')} - 13 years</span>}
              {user?.data?.contact_number && <span>{t('profile.number')} - 0987654321</span>}
            </p>
          </div>

          <div className="buttons mt-5">
            <button
            onClick={handleYesClick}
              style={{
                borderImageSource:
                  'radial-gradient(50% 50% at 50% 50%, #FFFFFF 0%, rgba(255,255,255,0) 100%)',
                borderImageSlice: 1
              }}
              className="
w-[320px] h-[100px]
flex items-center justify-center
text-center
rounded-[25px]
 border-white
[border-image-source:radial-gradient(50%_50%_at_50%_50%,#ffffff_0%,rgba(255,255,255,0)_100%)]
[border-image-slice:1]
bg-[radial-gradient(43.11%_181.04%_at_50%_50%,#003FFD_0%,#00B3FF_100%)]
shadow-[inset_0px_33.5px_50px_-67px_rgba(255,255,255,0.24),inset_0px_-100.5px_134px_0px_rgba(255,255,255,0.24),inset_0px_0px_30px_0px_#ffffff]
text-white text-3xl tracking-wide
active:scale-[0.98]
transition-transform duration-300 ease-in-out

  "
            >
              {handleNoClick}
            </button>

            <button
             onClick={() => navigate('/welcome')}
              className="
          
w-[320px] h-[100px]
mt-8
flex items-center justify-center
text-center
rounded-[30px]
 border-white
 
[border-image-source:radial-gradient(50%_50%_at_50%_50%,#ffffff_0%,rgba(255,255,255,0)_100%)]
[border-image-slice:1]
shadow-[0px_5px_40px_0px_#9AD9FF]

text-white text-3xl tracking-wide
active:scale-[0.98]

transition-transform duration-300 ease-in-out
          "
            >
              {t('common.not_me')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}






// {
//     "success": true,
//     "data": {
//         "buffer_id": "36d051db-99f2-447c-818e-44b0e06c923b",
//         "status": "COMPLETED",
//         "student_status": "REGISTERED",
//         "user_id": "11e24be9-ed9b-4e65-8eeb-51a2561cb1da",
//         "face_id": "8577d7b5-a227-4402-962b-78f0c11ffce1",
//         "student_name": "Shivam Tripathi",
//         "gender": "MALE",
//         "age": 24,
//         "video_path": "/var/lib/suhi/.videos/11e24be9-ed9b-4e65-8eeb-51a2561cb1da_20260119_110326_KIOSK_001",
//         "image_path": "/var/lib/suhi/.images/11e24be9-ed9b-4e65-8eeb-51a2561cb1da_20260119_110326_KIOSK_001"
//     },
//     "error": null
// }