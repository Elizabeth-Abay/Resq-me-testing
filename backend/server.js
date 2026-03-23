const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const EmergencyNotificationHandlerObj = require('./model/notifListener');
const pool = require('./config/pgConnection');



const authRouter = require('./routes/AuthRoute');
const reportRoute = require('./routes/emergencyReport');
const profileRelated = require('./routes/profileRelated');
const tokenRoute = require('./routes/tokenRoute');
const { ref } = require('process');


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
app.use('/auth' , authRouter);
app.use('/profile' ,profileRelated );
app.use('/token' , tokenRoute);

app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        routes: {
            auth: {
                'POST /auth/sign-up': 'User registration',
                'POST /auth/log-in': 'User login', 
                'GET /auth/verify-email': 'Email verification (deep link)',
                'POST /auth/resend-verification': 'Resend verification via email',
                'GET /auth/resend-verification': 'Resend verification via userId',
                'POST /auth/log-out': 'User logout'
            }
        }
    });
});



app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
    console.log("App is up and running");
});


