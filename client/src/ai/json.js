import { z } from 'zod';
/**
 * Safely parse and validate JSON text against a Zod schema
 * Throws precise errors for both JSON parsing and schema validation
 */
export function ensureValid(schema, text) {
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch (jsonError) {
        if (jsonError instanceof SyntaxError) {
            throw new Error(`Invalid JSON: ${jsonError.message}`);
        }
        throw new Error(`JSON parsing failed: ${String(jsonError)}`);
    }
    try {
        return schema.parse(parsed);
    }
    catch (validationError) {
        if (validationError instanceof z.ZodError) {
            const errorMessages = validationError.errors.map(err => {
                const path = err.path.length > 0 ? ` at ${err.path.join('.')}` : '';
                return `${err.message}${path}`;
            }).join('; ');
            throw new Error(`Schema validation failed: ${errorMessages}`);
        }
        throw new Error(`Validation failed: ${String(validationError)}`);
    }
}
/**
 * Attempt to extract and validate JSON from text that may contain additional content
 * Useful when LLM responses include explanatory text around the JSON
 */
export function extractAndValidate(schema, text) {
    // Try to find JSON block between ```json and ``` or { and }
    const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
        text.match(/```\s*([\s\S]*?)\s*```/) ||
        text.match(/(\{[\s\S]*\})/);
    if (jsonBlockMatch) {
        return ensureValid(schema, jsonBlockMatch[1].trim());
    }
    // Try to find standalone JSON object
    const jsonMatch = text.match(/\{[^}]*\}/);
    if (jsonMatch) {
        return ensureValid(schema, jsonMatch[0]);
    }
    // Fall back to treating entire text as JSON
    return ensureValid(schema, text);
}
/**
 * Validate that parsed object is safe (no dangerous keys/values)
 * Basic security check for AI-generated content
 */
export function validateSafety(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return;
    }
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    const dangerousPatterns = [/eval\s*\(/, /function\s*\(/, /=>\s*{/, /require\s*\(/];
    function checkValue(value, path = '') {
        if (typeof value === 'string') {
            for (const pattern of dangerousPatterns) {
                if (pattern.test(value)) {
                    throw new Error(`Potentially unsafe content detected in ${path || 'value'}: ${pattern.source}`);
                }
            }
        }
        else if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
                value.forEach((item, index) => checkValue(item, `${path}[${index}]`));
            }
            else {
                for (const [key, val] of Object.entries(value)) {
                    if (dangerousKeys.includes(key)) {
                        throw new Error(`Dangerous key detected: ${key} at ${path}`);
                    }
                    checkValue(val, path ? `${path}.${key}` : key);
                }
            }
        }
    }
    checkValue(obj);
}
/**
 * Complete validation: JSON parsing + schema validation + safety check
 */
export function parseAndValidate(schema, text) {
    const result = ensureValid(schema, text);
    validateSafety(result);
    return result;
}
