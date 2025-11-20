// Import the Express app
let app = null;
async function getApp() {
    if (!app) {
        // Import the Express app with .js extension (required for Node ESM)
        const { default: expressApp } = await import('../server/app.js');
        app = expressApp;
    }
    return app;
}
export default async function handler(req, res) {
    try {
        const expressApp = await getApp();
        // Pass request directly to Express
        return new Promise((resolve, reject) => {
            expressApp(req, res, (err) => {
                if (err)
                    reject(err);
                else
                    resolve(undefined);
            });
        });
    }
    catch (error) {
        console.error('[SERVERLESS] Fatal error:', error);
        console.error('[SERVERLESS] Error stack:', error?.stack);
        console.error('[SERVERLESS] Current directory:', process.cwd());
        console.error('[SERVERLESS] Module paths:', require.resolve.paths?.(''));
        return res.status(500).json({
            ok: false,
            error: {
                code: 'SERVERLESS_ERROR',
                message: error?.message || 'Internal server error',
                stack: error?.stack,
                cwd: process.cwd()
            }
        });
    }
}
// Vercel configuration
export const config = {
    maxDuration: 30,
};
