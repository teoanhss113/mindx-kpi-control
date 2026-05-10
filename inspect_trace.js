const fs = require('fs');

// Read original source code and directly insert our logging code into a string, then evaluate it!
const source = fs.readFileSync('./src/lib/googleSheetsMatching.ts', 'utf8');

// Let's just manually write the relevant code here inline to inspect
const helpers = {
    normalizeString: (str) => {
      if (!str) return '';
      return str.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').trim();
    },
    getTrueAcronym: (s) => {
      const str = (s || '').toUpperCase().trim();
      const digits = str.match(/\d/g);
      if (!digits) return str.replace(/[^A-Z]/g, '');
      const lastIdx = str.split('').reduce((max, char, idx) => /\d/.test(char) ? idx : max, -1);
      const afterLastDigit = str.slice(lastIdx + 1).replace(/[^A-Z]/g, '');
      return afterLastDigit.length >= 2 ? afterLastDigit : str.replace(/[^A-Z]/g, '');
    },
    normalizeCenterHint: (rawInput) => {
      if (!rawInput) return '';
      let cleaned = rawInput.toUpperCase().trim();
      if (cleaned.includes('(')) cleaned = cleaned.split('(')[0].trim();
      const normFull = helpers.normalizeString(cleaned);
      const aliases = {
         'truong chinh': 'TC', 'ten lua': 'TL', 'hcm tc': 'TC', 'hcm-tc': 'TC', 'bh': '253PVT', 'pvt': '672A28PVT'
      };
      for (const [key, val] of Object.entries(aliases)) {
         if (normFull.includes(key)) return val.toUpperCase();
      }
      return cleaned.replace(/[^A-Z0-9]/g, '');
    },
    getJumbleKey: (str) => {
      const c = (str || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const digits = c.replace(/[^0-9]/g, '');
      const letters = c.replace(/[^A-Z]/g, '').split('').sort().join('');
      return digits && letters ? `${digits}:${letters}` : c;
    },
    fixClassTypo: (classStr) => {
        if (!classStr) return '';
        let cleaned = classStr.toUpperCase().trim();
        cleaned = cleaned.replace(/[\u2010-\u2015]/g, '-').replace(/[-\s]+/g, '-');
        cleaned = cleaned.replace(/VCL/g, 'VCI').replace(/GDL/g, 'GDI');
        return cleaned;
    }
};

function runInspection(row, classes) {
    let studentName = row['Tên của em là?'] || '';
    let inputClass = row['Mã lớp của em là?'] || '';
    let rawCenterCode = row['Mã cơ sở của em là?'] || '';

    console.log("\n--- INSPECT TRACE ---");
    console.log("Input Class:", inputClass);
    console.log("Raw Center:", rawCenterCode);

    const rawNormalized = helpers.fixClassTypo(inputClass);
    console.log("Raw Normalized Class:", rawNormalized);

    let cleanCenter = helpers.normalizeCenterHint(rawCenterCode);
    console.log("Derived cleanCenter:", cleanCenter);

    let normalizedClassCode = rawNormalized;
    const centerCleanToken = helpers.getTrueAcronym(cleanCenter);
    console.log("centerCleanToken:", centerCleanToken);

    const firstSegment = rawNormalized.split('-')[0] || '';
    const inputFirstAcronym = helpers.getTrueAcronym(helpers.normalizeCenterHint(firstSegment));
    console.log("inputFirstAcronym:", inputFirstAcronym);

    const hyphenCount = (rawNormalized.match(/-/g) || []).length;
    const isAlreadyFullCode = hyphenCount >= 2;
    console.log("hyphenCount:", hyphenCount, "isAlreadyFullCode:", isAlreadyFullCode);

    if (centerCleanToken && rawNormalized) {
        const alreadyStarts = centerCleanToken === inputFirstAcronym;
        if (!alreadyStarts && !isAlreadyFullCode) {
            normalizedClassCode = `${centerCleanToken}-${rawNormalized}`;
        }
    }
    console.log("FINAL normalizedClassCode:", normalizedClassCode);

    const comparisonInput = normalizedClassCode.replace(/[^A-Z0-9]/g, '').toLowerCase();
    const normCenterLetters = cleanCenter.replace(/[^A-Z]/g, '').toLowerCase();
    console.log("comparisonInput:", comparisonInput);
    console.log("normCenterLetters:", normCenterLetters);

    const inputJumble = helpers.getJumbleKey(normalizedClassCode);
    console.log("inputJumble:", inputJumble);

    for (const cls of classes) {
        console.log("\n-> Testing Candidate:", cls.className);
        let score = 0;
        const lmsClassName = cls.className.toUpperCase();
        const comparisonLms = lmsClassName.replace(/[^A-Z0-9]/g, '').toLowerCase();
        const lmsCentreShort = helpers.normalizeString(cls.centreName);
        const lmsJumble = helpers.getJumbleKey(lmsClassName);

        console.log("   comparisonLms:", comparisonLms);
        console.log("   lmsCentreShort:", lmsCentreShort);

        // Rule 1C
        const lmsLets = lmsJumble.replace(/[^A-Z]/g, '');
        const inpLets = inputJumble.replace(/[^A-Z]/g, '');
        const uniqueInpChars = Array.from(new Set(inpLets.split('')));
        const isSubsetMatch = uniqueInpChars.every(char => lmsLets.includes(char));
        if (isSubsetMatch) {
            score += 20;
            console.log("   Rule 1C MATCHED (+20)");
        }

        // Rule 2
        const lmsCenterLetters = lmsCentreShort.replace(/[^A-Z]/gi, '').toLowerCase();
        console.log("   lmsCenterLetters:", lmsCenterLetters);
        
        let centerMatched = false;
        if (normCenterLetters && lmsCenterLetters) {
            if (normCenterLetters === lmsCenterLetters) {
                centerMatched = true;
                score += 25;
                console.log("   Rule 2 EXACT MATCH (+25)");
            }
        }

        // Rule 3
        const classNumberMatch = comparisonInput.match(/\d+/);
        console.log("   classNumberMatch:", classNumberMatch ? classNumberMatch[0] : "NONE");
        if (classNumberMatch && comparisonLms.includes(classNumberMatch[0]) && centerMatched) {
            score += 50;
            console.log("   Rule 3 MATCHED (+50)");
        }

        console.log("   FINAL CANDIDATE SCORE:", score);
    }
}

const mockClasses = [
    { className: "01TC-XART-GDA11", centreName: "01TC" }
];
const mockRow = {
    "Mã lớp của em là?": "TC-ART-GDA11",
    "Mã cơ sở của em là?": "HCM-TC"
};

runInspection(mockRow, mockClasses);
