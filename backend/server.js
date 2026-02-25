const express = require('express');
const cors = require('cors');
const dotenv = requrire('dotenv');
const path = require('path');


const authRouter = require('./routes/AuthRoute');
const reportRoute = require('./routes/emergencyReport');
const profileRelated = require('./routes/profileRelated');
const tokenRoute = require('./routes/tokenRoute');


dotenv.config({
    path : path.join(__dirname , '../.env')
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin : '*'
}));

app.use(express.json());

// Routes - This is where your /api/reports lives
app.use('/reports', reportRoute);
app.use('/user' , authRouter);
app.use('/profile' ,profileRelated );
app.use('/token' , tokenRoute);



app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
});