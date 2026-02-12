/**
 * One-time: delete all books except "우당탕탕! 숲속 도서관"
 * Uses Firebase CLI stored credentials.
 * Run: node scripts/deleteBooksCli.cjs
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'storyforest-mvp-hsl02';
const KEEP_TITLE = '우당탕탕! 숲속 도서관';
const FIREBASE_API_KEY = 'AIzaSyBJ9JQDvm3q1DFoYnqpNwA_fjscxRbNsLw';

// Read Firebase CLI stored credentials
const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const refreshToken = config.tokens.refresh_token;

function httpRequest(url, options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data ? JSON.parse(data) : {});
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function getAccessToken() {
    const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com&client_secret=j9iVZfS8kkCEFUPaAeJV0sAi`;
    const result = await httpRequest('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }, body);
    return result.access_token;
}

async function firestoreGet(token, collectionPath) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath}`;
    return httpRequest(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
    });
}

async function firestoreDelete(token, docPath) {
    const url = `https://firestore.googleapis.com/v1/${docPath}`;
    return httpRequest(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
    });
}

async function main() {
    console.log('Getting access token...');
    const token = await getAccessToken();
    console.log('✓ Token acquired\n');

    console.log('Listing books...');
    const result = await firestoreGet(token, 'books');

    if (!result.documents || result.documents.length === 0) {
        console.log('No books found.');
        return;
    }

    console.log(`Found ${result.documents.length} books:\n`);

    let kept = 0, deleted = 0;

    for (const doc of result.documents) {
        const title = doc.fields?.title?.stringValue || '(no title)';
        const fullPath = doc.name; // projects/.../documents/books/{id}

        if (title === KEEP_TITLE) {
            console.log(`  ✓ KEEPING: "${title}"`);
            kept++;
            continue;
        }

        console.log(`  ✗ DELETING: "${title}"`);

        // Delete pages subcollection
        const bookId = fullPath.split('/').pop();
        try {
            const pages = await firestoreGet(token, `books/${bookId}/pages`);
            if (pages.documents) {
                for (const page of pages.documents) {
                    await firestoreDelete(token, page.name);
                }
                console.log(`    - Deleted ${pages.documents.length} pages`);
            }
        } catch {
            console.log('    - No pages subcollection');
        }

        // Delete book document
        await firestoreDelete(token, fullPath);
        console.log(`    - Book document deleted`);
        deleted++;
    }

    console.log(`\n✅ Done! Kept: ${kept}, Deleted: ${deleted}`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
