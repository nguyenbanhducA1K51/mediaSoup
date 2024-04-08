//index.js
const io = require('socket.io-client')
const mediasoupClient = require('mediasoup-client')

// const socket = io("/mediasoup")
const socket = io("https://localhost:3000/mediasoup")
let device
let rtpCapabilities
let consumerTransport
let consumer
let isProducer = false

let mediaRecorder
let recordedChunks = []

socket.on('connection-success', ({ socketId, existsProducer }) => {
  console.log(socketId, existsProducer)

})


const saveStream = async (stream) => {
  try {
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = function (event) {
      if (event.data.size > 0) {
        
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = (e) => {      
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'recorded-video.webm';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url)
      recordedChunks = [];
    }

    mediaRecorder.start()

  } catch (err) {
    console.error('Error accessing webcam:', err);
  }
}



socket.on("closeproduce", () => {
  const video = document.getElementById("remoteVideo")
  mediaRecorder.stop()
  video.src = ''
})

// https://mediasoup.org/documentation/v3/mediasoup-client/api/#ProducerOptions
// https://mediasoup.org/documentation/v3/mediasoup-client/api/#transport-produce
let params = {
  // mediasoup params
  encodings: [
    {
      rid: 'r0',
      maxBitrate: 100000,
      scalabilityMode: 'S3T3',
    },
    {
      rid: 'r1',
      maxBitrate: 300000,
      scalabilityMode: 'S3T3',
    },
    {
      rid: 'r2',
      maxBitrate: 900000,
      scalabilityMode: 'S3T3',
    },
  ],
  // https://mediasoup.org/documentation/v3/mediasoup-client/api/#ProducerCodecOptions
  codecOptions: {
    videoGoogleStartBitrate: 1000
  }
}

const streamSuccess = (stream) => {
  localVideo.srcObject = stream
  const track = stream.getVideoTracks()[0]
  params = {
    track,
    ...params
  }

  goConnect(true)
}

const getLocalStream = () => {
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: {
      width: {
        min: 640,
        max: 1920,
      },
      height: {
        min: 400,
        max: 1080,
      }
    }
  })
    .then(streamSuccess)
    .catch(error => {
      console.log(error.message)
    })
}


/**
 * This function will perform connection to Router
 * @param {*} producerOrConsumer return true if producer and false if consumer
 */
const goConsume = () => {
  device === undefined ? getRtpCapabilities() : createRecvTransport()
}
const createDevice = async () => {
  console.log('stage2');

  try {
    device = new mediasoupClient.Device()

    await device.load({
      routerRtpCapabilities: rtpCapabilities
    })
    createRecvTransport()

  } catch (error) {
    console.log(error)
    if (error.name === 'UnsupportedError')
      console.warn('browser not supported')
  }
}

const getRtpCapabilities = () => {
  console.log('stage1');
  socket.emit('createRoom', (data) => {
    rtpCapabilities = data.rtpCapabilities
    createDevice()
  })
}

const createRecvTransport = async () => {
  console.log('stage3');
  await socket.emit('createWebRtcTransport', { sender: false }, ({ params }) => {

    if (params.error) {
      console.log(params.error)
      return
    }
    consumerTransport = device.createRecvTransport(params)

    
    consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await socket.emit('transport-recv-connect', {
          dtlsParameters,
        })

        callback()
      } catch (error) {
        errback(error)
      }
    })

    connectRecvTransport()
  })
}

const connectRecvTransport = async () => {
  console.log('stage4');

  await socket.emit('consume', {
    rtpCapabilities: device.rtpCapabilities,
  }, async ({ params }) => {

    if (params.error) {
      console.log('error', params.error);
      console.log('Cannot Consume')
      return
    }

    consumer = await consumerTransport.consume({
      id: params.id,
      producerId: params.producerId,
      kind: params.kind,
      rtpParameters: params.rtpParameters
    })

    const { track } = consumer
    console.log("sasassa::::::",track);

    let stream = new MediaStream([track])
    
    remoteVideo.srcObject = stream

    await saveStream(stream)

    socket.emit('consumer-resume')
  })
}

btnRecvSendTransport.addEventListener('click', goConsume)