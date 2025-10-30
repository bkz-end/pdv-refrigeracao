// Precisamos das credenciais que o Firebase usa.
// Vá no "Console do Firebase" -> Engrenagem ⚙ -> Configurações do Projeto
// -> Contas de Serviço -> Gerar nova chave privada.
// Isso vai baixar um arquivo JSON. Copie o conteúdo dele.
// NÃO COLOQUE O CONTEÚDO AQUI. Vamos colocar no Vercel depois.

const admin = require('firebase-admin');

// Só inicializa o app se ele não foi inicializado ainda
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

// Helper para verificar o token de login em cada requisição
export async function verificarLogin(req) {
  if (!req.headers.authorization) {
    throw new Error('Nenhum token de autorização fornecido.');
  }
  
  // Extrai o token "Bearer ..."
  const token = req.headers.authorization.split(' ')[1];
  if (!token) {
     throw new Error('Token mal formatado.');
  }

  // Verifica se o token é válido
  const decodedToken = await admin.auth().verifyIdToken(token);
  return decodedToken; // Retorna os dados do usuário logado
}

export default admin;