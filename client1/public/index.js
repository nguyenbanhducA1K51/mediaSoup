
const io = require('socket.io-client')
const mediasoupClient = require('mediasoup-client')

// const socket = io("https://172.105.148.82:3000/mediasoup")
const socket = io("https://localhost:3001/mediasoup")
socket.on('connection-success', ({ socketId, existsProducer }) => {
  // console.log(socketId, existsProducer)
})

let device
let rtpCapabilities
let producerTransport
let producer
let isProducer = false

let params = {
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
  // codecOptions: {
  //   audioGoogleMaxBitrate: 16000,
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

const createDevice = async () => {
  try {
    console.log('stage2');
    
    device = new mediasoupClient.Device()

    await device.load({
      routerRtpCapabilities: rtpCapabilities
    })

    console.log('Device RTP Capabilities', device.rtpCapabilities)

   goCreateTransport()

  } catch (error) {
    console.log(error)
    if (error.name === 'UnsupportedError')
      console.warn('browser not supported')
  }
}

const getRtpCapabilities = () => {

  console.log('stage1');
  
  socket.emit('createRoom', (data) => {
    console.log(`Router RTP Capabilities...`, data.rtpCapabilities)
    rtpCapabilities = data.rtpCapabilities
    createDevice()
  })
}

const createSendTransport = () => {
  console.log('stage3');
  
  socket.emit('createWebRtcTransport', { sender: true }, ({ params }) => {
    if (params.error) {
      console.log(params.error)
      return
    }
    console.log(params)
    producerTransport = device.createSendTransport(params)

    producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await socket.emit('transport-connect', {
          dtlsParameters,
        })
        callback()

      } catch (error) {
        errback(error)
      }
    })

    producerTransport.on('produce', async (parameters, callback, errback) => {
      console.log("pppp:::::::::::", parameters)

      try {
        await socket.emit('transport-produce', {
          kind: parameters.kind,
          rtpParameters: parameters.rtpParameters,
          appData: parameters.appData,
        }, ({ id }) => {
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

  producer = await producerTransport.produce(params)

  producer.on('trackended', () => {
    console.log('track ended')

  })

  producer.on('transportclose', () => {
    console.log('transport ended')

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