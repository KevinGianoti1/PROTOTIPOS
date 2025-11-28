const { extractCNPJ, validateCNPJ } = require('./utils/validationHelpers');

const testCases = [
    "4354607000152", // 13 digits (Invalid)
    "43546070000152", // 14 digits (Valid)
    "CNPJ: 43.546.070/0001-52", // Formatted (Valid)
    "123456789012345", // 15 digits (Invalid)
    "123", // Too short (Should be null)
];

console.log("--- Testing CNPJ Extraction & Validation ---\n");

testCases.forEach(input => {
    const extracted = extractCNPJ(input);
    console.log(`Input: "${input}"`);
    console.log(`Extracted: ${extracted}`);

    if (extracted) {
        const isValid = validateCNPJ(extracted);
        console.log(`Valid: ${isValid}`);
    } else {
        console.log("Valid: N/A (Not extracted)");
    }
    console.log("---\n");
});
