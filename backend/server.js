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
    origin: ['http://localhost:3000', 'https://resq-app-741m.onrender.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Routes - This is where your /api/reports lives
app.use('/reports', reportRoute);
app.use('/auth' , authRouter);
app.use('/profile' ,profileRelated );
app.use('/token' , tokenRoute);

// Health check endpoint
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

// 404 handler for undefined routes
// app.use('(.*)', (req, res) => {
//     console.log('404 - Route not found:', req.method, req.originalUrl);
//     res.status(404).json({ 
//         error: 'Not Found',
//         message: `Route ${req.method} ${req.originalUrl} not found`,
//         availableRoutes: [
//             'GET /health',
//             'POST /auth/sign-up',
//             'POST /auth/log-in',
//             'GET /auth/verify-email',
//             'POST /auth/resend-verification',
//             'POST /auth/log-out',
//             'GET /auth/resend-verification',
//             'POST /profile/create-my-profile',
//             'GET /profile/get-my-profile'
//         ]
//     });
// });



app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
});


