const { AssemblyAI } = require('assemblyai');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({
    path: path.join(__dirname, '../../.env')
});

let { ASSEMBLY_AI_API_KEY } = process.env;

// console.log('AssemblyAI API Key from environment variables:', ASSEMBLY_AI_API_KEY);

const client = new AssemblyAI({
    apiKey: ASSEMBLY_AI_API_KEY
});


// console.log("client " , client);

module.exports = client;
