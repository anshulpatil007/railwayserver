const axios = require('axios');
const cheerio = require('cheerio');

// Replace with the actual Croma product URL
const URL = 'https://www.croma.com/redmi-13-5g-6gb-ram-128gb-black-diamond-/p/307689';

(async () => {
    try {
        const response = await axios.get(URL);
        const $ = cheerio.load(response.data);
        
        // Extract the product title
        const title = $('meta[property="og:title"]').attr('content');
        if (title) {
            console.log('Product Title:', title);
        } else {
            console.log('Product title not found. The HTML structure may have changed.');
        }

        // Extract the JSON-LD content
        const jsonLdContent = $('script[type="application/ld+json"]').html();
        console.log('Raw JSON-LD Content:', jsonLdContent); // Log the raw JSON-LD content

        // Clean up the JSON string
        const cleanedJson = jsonLdContent.trim().replace(/[\r\n]+/g, '').replace(/\s+/g, ' ');
        console.log('Cleaned JSON-LD Content:', cleanedJson); // Log the cleaned JSON-LD content
        
        // Parse JSON, catching any parsing errors
        let jsonLdData;
        try {
            jsonLdData = JSON.parse(cleanedJson);
        } catch (parseError) {
            console.error('Error parsing JSON:', parseError);
            return;
        }

        // Get the price from the JSON-LD
        const price = jsonLdData.offers.price; 
        if (price) {
            console.log('Price: ₹', price);
        } else {
            console.log('Price not found. The HTML structure may have changed.');
        }

        // Extract the product image URL
        const imageUrl = $('img[data-testid="super-zoom-img-0"]').attr('data-src');
        if (imageUrl) {
            console.log('Product Image URL:', imageUrl);
        } else {
            console.log('Product image URL not found. The HTML structure may have changed.');
        }

        // Extract the rating
        const rating = $('div.cp-rating span').first().text().trim();
        if (rating) {
            console.log('Rating:', rating);
        } else {
            console.log('Rating not found. The HTML structure may have changed.');
        }

    } catch (error) {
        console.error('Error fetching the URL:', error);
    }
})();
