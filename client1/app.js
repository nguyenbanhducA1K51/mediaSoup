
import express from 'express'
const app = express()
import https from 'httpolyglot'
import fs from 'fs'
import path from 'path'
const __dirname = path.resolve()
import cors from "cors"
const port = 3011;

// Serve HTML file with the recording functionality
app.get('/', (req, res) => {
    // res.sendFile("hi babe");
res.send("ok")
});

app.use('/post', express.static(path.join(__dirname, '/public')))

const options = {
    key: fs.readFileSync('./ssl/key.pem', 'utf-8'),
    cert: fs.readFileSync('./ssl/cert.pem', 'utf-8')
}

const httpsServer = https.createServer(options, app)
httpsServer.listen(port, () => {
    console.log('listening on port: ' + port)
})

// // Endpoint to receive recorded media data
// app.post('/save', express.raw({ type: 'video/webm' }), (req, res) => {
//     const filePath = path.join(__dirname, 'recorded.webm');
//     const fileStream = fs.createWriteStream(filePath);

//     req.pipe(fileStream);

//     fileStream.on('finish', () => {
//         res.sendStatus(200);
//     });
// });
