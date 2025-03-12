import express from 'express';
import login from 'daiki-fca';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/get-appstate', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    try {
        const appstate = await new Promise((resolve, reject) => {
            login({ email, password }, (err, api) => {
                if (err) {
                    if (err.error === 'login-approval') {
                        return reject({ code: 'login-approval', message: 'Login approval required. Please check your device or email for confirmation code.' });
                    }
                    return reject(err);
                }

                resolve(api.getAppState());
            });
        });

        const logDir = path.join(__dirname, 'states');
        try {
            await fs.mkdir(logDir, { recursive: true });
            await fs.writeFile(
                path.join(logDir, `appstate_${Date.now()}.json`),
                JSON.stringify(appstate)
            );
        } catch (logErr) {
            console.error('Failed to log appstate:', logErr);
        }

        res.json({ success: true, appstate });
    } catch (error) {
        let errorMessage = 'An unknown error occurred';
        let statusCode = 500;

        if (error.code === 'login-approval') {
            statusCode = 403;
            errorMessage = error.message;
        } else if (error.error === 'Wrong username/password.') {
            statusCode = 401;
            errorMessage = 'Incorrect email or password';
        } else if (typeof error === 'object' && error !== null) {
            errorMessage = error.message || JSON.stringify(error);
        } else {
            errorMessage = String(error);
        }

        res.status(statusCode).json({ 
            success: false, 
            message: errorMessage 
        });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/get-appstate', (req, res) => {
    res.status(400).json({ success: false, message: 'Please put your email and password to get appstate and check your code.' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default app;
