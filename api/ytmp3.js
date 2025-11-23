const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const stream = require('stream');
const axios = require('axios');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to validate YouTube URL
function isValidYouTubeUrl(url) {
  const regex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  return regex.test(url);
}

// Helper function to extract video ID
function extractVideoId(url) {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Get video info endpoint
app.get('/api/info', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    if (!isValidYouTubeUrl(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }
    
    const videoId = extractVideoId(url);
    const info = await ytdl.getInfo(url);
    
    const videoDetails = {
      title: info.videoDetails.title,
      duration: info.videoDetails.lengthSeconds,
      thumbnail: info.videoDetails.thumbnails[0].url,
      author: info.videoDetails.author.name,
      videoId: videoId
    };
    
    res.json(videoDetails);
  } catch (error) {
    console.error('Error fetching video info:', error);
    res.status(500).json({ error: 'Failed to fetch video information' });
  }
});

// Download MP3 endpoint
app.get('/api/download', async (req, res) => {
  try {
    const { url, quality = '128kbps' } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    if (!isValidYouTubeUrl(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }
    
    const videoId = extractVideoId(url);
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
    
    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${title}.mp3"`);
    res.setHeader('Content-Type', 'audio/mpeg');
    
    // Create YouTube stream
    const audioStream = ytdl(url, {
      quality: 'highestaudio',
      filter: 'audioonly'
    });
    
    // Convert to MP3 with FFmpeg
    const ffmpegCommand = ffmpeg(audioStream)
      .audioBitrate(128)
      .audioChannels(2)
      .audioCodec('libmp3lame')
      .format('mp3')
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Conversion failed' });
        }
      })
      .on('end', () => {
        console.log('Conversion finished');
      });
    
    // Pipe the converted audio to response
    ffmpegCommand.pipe(res, { end: true });
    
  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Download failed' });
    }
  }
});

// Alternative method using ytdl-core's built-in format selection
app.get('/api/download-mp3', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    if (!isValidYouTubeUrl(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }
    
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
    
    // Find the best audio format
    const format = ytdl.chooseFormat(info.formats, {
      quality: 'highestaudio',
      filter: 'audioonly'
    });
    
    if (!format) {
      return res.status(500).json({ error: 'No suitable audio format found' });
    }
    
    res.setHeader('Content-Disposition', `attachment; filename="${title}.mp3"`);
    res.setHeader('Content-Type', 'audio/mpeg');
    
    // Download and stream the audio
    ytdl(url, { format: format })
      .on('error', (err) => {
        console.error('Stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream failed' });
        }
      })
      .pipe(res);
      
  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Download failed' });
    }
  }
});

// Simple status endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'YouTube to MP3 API is running',
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'YouTube to MP3 Converter API',
    endpoints: {
      '/api/status': 'Check API status',
      '/api/info?url=YOUTUBE_URL': 'Get video information',
      '/api/download?url=YOUTUBE_URL': 'Download MP3 (128kbps)',
      '/api/download-mp3?url=YOUTUBE_URL': 'Alternative MP3 download'
    },
    usage: 'Add YouTube URL as query parameter: ?url=YOUTUBE_URL'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Export for Vercel
module.exports = app;

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
