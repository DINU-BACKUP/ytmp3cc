const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Base URL for the movie site
const BASE_URL = 'https://sinhalasub.lk';

// Utility function to delay requests
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Search movies by keyword
app.get('/api/search', async (req, res) => {
    try {
        const { query, page = 1 } = req.query;
        
        if (!query) {
            return res.status(400).json({ 
                error: 'Query parameter is required' 
            });
        }

        const searchUrl = `${BASE_URL}/page/${page}/?s=${encodeURIComponent(query)}`;
        
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const movies = [];

        // Extract movie information from search results
        $('.post-box, .movie-item, article, .post').each((index, element) => {
            const $element = $(element);
            
            // Try different selectors for title and link
            const title = $element.find('h2 a, h3 a, .title a, .entry-title a').first().text().trim();
            const link = $element.find('h2 a, h3 a, .title a, .entry-title a').first().attr('href');
            const image = $element.find('img').first().attr('src');
            const description = $element.find('.entry-content, .excerpt, .description').first().text().trim();
            
            if (title && link) {
                movies.push({
                    title,
                    link: link.startsWith('http') ? link : BASE_URL + link,
                    image: image || null,
                    description: description || '',
                    year: extractYear(title)
                });
            }
        });

        // If no movies found with common selectors, try alternative approach
        if (movies.length === 0) {
            $('a').each((index, element) => {
                const $element = $(element);
                const href = $element.attr('href');
                const text = $element.text().trim();
                
                if (href && text && href.includes('/movie/') && text.length > 5) {
                    movies.push({
                        title: text,
                        link: href.startsWith('http') ? href : BASE_URL + href,
                        image: null,
                        description: '',
                        year: extractYear(text)
                    });
                }
            });
        }

        res.json({
            query,
            page: parseInt(page),
            totalResults: movies.length,
            movies: movies
        });

    } catch (error) {
        console.error('Search error:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch search results',
            details: error.message 
        });
    }
});

// Get movie details by URL
app.get('/api/movie', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({ 
                error: 'URL parameter is required' 
            });
        }

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        
        // Extract movie details
        const movie = {
            title: $('h1.entry-title, h1.post-title, h1').first().text().trim(),
            image: $('.post-image img, .featured-image img, .entry-content img').first().attr('src'),
            description: $('.entry-content, .post-content').first().text().trim().substring(0, 500) + '...',
            details: {},
            downloadLinks: []
        };

        // Extract movie details from content
        $('.entry-content p, .post-content p').each((index, element) => {
            const text = $(element).text().trim();
            
            // Extract common movie details
            if (text.includes('Year:')) movie.details.year = extractValue(text, 'Year:');
            if (text.includes('Genre:')) movie.details.genre = extractValue(text, 'Genre:');
            if (text.includes('Director:')) movie.details.director = extractValue(text, 'Director:');
            if (text.includes('Cast:')) movie.details.cast = extractValue(text, 'Cast:');
            if (text.includes('Quality:')) movie.details.quality = extractValue(text, 'Quality:');
            if (text.includes('Size:')) movie.details.size = extractValue(text, 'Size:');
            if (text.includes('Duration:')) movie.details.duration = extractValue(text, 'Duration:');
        });

        // Extract download links
        $('a').each((index, element) => {
            const $element = $(element);
            const href = $element.attr('href');
            const text = $element.text().trim().toLowerCase();
            
            if (href && (text.includes('download') || text.includes('watch') || 
                href.includes('drive.google.com') || href.includes('mega.nz') || 
                href.includes('mediafire.com') || href.includes('dropbox'))) {
                
                movie.downloadLinks.push({
                    provider: text || 'Download',
                    url: href,
                    type: classifyLinkType(text, href)
                });
            }
        });

        res.json(movie);

    } catch (error) {
        console.error('Movie details error:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch movie details',
            details: error.message 
        });
    }
});

// Get latest movies
app.get('/api/latest', async (req, res) => {
    try {
        const { page = 1 } = req.query;
        const url = `${BASE_URL}/page/${page}/`;
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const movies = [];

        // Extract latest movies
        $('.post-box, .movie-item, article, .post').each((index, element) => {
            const $element = $(element);
            
            const title = $element.find('h2 a, h3 a, .title a, .entry-title a').first().text().trim();
            const link = $element.find('h2 a, h3 a, .title a, .entry-title a').first().attr('href');
            const image = $element.find('img').first().attr('src');
            const date = $element.find('.post-date, .date, time').first().text().trim();
            
            if (title && link) {
                movies.push({
                    title,
                    link: link.startsWith('http') ? link : BASE_URL + link,
                    image: image || null,
                    date: date || '',
                    year: extractYear(title)
                });
            }
        });

        res.json({
            page: parseInt(page),
            totalMovies: movies.length,
            movies: movies
        });

    } catch (error) {
        console.error('Latest movies error:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch latest movies',
            details: error.message 
        });
    }
});

// Helper functions
function extractYear(title) {
    const yearMatch = title.match(/(19|20)\d{2}/);
    return yearMatch ? yearMatch[0] : null;
}

function extractValue(text, key) {
    const regex = new RegExp(`${key}\\s*([^\\n]+)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : null;
}

function classifyLinkType(text, url) {
    if (url.includes('drive.google.com')) return 'google_drive';
    if (url.includes('mega.nz')) return 'mega';
    if (url.includes('mediafire.com')) return 'mediafire';
    if (url.includes('dropbox.com')) return 'dropbox';
    if (text.includes('watch')) return 'stream';
    return 'download';
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Movie API is running',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🎬 Movie API server running on port ${PORT}`);
    console.log(`📍 Base URL: http://localhost:${PORT}`);
    console.log(`🔍 Search: http://localhost:${PORT}/api/search?query=avengers`);
    console.log(`🎥 Details: http://localhost:${PORT}/api/movie?url=MOVIE_URL`);
    console.log(`📅 Latest: http://localhost:${PORT}/api/latest`);
});

module.exports = app;
