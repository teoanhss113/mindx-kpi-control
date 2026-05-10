/**
 * Utility for matching messy user-input Google Sheets data with clean LMS data
 */

// Basic Vietnamese accent removal and lowercase
export function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .trim();
}

// Extract the True Acronym (letters after final digit)
// e.g. "672A28PVT" -> "PVT", "29T1HDT" -> "HDT", "39HTLO" -> "HTLO"
export function getTrueAcronym(s: string): string {
  const str = (s || '').toUpperCase().trim();
  const digits = str.match(/\d/g);
  if (!digits) return str.replace(/[^A-Z]/g, '');
  
  // Locate indices of all digits and find the absolute last position
  const lastIdx = str.split('').reduce((max, char, idx) => /\d/.test(char) ? idx : max, -1);
  const afterLastDigit = str.slice(lastIdx + 1).replace(/[^A-Z]/g, '');
  
  // Return the post-digit acronym if viable (len >= 2), fallback to general alphabetic extraction
  return afterLastDigit.length >= 2 ? afterLastDigit : str.replace(/[^A-Z]/g, '');
}
// Generate an order-independent structural signature for a code (Digits:LettersSorted)
export function getJumbleKey(str: string): string {
  const c = (str || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const digits = c.replace(/[^0-9]/g, '');
  const letters = c.replace(/[^A-Z]/g, '').split('').sort().join('');
  return digits && letters ? `${digits}:${letters}` : c;
}

// Clean standard typos (e.g., Telex errors like ARM -> ẢM)
export function fixClassTypo(classStr: string): string {
  if (!classStr) return '';
  
  let cleaned = classStr.toUpperCase().trim();

  // 0. Strip conversational garbage prefixes like "MÃ LỚP :"
  cleaned = cleaned.replace(/^(MA LOP|LOP|TEN LOP)\s*[:\-]*\s*/g, '')
                   .replace(/^[:\s-]+/, ''); // Dangling punctuation at start

  // 1. Fix common Telex/Autocorrect corruption BEFORE stripping anything
  cleaned = cleaned.replace(/ẢM/g, 'ARM')
                   .replace(/ỎM/g, 'ROM')
                   .replace(/ÁRT/g, 'ART')
                   .replace(/XÁRT/g, 'XART')
                   .replace(/ẢT/g, 'ART') 
                   .replace(/ẢRT/g, 'ART');

  // 1B. Fix Intensive Level 'L' vs 'I' confusion (Vcl11 -> VCI11)
  // Only perform on specific course families to avoid nuking valid strings like HTML5
  cleaned = cleaned.replace(/VCL([0-9]+)/g, 'VCI$1')
                   .replace(/GDL([0-9]+)/g, 'GDI$1')
                   .replace(/ARML([0-9]+)/g, 'ARMI$1');

  // 2. Fix Digit confusion typos (Letter 'O' at end of codes is almost always '0')
  // Expanded to catch arbitrary standalone or connected O-digits (e.g. O7, VAAO7)
  cleaned = cleaned.replace(/([A-Z])O([0-9])/g, '$10$2') 
                   .replace(/([A-Z])O([0-9])/g, '$10$2') // Double pass for sequential
                   .replace(/O([0-9])/g, '0$1'); // Standalone O prefixing digit

  // 3. Clean up format without stripping structure
  cleaned = cleaned
    .replace(/\s+/g, ' ')          // Collapse multiple spaces
    .replace(/[\u2010-\u2015,;_]/g, '-') // ABSOLUTELY critical: Replace ALL dash variants, commas, underscores with hyphens
    .replace(/[-\s]+/g, '-')       // Join space-separated hyphens
    .replace(/[^A-Z0-9\-]/g, '');  // Strip non-alphanumeric except hyphen

  // Clean dangling hyphens at ends
  return cleaned.replace(/^-+|-+$/g, '');
}

/**
 * Matches a messy student name against a list of official names
 */
export function matchStudentName(inputName: string, targetName: string): boolean {
  const input = normalizeString(inputName);
  const target = normalizeString(targetName);

  if (!input || !target) return false;
  if (target.includes(input) || input.includes(target)) return true;

  const inputTokens = input.split(/\s+/).filter(t => t.length > 0);
  const targetTokens = target.split(/\s+/).filter(t => t.length > 0);

  if (inputTokens.length === 1 && targetTokens.includes(inputTokens[0])) return true;

  let matchCount = 0;
  for (const t of inputTokens) {
    if (targetTokens.includes(t)) matchCount++;
  }

  return matchCount >= Math.ceil(inputTokens.length * 0.5);
}

export interface RawSheetRow {
  [key: string]: string;
}

export interface MatchResult {
  row: RawSheetRow;
  matchedClass?: any; 
  matchScore: number; 
  matchReason: string[];
  suggestedClassId?: string;
  studentName: string;
  inputClassCode: string;
  normalizedClassCode: string; 
  centerHint: string;
  timestamp: string;
}

/**
 * Intelligent normalizer for chaotic user-entered Center Codes.
 * Translates Vietnamese full names and shorthand into canonical alphabetic codes.
 */
export function normalizeCenterHint(rawInput: string): string {
  if (!rawInput) return '';
  
  // Step 1: Strip parenthetical clutter like "CT (CẦN THƠ)" -> "CT"
  let cleaned = rawInput.toUpperCase().trim();
  if (cleaned.includes('(')) {
    cleaned = cleaned.split('(')[0].trim();
  }

  // Step 2: Normalized lowercase lookup for explicit full name aliases
  const normFull = normalizeString(cleaned);
  const aliases: Record<string, string> = {
    'truong chinh': 'TC',
    'ten lua': 'TL',
    'ham nghi': 'VHHN',
    'di an': 'NAN',
    'da': 'NAN',
    'can tho': 'CT',
    'long bien': 'LB',
    'pham van dong': 'PVD',
    'minh khai': 'MK',
    'vinh phuc': 'VP',
    'ocean park': 'OCP',
    'oceanpark': 'OCP',
    'thanh hoa': 'TH',
    'thai nguyen': 'TN',
    'nguyen phong sat': 'NPS',
    'le van viet': 'LVV',
    'nguyen van cu': 'NVC',
    'nguyen huu tho': 'NHT',
    'digital art': 'DArt',
    'dart': 'DArt',
    'hcm tc': 'TC',
    'hcm-tc': 'TC',
    'bh': '253PVT', // User directive: BH points specifically here
    'bien hoa': '253PVT',
    'pvt': '672A28PVT' // User directive: PVT default goes to this one
  };

  // Check if full lowercase phrase is in dictionary
  for (const [key, val] of Object.entries(aliases)) {
     if (normFull.includes(key)) return val.toUpperCase();
  }

  // Step 3: Pure alphanumeric fallback (e.g. "01 TC" -> "01TC")
  return cleaned.replace(/[^A-Z0-9]/g, '');
}

/**
 * Attempts to match a row to existing classes
 * @param row Raw Google Sheet item
 * @param classes All classes fetched from LMS
 */
export function findBestMatch(row: RawSheetRow, classes: any[]): MatchResult {
  const timestamp = row['Timestamp'] || '';
  let studentName = (row['Tên của em là?'] || '').toString().trim();
  let inputClass = (row['Mã lớp của em là?'] || '').toString().trim();
  let rawCenterCode = (row['Mã cơ sở của em là?'] || '').toString().trim();

  // --- GUARDIAN 1: Name / Class Cross-Swap Rescue ---
  // Normalize unicode dashes for accurate structural inspection without converting spaces yet!
  const testName = studentName.toUpperCase().replace(/[\u2010-\u2015]/g, '-');
  const testClass = inputClass.toUpperCase().replace(/[\u2010-\u2015]/g, '-');
  
  // Identification Vector: A real name possesses no numerical identifiers.
  const isNameActuallyCode = testName.includes('-') && /\d/.test(testName);
  const isClassActuallyName = !/\d/.test(testClass) && inputClass.length > 4;

  if (isNameActuallyCode && isClassActuallyName) {
      // Definitively swap to repair structural schema integrity
      const tempClass = studentName;
      studentName = inputClass;
      inputClass = tempClass;
  }

  // CRITICAL SAFEGUARD: Column Swap Protection
  // Run a temporary normalization check to expose true underlying structure (dashes, etc)
  const checkCenter = fixClassTypo(rawCenterCode);
  const checkClass = fixClassTypo(inputClass);
  
  const isCenterStructured = checkCenter.includes('-') && checkCenter.length > 6;
  const isClassWeak = !checkClass.includes('-') || checkClass.length < 5;
  
  if (isCenterStructured && isClassWeak) {
     // Force borrowing the structured code hidden in Center column
     inputClass = rawCenterCode;
  }

  let rawNormalized = fixClassTypo(inputClass);
  
  // Run Intelligent Mapping on Center Code
  let cleanCenter = normalizeCenterHint(rawCenterCode);

  // Decide if we should prepend center
  let normalizedClassCode = rawNormalized;
  
  // Intelligent Smart-Prepend Logic:
  // 1. Get the CLEAN true acronym of the selected center (e.g., "672A28PVT" -> "PVT")
  const centerCleanToken = getTrueAcronym(cleanCenter);
  
  // 2. Extract potential acronym, routing through the Alias Engine to detect cross-center identities!
  // (e.g. firstSegment="BH" -> normalizeCenterHint("BH")="253PVT" -> getTrueAcronym()="PVT")
  const firstSegment = rawNormalized.split('-')[0] || '';
  const inputFirstAcronym = getTrueAcronym(normalizeCenterHint(firstSegment));
 
  // 3. ONLY PREPEND if the code is actually fragmentary!
  // A fully formed code follows the pattern A-B-C and inherently has 2+ hyphens!
  // (e.g. "PMH-XART-VCI18" has 2 hyphens -> REFUSE PREPEND -> Perfectly isolates cross-center leaks!)
  const hyphenCount = (rawNormalized.match(/-/g) || []).length;
  const isAlreadyFullCode = hyphenCount >= 2;
  
  if (centerCleanToken && rawNormalized) {
    const alreadyStarts = centerCleanToken === inputFirstAcronym;
    
    // ONLY execute the rescue prepend if code is partial AND lacks explicit center declaration
    if (!alreadyStarts && !isAlreadyFullCode) {
      normalizedClassCode = `${centerCleanToken}-${rawNormalized}`;
    }
  }

  // For matching engine, make it ultra-normalized (no hyphens)
  const comparisonInput = normalizedClassCode.replace(/[^A-Z0-9]/g, '').toLowerCase();
  const normCenterLetters = cleanCenter.replace(/[^A-Z]/gi, '').toLowerCase();

  const inputJumble = getJumbleKey(normalizedClassCode);

  let bestMatch: any = null;
  let highestScore = 0;
  let bestReasons: string[] = [];

  for (const cls of classes) {
    let score = 0;
    let reasons: string[] = [];
    
    const lmsClassName = (cls.className || cls.name || '').toUpperCase();
    const comparisonLms = lmsClassName.replace(/[^A-Z0-9]/g, '').toLowerCase();
    const lmsCentreShort = normalizeString(cls.centreName || cls.centre?.shortName || '');
    const lmsJumble = getJumbleKey(lmsClassName);

    // Rule 1: Substring match against structured string
    if (comparisonInput.length > 3 && comparisonLms.includes(comparisonInput)) {
      score += 60;
      reasons.push('Trùng mã lớp (tương đối)');
      
      if (comparisonLms === comparisonInput) {
        score += 20; 
        reasons.push('Trùng khớp hoàn toàn mã lớp');
      }
    }

    // Rule 1B: Jumbled Canonical Equivalency
    // Detects when user entered right elements in wrong order (e.g. "OFF-TT" instead of "TT-OFF")
    if (inputJumble.length > 4 && inputJumble === lmsJumble) {
       if (!reasons.includes('Trùng mã lớp (tương đối)')) {
          score += 75; // Powerful boost for structured match
          reasons.push('Khớp cấu trúc nội dung (đảo vị trí)');
       }
    }

    // Rule 1C: Fractional Letter Subset Containment (Deep Typo Tie-Breaker)
    // Helps distinguish class ties (e.g. multiple classes numbered 11) by prioritizing 
    // the candidate that mathematically contains the user's alphanumeric footprint.
    const lmsLets = lmsJumble.replace(/[^A-Z]/g, '');
    const inpLets = inputJumble.replace(/[^A-Z]/g, '');
    if (inpLets.length >= 3 && lmsLets.length >= 3 && !reasons.includes('Khớp cấu trúc nội dung (đảo vị trí)')) {
       const uniqueInpChars = Array.from(new Set(inpLets.split('')));
       const isSubsetMatch = uniqueInpChars.every(char => lmsLets.includes(char));
       if (isSubsetMatch) {
          score += 20; // Powerful tie-breaker to override random selection
          reasons.push('Trùng tập hợp ký tự cốt lõi');
       }
    }

    // Rule 2: SMART Center Code Matching (Split exact vs fuzzy for conflict resolution)
    const lmsCenterLetters = lmsCentreShort.replace(/[^A-Z]/gi, '').toLowerCase();
    
    let centerMatched = false;
    let exactCenter = false;
    
    if (normCenterLetters && lmsCenterLetters) {
       if (normCenterLetters === lmsCenterLetters) {
         centerMatched = true;
         exactCenter = true;
       } else if (normCenterLetters.length >= 2 && lmsCenterLetters.includes(normCenterLetters)) {
         centerMatched = true;
       } else if (lmsCenterLetters.length >= 2 && normCenterLetters.includes(lmsCenterLetters)) {
         centerMatched = true;
       }
    }
 
    if (centerMatched) {
      // Exact wins ties over substring matching
      score += exactCenter ? 25 : 20; 
      reasons.push(exactCenter ? 'Khớp cơ sở tuyệt đối' : 'Khớp cơ sở tương đối');
    }
    
    // Rule 3: Short class identifiers within full name (e.g. "SA40" inside "HDT-C4K-SA40")
    const classNumberMatch = comparisonInput.match(/\d+/);
    if (classNumberMatch && comparisonLms.includes(classNumberMatch[0]) && centerMatched) {
      if (!reasons.includes('Trùng mã lớp (tương đối)')) {
        score += 50;
        reasons.push('Trùng số lớp và cơ sở');
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = cls;
      bestReasons = reasons;
    }
  }

  return {
    row,
    matchedClass: highestScore >= 50 ? bestMatch : undefined, 
    matchScore: highestScore,
    matchReason: bestReasons,
    studentName,
    inputClassCode: inputClass,
    normalizedClassCode, 
    centerHint: rawCenterCode,
    timestamp
  };
}
