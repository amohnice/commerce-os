import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';
import { createLogger } from './utils/logger.js';
import { whatsappRouter } from './routes/whatsapp.js';
import { mpesaRouter } from './routes/mpesa.js';
import { merchantRouter } from './routes/merchant.js';
import { errorHandler } from './middleware/errorHandler.js';
import { tenantMiddleware } from './middleware/tenant.js';

// Load environment variables
dotenv.config();

const app: Application = express();
const logger = createLogger('Server');
const PORT = process.env.PORT || 3000;

// =============================================
// SECURITY & MIDDLEWARE
// =============================================

// Security headers
app.use(helmet());

// CORS
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
    });
    next();
});

// =============================================
// LANDING PAGE & HEALTH CHECK
// =============================================

app.get('/', (_req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Commerce OS | AI-Powered Conversational Commerce</title>
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
            <style>
                :root {
                    --primary: #6366f1;
                    --primary-hover: #4f46e5;
                    --bg: #0f172a;
                    --glass: rgba(30, 41, 59, 0.7);
                    --text: #f8fafc;
                    --text-muted: #94a3b8;
                }
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Outfit', sans-serif;
                    background: var(--bg);
                    color: var(--text);
                    line-height: 1.6;
                    overflow-x: hidden;
                }
                .hero {
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    padding: 2rem;
                    background: radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.1) 0%, transparent 50%);
                }
                .glass-card {
                    background: var(--glass);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 3rem;
                    border-radius: 2rem;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    max-width: 800px;
                    width: 100%;
                }
                h1 {
                    font-size: 4rem;
                    font-weight: 800;
                    background: linear-gradient(to right, #818cf8, #c084fc);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin-bottom: 1rem;
                }
                p {
                    font-size: 1.25rem;
                    color: var(--text-muted);
                    margin-bottom: 2rem;
                }
                .badge {
                    background: rgba(99, 102, 241, 0.1);
                    color: var(--primary);
                    padding: 0.5rem 1rem;
                    border-radius: 9999px;
                    font-size: 0.875rem;
                    font-weight: 600;
                    margin-bottom: 1rem;
                    display: inline-block;
                }
                .features {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1.5rem;
                    margin-top: 3rem;
                    text-align: left;
                }
                .feature-item {
                    padding: 1.5rem;
                    border-radius: 1rem;
                    background: rgba(255, 255, 255, 0.03);
                }
                .feature-item h3 { font-size: 1.1rem; margin-bottom: 0.5rem; color: #818cf8; }
                .footer {
                    margin-top: 4rem;
                    padding-top: 2rem;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                    font-size: 0.875rem;
                    color: var(--text-muted);
                }
            </style>
        </head>
        <body>
            <div class="hero">
                <div class="badge">Next Generation Commerce</div>
                <h1>Commerce OS</h1>
                <div class="glass-card">
                    <p>Unlock the power of conversational commerce. Our platform uses advanced AI to automate sales, customer engagement, and order management directly through WhatsApp.</p>
                    <div class="features">
                        <div class="feature-item">
                            <h3>AI Sales Agent</h3>
                            <p style="font-size: 0.9rem;">Automated product discovery and personalized shopping experiences.</p>
                        </div>
                        <div class="feature-item">
                            <h3>Instant Payments</h3>
                            <p style="font-size: 0.9rem;">Secure M-Pesa integration for seamless checkout flows.</p>
                        </div>
                        <div class="feature-item">
                            <h3>Order Tracking</h3>
                            <p style="font-size: 0.9rem;">End-to-end management from conversation to delivery.</p>
                        </div>
                    </div>
                </div>
                <div class="footer">
                    Built for modern businesses. &copy; 2024 Commerce OS. All rights reserved.
                </div>
            </div>
        </body>
        </html>
    `);
});

app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// =============================================
// API ROUTES
// =============================================

// WhatsApp webhooks (no auth needed - verified via token)
app.use('/webhooks/whatsapp', whatsappRouter);

// M-Pesa callbacks (verified via signature)
app.use('/webhooks/mpesa', mpesaRouter);

// Merchant API (requires authentication)
app.use('/api/merchant', tenantMiddleware, merchantRouter);

// =============================================
// ERROR HANDLING
// =============================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
    });
});

// Global error handler
app.use(errorHandler);

// =============================================
// START SERVER
// =============================================

if (process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === undefined) {
    app.listen(PORT, () => {
        logger.info(`🚀 Commerce OS running on port ${PORT}`);
        logger.info(`📱 WhatsApp webhook: ${process.env.API_BASE_URL}/webhooks/whatsapp`);
        logger.info(`💰 M-Pesa callback: ${process.env.API_BASE_URL}/webhooks/mpesa`);
        logger.info(`🏪 Environment: ${process.env.NODE_ENV}`);
    });
}

export default app;

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
});
