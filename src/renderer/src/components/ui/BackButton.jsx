import blackButton from '../../assets/back_button.png'
export default function BackButton({ onClick }) {
  return (

    <button className="max-w-full" onClick={onClick}>
      <img src={blackButton} alt="sound-btn" className="w-30" />
    </button>

  )
}
