import { connectToDatabase, Movimentacao } from './_db.js';
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
    const { dataInicioISO, dataFimISO } = req.body;
    
    if (!dataInicioISO || !dataFimISO) {
      throw new Error('Datas de início e fim são obrigatórias.');
    }

    await connectToDatabase();

    // 3. Busca no MongoDB
    // $gte = "maior ou igual a" (greater than or equal)
    // $lte = "menor ou igual a" (less than or equal)
    const movimentacoes = await Movimentacao.find({
      data: {
        $gte: new Date(dataInicioISO),
        $lte: new Date(dataFimISO)
      }
    }).sort({ data: -1 }); // Ordena pela data

    res.status(200).json(movimentacoes);

  } catch (error) {
    console.error('Erro na busca por data:', error);
    res.status(500).json({ message: 'Erro ao buscar dados.' });
  }
}