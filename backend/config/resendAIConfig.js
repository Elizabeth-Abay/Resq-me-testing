const { Resend } = require("resend");
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({
    path : path.join(__dirname , '../.env')
});


const { RESEND_API_KEY } = process.env;

const resend = new Resend(RESEND_API_KEY);

module.exports = resend;