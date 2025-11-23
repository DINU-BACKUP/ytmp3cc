const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/download', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    if (!ytdl.validateURL(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }
    
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
    
    res.setHeader('Content-Disposition', `attachment; filename="${title}.mp3"`);
    res.setHeader('Content-Type', 'audio/mpeg');
    
    ytdl(url, {
      quality: 'highestaudio',
      filter: 'audioonly',
    }).pipe(res);
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

app.get('/', (req, res) => {
  res.json({ message: 'YouTube MP3 API - Use /api/download?url=YOUTUBE_URL' });
});

module.exports = app;
