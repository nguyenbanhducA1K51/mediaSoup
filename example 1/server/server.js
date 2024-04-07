const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3008;

// Serve HTML file with the recording functionality
app.get('/', (req, res) => {
    res.sendFile("hi babe");
});

// Endpoint to receive recorded media data
app.post('/save', express.raw({ type: 'video/webm' }), (req, res) => {
    const filePath = path.join(__dirname, 'recorded.webm');
    const fileStream = fs.createWriteStream(filePath);

    req.pipe(fileStream);

    fileStream.on('finish', () => {
        res.sendStatus(200);
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
