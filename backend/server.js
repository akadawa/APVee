const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ProjectScanner = require('./scanner');

const app = express();
const port = process.env.PORT || 3001;
const MUSIC_DIR = process.env.MUSIC_DIR || path.join(__dirname, 'mock_music');

app.use(cors());
app.use(express.json());

// Main scanner instance
const scanner = new ProjectScanner(MUSIC_DIR);

// Ensure mock directory exists for testing if not provided
if (!fs.existsSync(MUSIC_DIR)) {
    fs.mkdirSync(MUSIC_DIR, { recursive: true });
}

// Initial scan
scanner.scan();
scanner.startWatching();

app.get('/api/projects', (req, res) => {
    res.json(scanner.getProjects());
});

app.get('/api/stream', (req, res) => {
    const filePath = req.query.path;
    if (!filePath || !filePath.startsWith(MUSIC_DIR)) {
        return res.status(403).send('Invalid path');
    }
    res.sendFile(filePath);
});

// Handle static files via Nginx or separate web server in production


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Music directory: ${MUSIC_DIR}`);
});
