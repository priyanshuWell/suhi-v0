export async function selectThreeCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cams = devices.filter(d => d.kind === "videoinput");
  console.log(cams);
  // const hdrs = cams.filter(c => c.label.includes("HDR"));
  // const rgb  = cams.find(c => c.label.includes("RGB"));

  // if (!rgb || hdrs.length < 4) {
  //   throw new Error("CAMERA_MISSING");
  // }

  // return [
  //   { role: "LEFT_HDR",   cam: hdrs[3] },
  //   { role: "CENTER_RGB", cam: rgb },
  //   { role: "RIGHT_HDR",  cam: hdrs[1] }
  // ];
   return [
    { role: "LEFT",   cam: cams[0] },
    { role: "CENTER", cam: cams[2] },
    { role: "RIGHT",  cam: cams[1] }
  ];
}
