const fs = require('fs');
const path = require('path');

function parseCSV(filepath) {
    const content = fs.readFileSync(filepath, 'utf8');
    // Use simplistic line splitter but merge multi-line fields containing newline inside quotes
    const lines = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (char === '"') inQuotes = !inQuotes;
        if (char === '\n' && !inQuotes) {
            lines.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    if (current) lines.push(current.trim());

    return lines.map(l => {
        // Simple extraction of comma separated but respecting quotes
        const parts = [];
        let p = '';
        let inQ = false;
        for (let c of l) {
           if (c === '"') inQ = !inQ;
           else if (c === ',' && !inQ) {
               parts.push(p.trim());
               p = '';
           } else {
               p += c;
           }
        }
        parts.push(p.trim());
        return parts;
    }).filter(p => p.length > 1);
}

const sheetFile = "/Users/teoanhss113/Downloads/Project/mindX/kpi-control/[Draft] - Sheet18.csv";
const webFile = "/Users/teoanhss113/Downloads/Project/mindX/kpi-control/sheetsfiltered.csv";

const rawSheet = parseCSV(sheetFile).slice(1); // Exclude header
const rawWeb = parseCSV(webFile);

console.log("Draft File Row Count:", rawSheet.length);
console.log("Web File Row Count:", rawWeb.length);

// Create unique IDs: Timestamp|Name
const webKeys = new Set(rawWeb.map(r => `${r[0]}|${r[1]}`.toLowerCase()));

const missingInWeb = [];

for (let row of rawSheet) {
    const key = `${row[0]}|${row[1]}`.toLowerCase();
    if (!webKeys.has(key)) {
        missingInWeb.push(row);
    }
}

console.log("\n=== Records in Google Sheet but MISSING in Website (" + missingInWeb.length + ") ===");

missingInWeb.slice(0, 20).forEach(row => {
    console.log(`TS: ${row[0]} | Name: ${row[1]} | Class: ${row[2]} | Center: ${row[3]}`);
});

fs.writeFileSync("/Users/teoanhss113/Downloads/Project/mindX/kpi-control/diff_output.json", JSON.stringify(missingInWeb, null, 2));
