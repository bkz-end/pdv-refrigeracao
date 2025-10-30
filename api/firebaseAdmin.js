import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(
        JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      ),
    });
  } catch (error) {
    console.error('Falha ao inicializar Firebase Admin SDK:', error);
  }
}

export async function verificarLogin(req) {
  let token;
  
  if (req.headers.authorization) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query.token) {
    // Adiciona verificação via query param para GET
    token = req.query.token;
  }

  if (!token) {
     throw new Error('Token de autorização não fornecido.');
  }

  const decodedToken = await admin.auth().verifyIdToken(token);
  return decodedToken;
}

export default admin;