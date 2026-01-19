import clsx from "clsx";

export default function Frame({frame,horizontalLine,verticleLine}) {
  return (
    <>
       <svg width="1064" height="1902" className={clsx("absolute h-full bottom-24", frame)} viewBox="0 0 1064 1902" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fillRule="evenodd" clipRule="evenodd" d="M1063.56 1901.38H0.39617V1422.49L53.0076 1372.92V568.323L0 518.381V517.709L0.39617 0H632.287L697.259 61.2143H1063V989.134L1008.33 1040.64V1523.12L1063.56 1575.15V1901.38ZM3.56553 1898.39H1060.39V1576.49L1005.16 1524.39V1039.45L1059.83 987.94V64.2751H695.991L630.94 3.06072H3.56553L3.16936 517.187L56.1769 567.129V1374.19L3.56553 1423.76V1898.39Z" fill="#00D2FC"/>
</svg>
<svg width="351" height="31"  className={clsx("absolute landscape:hidden h-full portrait:w-[23%] portrait:bottom-[42.5rem] portrait:right-[13rem]", horizontalLine)}  viewBox="0 0 351 31" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M0 0L33.1792 30.9945H350.314V0H0Z" fill="#9AD9FF"/>
</svg>
<svg width="28" height="692"  className={clsx("absolute landscape:hidden h-full portrait:w-[21px] portrait:left-[13rem] portrait:bottom-20", verticleLine)}  viewBox="0 0 28 692" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M0 0V691.892L27.1996 666.415V22.9563L0 0Z" fill="#9AD9FF"/>
</svg>

<div className="landscape:hidden absolute right-[12.5rem] bottom-[39rem]">
  <div className="flex flex-col h-[280px] w-[29px] overflow-hidden">
    {Array.from({ length: 25 }).map((_, i) => (
      <div
        key={i}
        className="
          h-[8px]
          w-full
          bg-[#9AD9FF]
          mb-[6px]
          skew-y-[-35deg]
          last:mb-0
          shadow-[0_0_6px_#9AD9FF]
        "
      />
    ))}
  </div>
</div>

    </>


  );
}

