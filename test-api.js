import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

// If you have a real file, uncomment these and use them:
// const filePath = './test-audio.mp3'; 
// const fileStream = fs.createReadStream(filePath);

// For now, we simulate a dummy file (1KB of zeros)
const dummyBuffer = Buffer.alloc(1024);

const form = new FormData();
form.append('audio', dummyBuffer, {
    filename: 'test-audio.mp3',
    contentType: 'audio/mpeg',
});
form.append('region', 'ID'); // Test localization

const API_URL = 'http://localhost:3000/analyze-baby-cry';

console.log(`Sending request to ${API_URL}...`);

async function runTest() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: form,
            headers: form.getHeaders(),
        });

        const data = await response.json();
        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

runTest();
