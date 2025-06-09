const admin = require('firebase-admin');
const path = require('path');

// ✅ From local service account file OR env
let serviceAccount;

if (process.env.SERVICE_ACCOUNT) {
  // If passed as BASE64 env variable
  serviceAccount = JSON.parse(
    Buffer.from(process.env.SERVICE_ACCOUNT, 'base64').toString('utf-8')
  );
} else {
 
  serviceAccount = require('./serviceAccountKey.json');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'whatsapp-main-9991e.appspot.com',
});

const mimeTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
};

async function uploadImageToFirebase(filePath, fileName) {
  const bucket = admin.storage().bucket();
  const destination = `customer-images/${fileName}`;
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  const uuid = generateUUID();

  const [file] = await bucket.upload(filePath, {
    destination,
    metadata: {
      contentType,
      metadata: {
        firebaseStorageDownloadTokens: uuid,
      },
    },
    public: true,
  });

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destination)}?alt=media&token=${uuid}`;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

module.exports = uploadImageToFirebase;