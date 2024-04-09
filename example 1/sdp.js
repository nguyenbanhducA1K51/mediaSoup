import { getCodecInfoFromRtpParameters } from './utils.js';

// File to create SDP text from mediasoup RTP Parameters
export const createSdpText = (rtpParameters) => {
  console.log("==========rtpParam_____SDP::::", rtpParameters)
  
  // Audio codec info
  const audioCodecInfo = getCodecInfoFromRtpParameters('audio', rtpParameters.rtpParameters);

  return `v=0
  o=- 0 0 IN IP4 127.0.0.1
  s=FFmpeg
  c=IN IP4 127.0.0.1
  t=0 0
  m=audio ${rtpParameters.remoteRtpPort} RTP/AVP ${audioCodecInfo.payloadType} 
  a=rtpmap:${audioCodecInfo.payloadType} ${audioCodecInfo.codecName}/${audioCodecInfo.clockRate}/${audioCodecInfo.channels}
  a=sendonly
  `;
};
