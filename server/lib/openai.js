// server/lib/openai.ts (Express dev)
import OpenAI from "openai";
export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 60000, // 60 second timeout
    maxRetries: 2
});
