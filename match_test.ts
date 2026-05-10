const { findBestMatch } = require('./src/lib/googleSheetsMatching');

// Mock classes derived from typical LMS dump
const mockClasses = [
    { className: "01TC-ROB-PREA11", centreName: "01TC" },
    { className: "01TC-XART-VAA11", centreName: "01TC" },
    { className: "01TC-XART-GDA11", centreName: "01TC" },
    { className: "01TC-XART-GDI11", centreName: "01TC" }
];

const mockRow = {
    "Timestamp": "4/12/2026 15:32:05",
    "Tên của em là?": "Hoàng Minh Hà",
    "Mã lớp của em là?": "TC-ART-GDA11",
    "Mã cơ sở của em là?": "HCM-TC"
};

console.log("--- EXECUTING MATCH TEST ---");
const result = findBestMatch(mockRow, mockClasses);

console.log("\nRESULT:");
console.log("Input Class:", result.inputClassCode);
console.log("Normalized:", result.normalizedClassCode);
console.log("Match Found:", result.matchedClass ? result.matchedClass.className : "NONE!");
console.log("Score:", result.matchScore);
console.log("Reasons:", result.matchReason);
