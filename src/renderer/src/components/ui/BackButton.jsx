import blackButton from '../../assets/back_button.png'
export default function BackButton(){
    return(
         <div className="absolute right-[1vh] top-[2vh] landscape:top-[1vh] landscape:right-[3vw] flex gap-2">
                <button className="max-w-full">
                  <img src={blackButton} alt="sound-btn" className="w-30" />
                </button>
              </div>
    )
}