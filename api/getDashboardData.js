import { connectToDatabase, Item, Movimentacao } from './_db.js';

export default async function handler(req, res) {
  // 1. Apenas aceita requisições GET
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }
  
  // 2. LOGIN REMOVIDO!

  try {
    await connectToDatabase();

    // 3. Busca os dados em paralelo (mais rápido!)
    const [alertas, historico] = await Promise.all([
      // Query de Alertas: Acha itens onde o estoque é menor ou igual ao mínimo
      Item.find({ $expr: { $lte: ['$estoqueAtual', '$estoqueMinimo'] } })
        .sort({ estoqueAtual: 1 }) // Ordena do menor para o maior
        .limit(10)
        .select('nome estoqueAtual'), // Pega só os campos que precisamos

      // Query de Histórico: Pega os 10 mais novos
      Movimentacao.find()
        .sort({ data: -1 }) // -1 = decrescente (mais novo primeiro)
        .limit(10)
    ]);

    // 4. Retorna tudo
    res.status(200).json({ alertas, historico });

  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error);
    res.status(500).json({ message: 'Erro ao buscar dados do dashboard.' });
  }
}