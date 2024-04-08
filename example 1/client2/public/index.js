//index.js
const io = require('socket.io-client')
const mediasoupClient = require('mediasoup-client')

// const socket = io("/mediasoup")
const socket = io("https://172.105.148.82:3000/mediasoup")
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
    audio: false,
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
// A device is an endpoint connecting to a Router on the 
// server side to send/recive media
const createDevice = async () => {
  console.log('stage2');

  try {
    device = new mediasoupClient.Device()

    // https://mediasoup.org/documentation/v3/mediasoup-client/api/#device-load
    // Loads the device with RTP capabilities of the Router (server side)
    await device.load({
      // see getRtpCapabilities() below
      routerRtpCapabilities: rtpCapabilities
    })

    // console.log('Device RTP Capabilities', device.rtpCapabilities)

    // once the device loads, create transport
    createRecvTransport()

  } catch (error) {
    console.log(error)
    if (error.name === 'UnsupportedError')
      console.warn('browser not supported')
  }
}

const getRtpCapabilities = () => {
  console.log('stage1');
  // make a request to the server for Router RTP Capabilities
  // see server's socket.on('getRtpCapabilities', ...)
  // the server sends back data object which contains rtpCapabilities
  socket.emit('createRoom', (data) => {
    // console.log(`Router RTP Capabilities... ${data.rtpCapabilities}`)

    // we assign to local variable and will be used when
    // loading the client Device (see createDevice above)
    rtpCapabilities = data.rtpCapabilities

    // once we have rtpCapabilities from the Router, create Device
    createDevice()
  })
}

const createRecvTransport = async () => {
  console.log('stage3');

  // see server's socket.on('consume', sender?, ...)
  // this is a call from Consumer, so sender = false
  await socket.emit('createWebRtcTransport', { sender: false }, ({ params }) => {
    // The server sends back params needed 
    // to create Send Transport on the client side
    if (params.error) {
      console.log(params.error)
      return
    }
    // creates a new WebRTC Transport to receive media
    // based on server's consumer transport params
    // https://mediasoup.org/documentation/v3/mediasoup-client/api/#device-createRecvTransport
    consumerTransport = device.createRecvTransport(params)

    // https://mediasoup.org/documentation/v3/communication-between-client-and-server/#producing-media
    // this event is raised when a first call to transport.produce() is made
    // see connectRecvTransport() below
    consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        // Signal local DTLS parameters to the server side transport
        // see server's socket.on('transport-recv-connect', ...)
        await socket.emit('transport-recv-connect', {
          dtlsParameters,
        })

        // Tell the transport that parameters were transmitted.
        callback()
      } catch (error) {
        // Tell the transport that something was wrong
        errback(error)
      }
    })

    connectRecvTransport()
  })
}

const connectRecvTransport = async () => {
  console.log('stage4');

  // for consumer, we need to tell the server first
  // to create a consumer based on the rtpCapabilities and consume
  // if the router can consume, it will send back a set of params as below
  await socket.emit('consume', {
    rtpCapabilities: device.rtpCapabilities,
  }, async ({ params }) => {

    if (params.error) {
      console.log('error', params.error);
      console.log('Cannot Consume')
      return
    }

    // console.log(params)
    // then consume with the local consumer transport
    // which creates a consumer
    consumer = await consumerTransport.consume({
      id: params.id,
      producerId: params.producerId,
      kind: params.kind,
      rtpParameters: params.rtpParameters
    })

    // destructure and retrieve the video track from the producer
    const { track } = consumer
    let stream = new MediaStream([track])
    remoteVideo.srcObject = stream
    // await saveStream()

    await saveStream(stream)
    // the server consumer started with media paused
    // so we need to inform the server to resume
    socket.emit('consumer-resume')
  })
}

btnRecvSendTransport.addEventListener('click', goConsume)