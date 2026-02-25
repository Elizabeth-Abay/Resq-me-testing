const { OpenAI } = require('openai');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({
    path: path.join(__dirname, '../../.env')
});

let { OPEN_AI_API_KEY } = process.env;

const openai = new OpenAI({
    apiKey: OPEN_AI_API_KEY
});


module.exports = openai;
