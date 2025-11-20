import { format } from 'date-fns';
class EnvironmentCache {
    constructor() {
        this.cache = new Map();
        this.CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in ms
    }
    generateKey(lat, lon, date, type) {
        return `${lat.toFixed(4)}|${lon.toFixed(4)}|${date}|${type}`;
    }
    get(lat, lon, date, type) {
        const key = this.generateKey(lat, lon, date, type);
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    set(lat, lon, date, type, data) {
        const key = this.generateKey(lat, lon, date, type);
        const now = Date.now();
        this.cache.set(key, {
            data,
            timestamp: now,
            expiresAt: now + this.CACHE_DURATION
        });
    }
    // Clean up expired entries periodically
    cleanup() {
        const now = Date.now();
        const entries = Array.from(this.cache.entries());
        for (const [key, entry] of entries) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }
}
const cache = new EnvironmentCache();
// Clean up cache every 6 hours
setInterval(() => cache.cleanup(), 6 * 60 * 60 * 1000);
// Utility function for API requests with timeout
async function fetchWithTimeout(url, timeoutMs = 3000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'AXLE-Fitness-App/1.0'
            }
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            return null;
        }
        return await response.json();
    }
    catch (error) {
        clearTimeout(timeoutId);
        return null;
    }
}
/**
 * Get solar data (sunrise/sunset) for a location and date
 * Uses Open-Meteo Sunrise API (no API key required)
 */
export async function getSolar(lat, lon, date) {
    const nullResult = {
        sunrise: null,
        sunset: null,
        dayLength: null
    };
    // Return null data if coordinates are missing
    if (lat == null || lon == null) {
        return nullResult;
    }
    try {
        const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
        // Check cache first
        const cached = cache.get(lat, lon, dateStr, 'solar');
        if (cached) {
            return cached;
        }
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;
        const data = await fetchWithTimeout(url);
        if (!data?.daily?.sunrise?.[0] || !data?.daily?.sunset?.[0]) {
            return nullResult;
        }
        const sunrise = data.daily.sunrise[0];
        const sunset = data.daily.sunset[0];
        // Calculate day length in hours
        let dayLength = null;
        if (sunrise && sunset) {
            const sunriseTime = new Date(sunrise).getTime();
            const sunsetTime = new Date(sunset).getTime();
            dayLength = (sunsetTime - sunriseTime) / (1000 * 60 * 60); // Convert to hours
        }
        const result = {
            sunrise,
            sunset,
            dayLength
        };
        // Cache the result
        cache.set(lat, lon, dateStr, 'solar', result);
        return result;
    }
    catch (error) {
        return nullResult;
    }
}
/**
 * Get weather data for a location and date
 * Uses Open-Meteo Forecast/Archive API (no API key required)
 */
export async function getWeather(lat, lon, date) {
    const nullResult = {
        temperature: null,
        humidity: null,
        windSpeed: null,
        precipitationProbability: null,
        uvIndex: null
    };
    // Return null data if coordinates are missing
    if (lat == null || lon == null) {
        return nullResult;
    }
    try {
        const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
        // Check cache first
        const cached = cache.get(lat, lon, dateStr, 'weather');
        if (cached) {
            return cached;
        }
        const today = format(new Date(), 'yyyy-MM-dd');
        const isToday = dateStr === today;
        const isPast = new Date(dateStr) < new Date(today);
        let url;
        if (isPast) {
            // Use historical weather API for past dates
            url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${dateStr}&end_date=${dateStr}&daily=temperature_2m_mean,relative_humidity_2m_mean,wind_speed_10m_max,precipitation_probability_mean,uv_index_max&timezone=auto`;
        }
        else {
            // Use forecast API for today and future dates
            url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_mean,relative_humidity_2m_mean,wind_speed_10m_max,precipitation_probability_mean,uv_index_max&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;
        }
        const data = await fetchWithTimeout(url);
        if (!data?.daily) {
            return nullResult;
        }
        const daily = data.daily;
        const result = {
            temperature: daily.temperature_2m_mean?.[0] || null,
            humidity: daily.relative_humidity_2m_mean?.[0] || null,
            windSpeed: daily.wind_speed_10m_max?.[0] || null,
            precipitationProbability: daily.precipitation_probability_mean?.[0] || null,
            uvIndex: daily.uv_index_max?.[0] || null
        };
        // Cache the result
        cache.set(lat, lon, dateStr, 'weather', result);
        return result;
    }
    catch (error) {
        return nullResult;
    }
}
/**
 * Get Air Quality Index data for a location and date
 * Uses OpenAQ API (no API key required, but fallback to null if unavailable)
 */
export async function getAQI(lat, lon, date) {
    const nullResult = {
        pm25: null,
        pm10: null,
        no2: null,
        o3: null,
        overallIndex: null
    };
    // Return null data if coordinates are missing
    if (lat == null || lon == null) {
        return nullResult;
    }
    try {
        const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
        // Check cache first
        const cached = cache.get(lat, lon, dateStr, 'aqi');
        if (cached) {
            return cached;
        }
        // OpenAQ API - get latest measurements within 50km radius
        const url = `https://api.openaq.org/v2/measurements?coordinates=${lat},${lon}&radius=50000&limit=100&order_by=datetime&sort=desc&date_from=${dateStr}&date_to=${dateStr}`;
        const data = await fetchWithTimeout(url, 5000); // Longer timeout for AQI
        if (!data?.results || !Array.isArray(data.results)) {
            return nullResult;
        }
        // Aggregate measurements by parameter
        const measurements = data.results;
        const parameterValues = {};
        measurements.forEach((measurement) => {
            if (measurement.parameter && typeof measurement.value === 'number') {
                if (!parameterValues[measurement.parameter]) {
                    parameterValues[measurement.parameter] = [];
                }
                parameterValues[measurement.parameter].push(measurement.value);
            }
        });
        // Calculate averages
        const getAverage = (param) => {
            const values = parameterValues[param];
            if (!values || values.length === 0)
                return null;
            return values.reduce((sum, val) => sum + val, 0) / values.length;
        };
        const pm25 = getAverage('pm25');
        const pm10 = getAverage('pm10');
        const no2 = getAverage('no2');
        const o3 = getAverage('o3');
        // Calculate simple overall index based on PM2.5 (if available)
        let overallIndex = null;
        if (pm25 !== null) {
            // Simplified AQI calculation based on PM2.5
            if (pm25 <= 12)
                overallIndex = 1; // Good
            else if (pm25 <= 35)
                overallIndex = 2; // Moderate
            else if (pm25 <= 55)
                overallIndex = 3; // Unhealthy for sensitive
            else if (pm25 <= 150)
                overallIndex = 4; // Unhealthy
            else if (pm25 <= 250)
                overallIndex = 5; // Very unhealthy
            else
                overallIndex = 6; // Hazardous
        }
        const result = {
            pm25,
            pm10,
            no2,
            o3,
            overallIndex
        };
        // Cache the result
        cache.set(lat, lon, dateStr, 'aqi', result);
        return result;
    }
    catch (error) {
        // AQI is optional, so we gracefully degrade to null
        return nullResult;
    }
}
/**
 * Get comprehensive environment data combining solar, weather, and AQI
 */
export async function getEnvironment(lat, lon, date) {
    const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
    // If coordinates are missing, return null data but with valid structure
    if (lat == null || lon == null) {
        return {
            solar: {
                sunrise: null,
                sunset: null,
                dayLength: null
            },
            weather: {
                temperature: null,
                humidity: null,
                windSpeed: null,
                precipitationProbability: null,
                uvIndex: null
            },
            aqi: {
                pm25: null,
                pm10: null,
                no2: null,
                o3: null,
                overallIndex: null
            },
            location: null,
            date: dateStr,
            timestamp: Date.now()
        };
    }
    try {
        // Check if we have a complete cached entry
        const cached = cache.get(lat, lon, dateStr, 'environment');
        if (cached) {
            return cached;
        }
        // Fetch all data in parallel
        const [solar, weather, aqi] = await Promise.all([
            getSolar(lat, lon, dateStr),
            getWeather(lat, lon, dateStr),
            getAQI(lat, lon, dateStr)
        ]);
        const result = {
            solar,
            weather,
            aqi,
            location: { lat, lon },
            date: dateStr,
            timestamp: Date.now()
        };
        // Cache the complete result
        cache.set(lat, lon, dateStr, 'environment', result);
        return result;
    }
    catch (error) {
        // Return safe null structure if everything fails
        return {
            solar: {
                sunrise: null,
                sunset: null,
                dayLength: null
            },
            weather: {
                temperature: null,
                humidity: null,
                windSpeed: null,
                precipitationProbability: null,
                uvIndex: null
            },
            aqi: {
                pm25: null,
                pm10: null,
                no2: null,
                o3: null,
                overallIndex: null
            },
            location: lat != null && lon != null ? { lat, lon } : null,
            date: dateStr,
            timestamp: Date.now()
        };
    }
}
