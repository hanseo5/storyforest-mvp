/**
 * One-time: delete all books except "우당탕탕! 숲속 도서관"
 * Run: node scripts/deleteBooks.cjs
 * Uses Firebase CLI token for auth.
 */
const { execSync } = require('child_process');
const https = require('https');

const PROJECT_ID = 'storyforest-mvp-hsl02';
const KEEP_TITLE = '우당탕탕! 숲속 도서관';

function getAccessToken() {
    // Use Firebase CLI's stored credentials via gcloud-equivalent
    const result = execSync('npx firebase login:ci --no-localhost 2>nul || echo ""', { encoding: 'utf8' });
    // Actually, let's try to get the token from firebase internals
    return null;
}

function firestoreRequest(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents${path}`;
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };

        // Get token
        let token;
        try {
            token = execSync('gcloud auth print-access-token 2>nul', { encoding: 'utf8' }).trim();
        } catch {
            try {
                token = execSync('npx firebase-tools login:use --token 2>nul', { encoding: 'utf8' }).trim();
            } catch {
                // Fallback: read from firebase config
                token = null;
            }
        }

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function main() {
    console.log('Listing books...');
    const result = await firestoreRequest('GET', '/books');

    if (!result.documents) {
        console.log('No books found.');
        return;
    }

    for (const doc of result.documents) {
        const title = doc.fields?.title?.stringValue || '(no title)';
        const docPath = doc.name.replace(`projects/${PROJECT_ID}/databases/(default)/documents/`, '');

        if (title === KEEP_TITLE) {
            console.log(`KEEPING: "${title}"`);
            continue;
        }

        console.log(`DELETING: "${title}" -> ${docPath}`);
        await firestoreRequest('DELETE', `/${docPath}`);
        console.log(`  ✓ deleted`);
    }

    console.log('\nDone!');
}

main().catch(e => { console.error(e.message); process.exit(1); });
