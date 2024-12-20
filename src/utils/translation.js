const axios = require('axios');
const { JSDOM } = require('jsdom');

async function translateText(text, fromLang = 'auto', toLang = 'en') {
    try {
        const url = `https://translate.google.com/m?hl=en&sl=${fromLang}&tl=${toLang}&ie=UTF-8&prev=_m&q=${encodeURIComponent(text)}`;
        const response = await axios.get(url);
        const dom = new JSDOM(response.data);
        const translatedText = dom.window.document.querySelector('.result-container')?.textContent;
        return translatedText || 'Translation not available';
    } catch (error) {
        console.error('Error translating text:', error);
        return 'Translation error';
    }
}

module.exports = { translateText };
