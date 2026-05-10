import { google } from 'googleapis';

// Initialize Google OAuth2 Client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3000' // This doesn't strictly matter for background fetching with refresh token
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

export const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

export async function getGoogleSheetData(spreadsheetId: string, range: string) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: 'FORMATTED_VALUE',
    });

    return response.data.values;
  } catch (error) {
    console.error('Error fetching Google Sheet data:', error);
    throw error;
  }
}

export async function findLastPopulatedRow(spreadsheetId: string, sheetName: string) {
  try {
    // Fetch just the Timestamp column to find where actual data ends
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A1:A`,
    });
    const values = response.data.values || [];
    
    // Iterate backward to find last row with text
    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i] && values[i][0] && values[i][0].toString().trim() !== '') {
        return i + 1; // Return 1-indexed row number
      }
    }
    return values.length;
  } catch (error) {
    console.error('Error scanning column A:', error);
    return 5000; // fallback
  }
}
