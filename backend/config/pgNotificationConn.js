// configuring pg to listen to database notifications
const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({
    path: path.resolve(__dirname, '../../.env')
})


const { DATA_BASE_USER, DATA_BASE_USER_PASSWORD, DATA_BASE_HOST, DATA_BASE } = process.env;

const notificationPool = new pg.Pool({
    host: DATA_BASE_HOST,
    user: DATA_BASE_USER,
    password: DATA_BASE_USER_PASSWORD,
    database: DATA_BASE,
    max: 1
});


module.exports = notificationPool;