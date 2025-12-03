const pdf = require('pdf-parse');
console.log('Type of pdf:', typeof pdf);

try {
    if (typeof pdf === 'function') {
        console.log('pdf-parse is a function, as expected.');
    } else {
        console.log('pdf-parse is NOT a function.');
    }
} catch (e) {
    console.error(e);
}
