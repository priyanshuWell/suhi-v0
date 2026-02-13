import clsx from 'clsx'

export default function BlackGradientButton({
  onClick,
  children,
  className = '',
  disabled = false,
  width,
  padX,
  style = {}
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        boxShadow: '0px 3.58px 28.62px #9ad9ff',
        borderRadius: '20px',
        background: '#2596be padding-box, linear-gradient(135.77deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0)) border-box',
        border: '1.4px solid transparent',
        ...style
      }}
      className={clsx(
        width ?? 'w-[clamp(16rem,40vw,31.25rem)]',
        'relative',
        'flex items-center justify-center',
        'text-center',
        padX ?? 'px-20',
        'py-7',
        'text-white',
        'text-3xl',
        'tracking-[-0.06em]',
        "font-['Share_Tech_Mono']",
        'overflow-hidden',
        'isolate',
        'gap-2',
        'cursor-pointer',
        'active:scale-[0.98]',
        'transition-transform duration-300 ease-in-out',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {/* Lenses container for blur effect */}
      <div className="absolute inset-0 w-[calc(100%+1.4px)] h-full -left-[0.72px] -right-[0.68px] blur-[5.72px] z-0">
        {/* Blur layer 1 */}
        <div 
          className="absolute inset-0 rounded-5xl bg-white/[0.01]"
          style={{ backdropFilter: 'blur(71.54px)' }}
        />
        {/* Blur layer 2 */}
        <div 
          className="absolute rounded-5xl bg-black/[0.01]"
          style={{ 
            backdropFilter: 'blur(35.77px)',
            top: '2.15px',
            right: '1.52px',
            bottom: '2.15px',
            left: '1.48px'
          }}
        />
        {/* Blur layer 3 */}
        <div 
          className="absolute rounded-5xl bg-black/[0.01]"
          style={{ 
            backdropFilter: 'blur(17.88px)',
            top: '6.44px',
            right: '4.47px',
            bottom: '6.46px',
            left: '4.43px'
          }}
        />
        {/* Blur layer 4 */}
        <div 
          className="absolute rounded-[715px] bg-black/[0.01]"
          style={{ 
            // backdropFilter: 'blur(7.15px)',
            // top: '13.59px',
            // right: '9.34px',
            // bottom: '13.61px',
            // left: '9.36px'
          }}
        />
        {/* Blur layer 5 */}
        <div 
          className="absolute rounded-[715px] bg-white/[0.01]"
          style={{ 
            backdropFilter: 'blur(1.43px)',
            top: '27.9px',
            right: '19.28px',
            bottom: '27.9px',
            left: '19.22px'
          }}
        />
      </div>
      
      {/* Text content */}
      <span 
        className="relative z-[2]"
        style={{
          textShadow: '0 0 10px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.6), 0 0 30px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.9)'
        }}
      >
        {children}
      </span>
    </button>
  )
}