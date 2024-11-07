const axios = require('axios');
const cheerio = require('cheerio');

// Replace with the actual Croma product URL
const URL = 'https://www.croma.com/redmi-13-5g-6gb-ram-128gb-black-diamond-/p/307689';

(async () => {
    try {
        const response = await axios.get(URL);
        const $ = cheerio.load(response.data);
        
        // Extract the JSON-LD content
        const jsonLdContent = $('script[type="application/ld+json"]').html();

        // Clean up the JSON string
        const cleanedJson = jsonLdContent.trim().replace(/[\r\n]+/g, '').replace(/\s+/g, ' ');
        console.log('Cleaned JSON-LD Content:', cleanedJson); // Log the cleaned JSON-LD content
        
        // Parse JSON, catching any parsing errors
        let jsonLdData;
        try {
            jsonLdData = JSON.parse(cleanedJson);
            const price = jsonLdData.offers.price; // Extracting the price
            console.log('Price:', price); // Output the price
        } catch (parseError) {
            console.error('Error parsing JSON:', parseError);
        }

    } catch (error) {
        console.error('Error fetching the URL:', error);
    }
})();
