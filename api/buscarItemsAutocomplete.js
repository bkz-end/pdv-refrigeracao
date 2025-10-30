import { connectToDatabase, Item } from './_db.js';
import { verificarLogin } from './_firebaseAdmin.js';

export default async function handler(req, res) {
  // 1. Apenas aceita requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }
  
  // 2. Verifica se o usuário é o Admin
  try {
    await verificarLogin(req);
  } catch (error) {
    return res.status(401).json({ message: 'Acesso negado: ' + error.message });
  }

  try {
    const { query } = req.body;
    if (query.length < 2) {
      return res.status(200).json([]);
    }

    await connectToDatabase();

    // 3. Busca no MongoDB (usando Regex para "começa com")
    const regex = new RegExp(`^${query}`, 'i'); // 'i' = case-insensitive
    const items = await Item.find({ nomeLowerCase: regex })
      .limit(7)
      .select('nome estoqueAtual'); // Pega só os campos que precisamos

    res.status(200).json(items);

  } catch (error) {
    console.error('Erro no autocomplete:', error);
    res.status(500).json({ message: 'Erro ao buscar itens.' });
  }
}