const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'YouTube MP3 API is running!',
    endpoints: {
      '/api/mp3': 'GET - Get MP3 download info (provide youtubeUrl as query parameter)',
      '/api/mp3/download': 'POST - Get MP3 download info (provide youtubeUrl in body)'
    },
    example: '/api/mp3?youtubeUrl=https://www.youtube.com/watch?v=KK9bwTlAvgo'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

/*
YTMP3FREE.cc Scraper
Input  : YouTube URL
Output : Title, Thumbnail, 128kbps MP3 Download Link
*/
async function ytmp3free(url) {
  try {
    const api = `https://ytmp3free.cc/@api/json/mp3/${encodeURIComponent(url)}`;
    const { data } = await axios.get(api, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!data || !data.title || !data.link) {  
      return { status: false, msg: "Scrape failed or invalid YouTube URL" };  
    }  

    return {  
      status: true,  
      title: data.title,  
      thumb: data.img,   // Thumbnail  
      duration: data.duration,  
      mp3: data.link,    // 128kbps MP3 Download Link  
      source: "ytmp3free.cc"  
    };

  } catch (err) {
    return { 
      status: false, 
      error: err.message,
      msg: "Service temporarily unavailable. Please try again later."
    };
  }
}

// GET endpoint for MP3 info
app.get('/api/mp3', async (req, res) => {
  try {
    const { youtubeUrl } = req.query;

    if (!youtubeUrl) {
      return res.status(400).json({
        status: false,
        error: "Missing youtubeUrl parameter"
      });
    }

    // Validate YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    if (!youtubeRegex.test(youtubeUrl)) {
      return res.status(400).json({
        status: false,
        error: "Invalid YouTube URL"
      });
    }

    const result = await ytmp3free(youtubeUrl);
    
    if (result.status) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }

  } catch (error) {
    res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

// POST endpoint for MP3 info
app.post('/api/mp3/download', async (req, res) => {
  try {
    const { youtubeUrl } = req.body;

    if (!youtubeUrl) {
      return res.status(400).json({
        status: false,
        error: "Missing youtubeUrl in request body"
      });
    }

    // Validate YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    if (!youtubeRegex.test(youtubeUrl)) {
      return res.status(400).json({
        status: false,
        error: "Invalid YouTube URL"
      });
    }

    const result = await ytmp3free(youtubeUrl);
    
    if (result.status) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }

  } catch (error) {
    res.status(500).json({
      status: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: false,
    error: 'Something went wrong!'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: false,
    error: 'Endpoint not found'
  });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`API URL: http://localhost:${PORT}`);
  });
}

module.exports = app;
