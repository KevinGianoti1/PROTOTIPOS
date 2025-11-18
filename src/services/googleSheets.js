const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;

const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

/**
 * Fetches data from a specific range in the Google Sheet.
 * @param {string} range - The A1 notation of the range to fetch (e.g., 'Sheet1!A1:B2').
 * @returns {Promise<Array<Array<string>>>} - A promise that resolves to a 2D array of values.
 */
export const fetchSheetData = async (range) => {
    if (!API_KEY || !SPREADSHEET_ID) {
        console.warn('Google Sheets API Key or Spreadsheet ID is missing.');
        return [];
    }

    try {
        const response = await fetch(
            `${BASE_URL}/${SPREADSHEET_ID}/values/${range}?key=${API_KEY}`
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to fetch data from Google Sheets');
        }

        const data = await response.json();
        return data.values || [];
    } catch (error) {
        console.error('Error fetching sheet data:', error);
        throw error;
    }
};

export const parseCurrency = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    // Remove "R$", spaces, and dots (thousands separator), then replace comma with dot (decimal)
    const cleanValue = value.replace(/[R$\s.]/g, '').replace(',', '.');
    return parseFloat(cleanValue) || 0;
};
