
const io = require('socket.io-client')
const mediasoupClient = require('mediasoup-client')

const socket = io("https://172.105.148.82:3000/mediasoup")
// const socket = io("https://localhost:3000/mediasoup")
socket.on('connection-success', ({ socketId, existsProducer }) => {
  // console.log(socketId, existsProducer)
})

let device
let rtpCapabilities
let producerTransport
let producer
let isProducer = false
// https://mediasoup.org/documentation/v3/mediasoup-client/api/#ProducerOptions
// https://mediasoup.org/documentation/v3/mediasoup-client/api/#transport-produce
let params = {
  // mediasoup params
  // encodings: [
  //   {
  //     rid: 'r0',
  //     maxBitrate: 100000,
  //     scalabilityMode: 'S3T3',
  //   },
  //   {
  //     rid: 'r1',
  //     maxBitrate: 300000,
  //     scalabilityMode: 'S3T3',
  //   },
  //   {
  //     rid: 'r2',
  //     maxBitrate: 900000,
  //     scalabilityMode: 'S3T3',
  //   },
  // ],
  // https://mediasoup.org/documentation/v3/mediasoup-client/api/#ProducerCodecOptions
  // codecOptions: {
  //   videoGoogleStartBitrate: 1000
  // }
}

const streamSuccess = (stream) => {
  localVideo.srcObject = stream
  // const track =[stream.getVideoTracks()[0], stream.getAudioTracks()[0]]
  const track = stream.getAudioTracks()[0]
  console.log('client1', track);
  // const audioTrack = ;
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

const goConsume = () => {
  goConnect(false)
}

/**
 * This function will perform connection to Router
 * @param {*} producerOrConsumer return true if producer and false if consumer
 */
const goConnect = (producerOrConsumer) => {
  isProducer = producerOrConsumer
  device === undefined ? getRtpCapabilities() : goCreateTransport()
}

const goCreateTransport = () => {
  isProducer ? createSendTransport() : createRecvTransport()
}

// A device is an endpoint connecting to a Router on the 
// server side to send/recive media
const createDevice = async () => {
  try {
    console.log('stage2');
    
    device = new mediasoupClient.Device()

    // https://mediasoup.org/documentation/v3/mediasoup-client/api/#device-load
    // Loads the device with RTP capabilities of the Router (server side)
    await device.load({
      // see getRtpCapabilities() below
      routerRtpCapabilities: rtpCapabilities
    })

    console.log('Device RTP Capabilities', device.rtpCapabilities)

    // once the device loads, create transport
    goCreateTransport()

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
    console.log(`Router RTP Capabilities... ${data.rtpCapabilities}`)

    // we assign to local variable and will be used when
    // loading the client Device (see createDevice above)
    rtpCapabilities = data.rtpCapabilities

    // once we have rtpCapabilities from the Router, create Device
    createDevice()
  })
}

const createSendTransport = () => {
  console.log('stage3');
  
  // see server's socket.on('createWebRtcTransport', sender?, ...)
  // this is a call from Producer, so sender = true
  socket.emit('createWebRtcTransport', { sender: true }, ({ params }) => {
    // The server sends back params needed 
    // to create Send Transport on the client side
    if (params.error) {
      console.log(params.error)
      return
    }
    console.log(params)
    // creates a new WebRTC Transport to send media
    // based on the server's producer transport params
    // https://mediasoup.org/documentation/v3/mediasoup-client/api/#TransportOptions
    producerTransport = device.createSendTransport(params)

    // https://mediasoup.org/documentation/v3/communication-between-client-and-server/#producing-media
    // this event is raised when a first call to transport.produce() is made
    // see connectSendTransport() below
    producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        // Signal local DTLS parameters to the server side transport
        // see server's socket.on('transport-connect', ...)
        await socket.emit('transport-connect', {
          dtlsParameters,
        })
        // Tell the transport that parameters were transmitted.
        callback()

      } catch (error) {
        errback(error)
      }
    })

    producerTransport.on('produce', async (parameters, callback, errback) => {
      console.log(parameters)

      try {
        // tell the server to create a Producer
        // with the following parameters and produce
        // and expect back a server side producer id
        // see server's socket.on('transport-produce', ...)
        await socket.emit('transport-produce', {
          kind: parameters.kind,
          rtpParameters: parameters.rtpParameters,
          appData: parameters.appData,
        }, ({ id }) => {
          // Tell the transport that parameters were transmitted and provide it with the
          // server side producer's id.
          callback({ id })
        })
      } catch (error) {
        errback(error)
      }
    })

    connectSendTransport()
  })
}

const connectSendTransport = async () => {
  console.log('stage4');
  
  // we now call produce() to instruct the producer transport
  // to send media to the Router
  // https://mediasoup.org/documentation/v3/mediasoup-client/api/#transport-produce
  // this action will trigger the 'connect' and 'produce' events above
  producer = await producerTransport.produce(params)

  producer.on('trackended', () => {
    console.log('track ended')

    // close video track
  })

  producer.on('transportclose', () => {
    console.log('transport ended')

    // close video track
  })
}

const stopStream = () => {
  const stream = document.getElementById("localVideo").srcObject
  if (stream.getTracks()) {

    stream.getTracks().forEach(track=>track.stop())
    
  }
  socket.emit("closeAll")
  console.log('finished stopStream');
  
  
}
btnLocalVideo.addEventListener('click', getLocalStream)
btnRecvSendTransport.addEventListener('click', goConsume)

document.getElementById("stopStream").addEventListener('click', stopStream)