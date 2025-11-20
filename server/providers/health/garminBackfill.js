/**
 * Garmin Wellness API Backfill Helpers
 *
 * These functions call Garmin's backfill endpoints to retrieve historical health data.
 * References:
 * - Garmin Wellness API docs: https://developer.garmin.com/gc-developer-program/wellness-api/
 * - Daily summaries endpoint: https://apis.garmin.com/wellness-api/rest/backfill/dailies
 * - Sleep summaries endpoint: https://apis.garmin.com/wellness-api/rest/backfill/sleeps
 */
/**
 * Fetch daily summaries from Garmin Wellness API
 * @param accessToken Bearer token for Garmin API
 * @param start Unix timestamp (seconds) for start of range
 * @param end Unix timestamp (seconds) for end of range
 * @returns Array of daily summary objects
 */
export async function backfillDailies(accessToken, start, end) {
    const url = new URL("https://apis.garmin.com/wellness-api/rest/backfill/dailies");
    url.searchParams.set("summaryStartTimeInSeconds", String(start));
    url.searchParams.set("summaryEndTimeInSeconds", String(end));
    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        }
    });
    if (!response.ok) {
        throw new Error(`Garmin dailies backfill failed: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}
/**
 * Fetch sleep summaries from Garmin Wellness API
 * @param accessToken Bearer token for Garmin API
 * @param start Unix timestamp (seconds) for start of range
 * @param end Unix timestamp (seconds) for end of range
 * @returns Array of sleep summary objects
 */
export async function backfillSleeps(accessToken, start, end) {
    const url = new URL("https://apis.garmin.com/wellness-api/rest/backfill/sleeps");
    url.searchParams.set("summaryStartTimeInSeconds", String(start));
    url.searchParams.set("summaryEndTimeInSeconds", String(end));
    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        }
    });
    if (!response.ok) {
        throw new Error(`Garmin sleeps backfill failed: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}
/**
 * Fetch HRV summaries from Garmin Wellness API
 * Note: HRV data is typically included in daily summaries under huvSummary field
 * @param accessToken Bearer token for Garmin API
 * @param start Unix timestamp (seconds) for start of range
 * @param end Unix timestamp (seconds) for end of range
 * @returns Array of HRV summary objects
 */
export async function backfillHRV(accessToken, start, end) {
    // HRV is typically part of daily summaries, but including separate function for future use
    const url = new URL("https://apis.garmin.com/wellness-api/rest/backfill/dailies");
    url.searchParams.set("summaryStartTimeInSeconds", String(start));
    url.searchParams.set("summaryEndTimeInSeconds", String(end));
    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        }
    });
    if (!response.ok) {
        throw new Error(`Garmin HRV backfill failed: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    // Extract HRV data from daily summaries
    if (Array.isArray(data)) {
        return data.map((daily) => ({
            calendarDate: daily.calendarDate,
            hrvSummary: daily.hrvSummary || null
        })).filter((item) => item.hrvSummary);
    }
    return data;
}
