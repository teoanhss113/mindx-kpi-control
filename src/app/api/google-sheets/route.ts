import { NextRequest, NextResponse } from 'next/server';
import { sheets } from '@/lib/googleSheets';
import { normalizeCenterHint } from '@/lib/googleSheetsMatching';
import { requireUser, authErrorResponse } from '@/lib/auth/serverAuth';

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    const { searchParams } = new URL(request.url);
    const spreadsheetId = searchParams.get('spreadsheetId') || process.env.GOOGLE_SPREADSHEET_ID;
    const sheetName = searchParams.get('sheetName') || 'Form Responses 1';
    const fromDateStr = searchParams.get('fromDate');
    const toDateStr = searchParams.get('toDate');
    const centerFilter = searchParams.get('center'); 

    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Missing spreadsheet ID' }, { status: 400 });
    }

    // 1. Step A: Fetch Headers & ALL Timestamps to find boundaries
    const lookupRes = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [`'${sheetName}'!A1:Z1`, `'${sheetName}'!A2:A`],
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const headers = lookupRes.data.valueRanges?.[0]?.values?.[0] || [];
    const timestamps = lookupRes.data.valueRanges?.[1]?.values || [];

    if (timestamps.length === 0) {
      return NextResponse.json({ data: [], totalScanned: 0, message: 'Sheet is empty' });
    }

    // Determine Date Boundaries
    const queryStart = fromDateStr ? new Date(fromDateStr) : null;
    if (queryStart) queryStart.setHours(0, 0, 0, 0);

    const queryEnd = toDateStr ? new Date(toDateStr) : null;
    if (queryEnd) queryEnd.setHours(23, 59, 59, 999);

    let startRowIdx = -1;
    let endRowIdx = -1;

    const parseSheetDate = (val: any) => {
       if (!val) return null;
       const d = new Date(val.toString());
       return isNaN(d.getTime()) ? null : d;
    };

    for (let i = 0; i < timestamps.length; i++) {
       const rawVal = timestamps[i]?.[0];
       const rowDate = parseSheetDate(rawVal);
       if (!rowDate) continue;

       if (queryStart && rowDate >= queryStart && startRowIdx === -1) {
         startRowIdx = i;
       }
       if (queryEnd && rowDate <= queryEnd) {
         endRowIdx = i;
       }
    }

    const totalCount = timestamps.length;
    if (!queryStart) {
       startRowIdx = Math.max(0, totalCount - 2000);
    } else if (startRowIdx === -1) {
       return NextResponse.json({ data: [], message: 'No data found in selected range.' });
    }

    if (!queryEnd) {
       endRowIdx = totalCount - 1;
    } else if (endRowIdx === -1) {
       return NextResponse.json({ data: [], message: 'No data found prior to end date.' });
    }

    if (startRowIdx > endRowIdx) {
       return NextResponse.json({ data: [], message: 'Invalid time range selected.' });
    }

    const startRow = startRowIdx + 2; 
    const endRow = endRowIdx + 2;
    
    const dataRange = `'${sheetName}'!A${startRow}:Z${endRow}`;
    const dataRes = await sheets.spreadsheets.values.get({
       spreadsheetId,
       range: dataRange,
       valueRenderOption: 'FORMATTED_VALUE'
    });

    const dataRows = dataRes.data.values || [];

    // ─── Helper: Extract True Acronym ───
    // Gets all letters following the very last digit, or falls back to all letters.
    // E.g. "39HTLO" -> "HTLO", "672A28PVT" -> "PVT", "29T1HDT" -> "HDT", "VT" -> "VT"
    const getTrueAcronym = (s: string) => {
       const str = s.toUpperCase();
       const digits = str.match(/\d/g);
       if (!digits) return str.replace(/[^A-Z]/g, '');
       
       // Find last digit position
       const lastIdx = str.split('').map((c, i) => /\d/.test(c) ? i : -1).reduce((max, i) => Math.max(max, i), -1);
       const afterLastDigit = str.slice(lastIdx + 1).replace(/[^A-Z]/g, '');
       
       // Use trailing letters if they seem like a viable acronym (len >= 2), fallback to simple extract
       return afterLastDigit.length >= 2 ? afterLastDigit : str.replace(/[^A-Z]/g, '');
    };

    // Extract target structures
    const filterTargets = centerFilter?.toUpperCase().split(',')
       .map(c => c.trim())
       .filter(Boolean) || [];

    let results = dataRows.map((row: any) => {
      const item: Record<string, any> = {};
      headers.forEach((header: string, index: number) => {
        item[header] = row[index] || '';
      });
      return item;
    }).filter(r => Object.values(r).some(v => v !== '')); 

    // ─── ULTIMATE TWO-TIER FILTER SIEVE ───
    if (filterTargets.length > 0) {
       results = results.filter(item => {
         const rawSheetVal = (item['Mã cơ sở của em là?'] || '').toString();
         // 1. Normalize: Maps "BH" -> "253PVT", "PVT" -> "672A28PVT"
         const normalizedVal = normalizeCenterHint(rawSheetVal).toUpperCase();
         
         if (!normalizedVal) return false;

         return filterTargets.some(target => {
            const hasNumTarget = /\d/.test(target);
            const hasNumVal = /\d/.test(normalizedVal);

            // MODE A: Digital Disambiguation 
            // If both are fully resolved unique codes (have numbers), force exact equality.
            // Prevents "253PVT" leaking into "672A28PVT".
            if (hasNumTarget && hasNumVal) {
               return target === normalizedVal;
            }

            // MODE B: Pure Acronym Alignment
            // Extract true center letters (stripping address characters).
            // E.g. "672A28PVT" -> "PVT". "VT" -> "VT".
            // Forces strict identity "PVT" !== "VT", decapitating substring leaks!
            const targetAcronym = getTrueAcronym(target);
            const valAcronym = getTrueAcronym(normalizedVal);
            
            return targetAcronym === valAcronym;
         });
       });
    }

    // Newest first for display
    results.reverse();

    return NextResponse.json({ 
      totalRowsScanned: timestamps.length,
      boundedRange: dataRange,
      data: results 
    });

  } catch (error: any) {
    return authErrorResponse(error);
  }
}
