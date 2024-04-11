import { Readable } from 'stream';

// Converts a string (SDP) to a stream so it can be piped into the FFmpeg process
export const convertStringToStream = (stringToConvert) => {
  const stream = new Readable();
  stream._read = () => {};
  stream.push(stringToConvert);
  stream.push(null);

  return stream;
};

// Gets codec information from rtpParameters
export const getCodecInfoFromRtpParameters = (kind, rtpParameters) => {
  console.log("rptPram__UTIL::", rtpParameters)
  return {
    payloadType: rtpParameters.codecs[0].payloadType,
    codecName: rtpParameters.codecs[0].mimeType.replace(`${kind}/`, ''),
    clockRate: rtpParameters.codecs[0].clockRate,
    channels: kind === 'audio' ? rtpParameters.codecs[0].channels : undefined
  };
};
