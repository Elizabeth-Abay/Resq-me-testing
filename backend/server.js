const authRouter = require('./routes/AuthRoute');
const tokenRouter = require('./routes/tokenRoute');
const profileRouter = require('./routes/profileSetter')
const express = require('express');
const cors = require('cors');
const app = express();
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({
    path: path.resolve(__dirname, '../.env')
})

const { PORT } = process.env;


app.use(express.json());
app.use(cors({
    origin: '*'
}));
app.use('/auth', authRouter);
app.use('/token', tokenRouter);
app.use('/profile', profileRouter)

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// we need to have a route that only service providers can have so that they will be able to list who they are partnering with 