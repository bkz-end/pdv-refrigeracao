import mongoose from 'mongoose';
import { connectToDatabase, Item, Movimentacao } from './_db.js';

export default async function handler(req, res) {
  // 1. Apenas aceita requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  // 2. Conecta ao banco
  await connectToDatabase();

  // 3. TRANSAÇÃO REMOVIDA PARA FUNCIONAR NO M0
  try {
    const { nomeItem, quantidade, tipo, precoUnitario } = req.body; 
    const qtd = Number(quantidade);
    const preco = Number(precoUnitario) || 0;

    // Validação
    if (isNaN(qtd) || qtd <= 0) throw new Error('Quantidade inválida.');
    if (preco < 0) throw new Error('Preço não pode ser negativo.');
    if (!nomeItem || nomeItem.trim().length < 3) throw new Error('Nome inválido.');

    const nomeLimpo = nomeItem.trim();
    const nomeLowerCase = nomeLimpo.toLowerCase();
    let precoTotal = qtd * preco;

    // 4. Encontra o item
    let item = await Item.findOne({ nomeLowerCase: nomeLowerCase });

    let estoqueAnterior = 0;
    let estoqueNovo = 0;

    // 5. Lógica de Estoque
    if (tipo === 'entrada') {
      if (!item) {
        item = new Item({
          nome: nomeLimpo,
          nomeLowerCase: nomeLowerCase,
          estoqueAtual: 0,
          estoqueMinimo: 5,
        });
      }
      estoqueAnterior = item.estoqueAtual;
      estoqueNovo = estoqueAnterior + qtd;
      item.precoCusto = preco; 
    
    } else {
      // Lógica de Saída
      if (!item || item.estoqueAtual < qtd) {
        throw new Error(
          `Estoque insuficiente. Você tentou tirar ${qtd}, mas só tem ${item?.estoqueAtual || 0}.`
        );
      }
      estoqueAnterior = item.estoqueAtual;
      estoqueNovo = estoqueAnterior - qtd;
    }

    // 6. Atualiza o estoque do item (Etapa 1)
    item.estoqueAtual = estoqueNovo;
    item.ultimaModificacao = new Date();
    await item.save(); // Salva o item

    // 7. Salva o registro no histórico (Etapa 2)
    const movimentacao = new Movimentacao({
      tipo,
      nomeItem: nomeLimpo,
      quantidade: qtd,
      precoUnitario: preco,
      precoTotal: precoTotal,
      data: new Date(),
      estoqueAnterior,
      estoqueNovo,
    });
    await movimentacao.save(); // Salva o histórico

    // 8. Sucesso!
    res.status(200).json({ 
      status: 'success', 
      message: `Movimentação registrada! Novo estoque: ${estoqueNovo}` 
    });

  } catch (error) {
    // 9. Erro!
    console.error('Falha na operação:', error);
    res.status(400).json({ message: error.message });
  }
}