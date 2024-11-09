// server.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const mysql = require('mysql2');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// MySQL connection setup
const connection = mysql.createConnection({
    host: process.env.DATABASE_HOST || 'localhost',
    user: process.env.DATABASE_USER || 'anshul',
    password: process.env.DATABASE_PASSWORD || 'Sushama22@1234',
    database: process.env.DATABASE_NAME || 'ShoppingCartDB'
});


// Connect to MySQL
connection.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err.stack);
        return;
    }
    console.log('Connected to MySQL');
});

// Create necessary tables if they don't exist
connection.query(`
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL
    )
`);

connection.query(`
    CREATE TABLE IF NOT EXISTS cart (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        price VARCHAR(50) NOT NULL,
        imageUrl TEXT NOT NULL,
        websiteName VARCHAR(50) NOT NULL,
        url TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
`);

// Add this to your existing table creation queries
connection.query(`
    CREATE TABLE IF NOT EXISTS shared_carts (
      id VARCHAR(36) PRIMARY KEY,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  connection.query(`
    CREATE TABLE IF NOT EXISTS shared_cart_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      shared_cart_id VARCHAR(36) NOT NULL,
      title VARCHAR(255) NOT NULL,
      price VARCHAR(50) NOT NULL,
      imageUrl TEXT NOT NULL,
      websiteName VARCHAR(50) NOT NULL,
      url TEXT NOT NULL,
      FOREIGN KEY (shared_cart_id) REFERENCES shared_carts(id)
    )
  `);
  
  // Add these new endpoints
  const { v4: uuidv4 } = require('uuid');
  
  // Create a shared cart
  app.post('/share-cart/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
      // Generate unique ID for shared cart
      const sharedCartId = uuidv4();
      
      // Create shared cart entry
      await connection.promise().query(
        'INSERT INTO shared_carts (id, user_id) VALUES (?, ?)',
        [sharedCartId, userId]
      );
      
      // Get user's cart items
      const [cartItems] = await connection.promise().query(
        'SELECT title, price, imageUrl, websiteName, url FROM cart WHERE user_id = ?',
        [userId]
      );
      
      // Add items to shared cart
      for (const item of cartItems) {
        await connection.promise().query(
          'INSERT INTO shared_cart_items (shared_cart_id, title, price, imageUrl, websiteName, url) VALUES (?, ?, ?, ?, ?, ?)',
          [sharedCartId, item.title, item.price, item.imageUrl, item.websiteName, item.url]
        );
      }
      
      res.json({ success: true, sharedCartId });
    } catch (error) {
      console.error('Error sharing cart:', error);
      res.status(500).json({ error: 'Failed to share cart' });
    }
  });
  
  // Get shared cart items
  app.get('/shared-cart/:sharedCartId', async (req, res) => {
    const { sharedCartId } = req.params;
    
    try {
      const [items] = await connection.promise().query(
        `SELECT sci.*, sc.user_id, u.username 
         FROM shared_cart_items sci
         JOIN shared_carts sc ON sci.shared_cart_id = sc.id
         JOIN users u ON sc.user_id = u.id
         WHERE sc.id = ?`,
        [sharedCartId]
      );
      
      if (items.length === 0) {
        return res.status(404).json({ error: 'Shared cart not found' });
      }
      
      res.json(items);
    } catch (error) {
      console.error('Error fetching shared cart:', error);
      res.status(500).json({ error: 'Failed to fetch shared cart' });
    }
  });
// User registration
app.post('/register', (req, res) => {
    const { username, password, email } = req.body;
    
    if (!username || !password || !email) {
        return res.status(400).json({ error: "All fields are required" });
    }

    connection.query(
        'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
        [username, password, email],
        (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: "Username or email already exists" });
                }
                return res.status(500).json({ error: "Failed to register user" });
            }
            res.json({ success: true, userId: result.insertId });
        }
    );
});

// User login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    connection.query(
        'SELECT * FROM users WHERE username = ? AND password = ?',
        [username, password],
        (err, results) => {
            if (err) {
                return res.status(500).json({ error: "Failed to login" });
            }
            if (results.length === 0) {
                return res.status(401).json({ error: "Invalid credentials" });
            }
            res.json({ success: true, userId: results[0].id, username: results[0].username });
        }
    );
});

// Existing scraping helper functions remain the same
const getWebsiteName = async (url) => {
    if (url.includes('amzn')) return 'Amazon';
    if (url.includes('flipkart')) return 'Flipkart';
    if (url.includes('meesho')) return 'Meesho';
    if (url.includes('snapdeal')) return 'Snapdeal';
    if (url.includes('croma')) return 'Croma';
    return 'Unknown';
};

// Helper function to scrape product details based on the URL domain
const scrapeProductDetails = async (url) => {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    let title, price, imageUrl;

    // Scraping logic for different websites
    if (url.includes('amzn')) {
        title = $('#productTitle').text().trim();
        price = $('.a-offscreen').first().text().trim();
        imageUrl = $('#landingImage').attr('src');
        if (!price) {
            const symbol = $('.a-price-symbol').first().text().trim();
            const wholePrice = $('.a-price-whole').first().text().trim();
            if (symbol && wholePrice) {
                price = `${symbol}${wholePrice}`;
            }
        }
    } else if (url.includes('flipkart')) {
        title = $('._35KyD6').text().trim();
        price = $('._1vC4OE._3qQ9m1').text().trim();
        imageUrl = $('._3BTv9X').find('img').attr('src');
    } else if (url.includes('meesho')) {
        title = $('span.sc-eDvSVe.fhfLdV').text().trim();
        price = $('h4.sc-eDvSVe.biMVPh').text().trim();
        imageUrl = $('div.ProductDesktopImage__ImageWrapperDesktop-sc-8sgxcr-0 img').attr('src');
    } else if (url.includes('snapdeal')) {
        title = $('h1[itemprop="name"]').text().trim();
        price = $('span[itemprop="price"]').text().trim();
        imageUrl = $('img[bigsrc]').attr('bigsrc');
    } else if (url.includes('croma')) {
        title = $('meta[property="og:title"]').attr('content');
        price = `₹${Math.floor(Math.random() * (20000 - 10000 + 1)) + 10000}`; // Simulated price
        imageUrl = $('img[data-testid="super-zoom-img-0"]').attr('data-src');
    } else {
        throw new Error('Unsupported website');
    }

    if (!title || !price || !imageUrl) {
        throw new Error('Failed to extract product details');
    }

    const websiteName = await getWebsiteName(url);

    console.log('Scraped product details:', { title, price, imageUrl, websiteName, url });
    return { title, price, imageUrl, websiteName, url };
};

// Modified routes to include user_id
app.get('/scrape', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: "URL is required" });
    }

    try {
        const productDetails = await scrapeProductDetails(url);
        res.json(productDetails);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch product details" });
    }
});

app.post('/add-to-cart', (req, res) => {
    const { title, price, imageUrl, websiteName, url, userId } = req.body;

    if (!title || !price || !imageUrl || !websiteName || !url || !userId) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    connection.query(
        'INSERT INTO cart (user_id, title, price, imageUrl, websiteName, url) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, title, price, imageUrl, websiteName, url],
        (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to add product to cart' });
            }
            res.json({ success: true });
        }
    );
});

app.get('/cart/:userId', (req, res) => {
    const { userId } = req.params;
    const sortOrder = req.query.sort === 'desc' ? 'DESC' : 'ASC';

    connection.query(
        `SELECT * FROM cart WHERE user_id = ? ORDER BY CAST(REPLACE(REPLACE(price, '₹', ''), ',', '') AS DECIMAL(10, 2)) ${sortOrder}`,
        [userId],
        (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch cart items' });
            }
            res.json(results);
        }
    );
});

app.delete('/delete-from-cart/:id/:userId', (req, res) => {
    const { id, userId } = req.params;

    connection.query(
        'DELETE FROM cart WHERE id = ? AND user_id = ?',
        [id, userId],
        (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to delete product from cart' });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Product not found' });
            }
            res.json({ success: true });
        }
    );
});

// Route to get cart items as a shareable text
app.get('/share-cart', (req, res) => {
    connection.query('SELECT * FROM cart', (err, results) => {
        if (err) {
            console.error('Error fetching cart items for sharing:', err);
            return res.status(500).json({ error: 'Failed to fetch cart items' });
        }

        let message = 'Shopping Cart:\n';
        results.forEach((item, index) => {
            message += `${index + 1}. ${item.title}\nPrice: ${item.price}\nWebsite: ${item.websiteName}\nURL: ${item.url}\n\n`;
        });

        res.json({ message });
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

