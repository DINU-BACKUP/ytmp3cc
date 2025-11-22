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
      '/api/mp3/download': 'POST - Get MP3 download info (provide youtubeUrl in body)',
      '/api/test': 'GET - Test with example URL'
    },
    example: '/api/mp3?youtubeUrl=https://www.youtube.com/watch?v=KK9bwTlAvgo'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test endpoint with your URL
app.get('/api/test', async (req, res) => {
  try {
    const testUrl = 'https://youtu.be/ArkDQvI_OPE';
    const result = await ytmp3free(testUrl);
    res.json({
      test_url: testUrl,
      result: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Extract video ID from YouTube URL
function extractVideoId(url) {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Method 1: ytmp3free.cc scraper
async function ytmp3free(url) {
  try {
    const videoId = extractVideoId(url);
    if (!videoId) {
      return { status: false, msg: "Invalid YouTube URL" };
    }

    const api = `https://ytmp3free.cc/@api/json/mp3/${videoId}`;
    console.log('Fetching from:', api);
    
    const { data } = await axios.get(api, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://ytmp3free.cc/'
      }
    });

    console.log('Raw response:', data);

    if (!data || !data.title || !data.link) {  
      return { 
        status: false, 
        msg: "No data received from service",
        rawData: data 
      };  
    }  

    return {  
      status: true,  
      title: data.title,  
      thumb: data.img || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,  
      duration: data.duration,  
      mp3: data.link,  
      source: "ytmp3free.cc",
      videoId: videoId
    };

  } catch (err) {
    console.error('ytmp3free error:', err.message);
    return { 
      status: false, 
      error: err.message,
      msg: "Service temporarily unavailable"
    };
  }
}

// Method 2: Alternative service
async function alternativeService(url) {
  try {
    const videoId = extractVideoId(url);
    const apiUrl = `https://api.vevioz.com/api/button/mp3/${videoId}`;
    
    const { data } = await axios.get(apiUrl, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (data && data.url) {
      return {
        status: true,
        title: `YouTube Video ${videoId}`,
        thumb: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        mp3: data.url,
        source: "vevioz.com",
        videoId: videoId
      };
    }
    
    return { status: false, msg: "Alternative service failed" };
  } catch (error) {
    return { status: false, msg: "Alternative service error" };
  }
}

// Enhanced MP3 function with fallbacks
async function getMP3Info(url) {
  // Try primary service first
  let result = await ytmp3free(url);
  
  // If primary fails, try alternative
  if (!result.status) {
    console.log('Primary service failed, trying alternative...');
    result = await alternativeService(url);
  }
  
  return result;
}

// GET endpoint for MP3 info
app.get('/api/mp3', async (req, res) => {
  try {
    const { youtubeUrl } = req.query;

    if (!youtubeUrl) {
      return res.status(400).json({
        status: false,
        error: "Missing youtubeUrl parameter",
        example: "/api/mp3?youtubeUrl=https://www.youtube.com/watch?v=VIDEO_ID"
      });
    }

    // Validate YouTube URL
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return res.status(400).json({
        status: false,
        error: "Invalid YouTube URL",
        supported_formats: [
          "https://www.youtube.com/watch?v=VIDEO_ID",
          "https://youtu.be/VIDEO_ID",
          "https://www.youtube.com/embed/VIDEO_ID"
        ]
      });
    }

    console.log(`Processing request for video: ${videoId}`);
    const result = await getMP3Info(youtubeUrl);
    
    if (result.status) {
      res.json(result);
    } else {
      res.status(500).json({
        ...result,
        videoId: videoId,
        note: "The service might be temporarily down. Please try again later."
      });
    }

  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({
      status: false,
      error: error.message,
      msg: "Internal server error"
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

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return res.status(400).json({
        status: false,
        error: "Invalid YouTube URL"
      });
    }

    const result = await getMP3Info(youtubeUrl);
    
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
