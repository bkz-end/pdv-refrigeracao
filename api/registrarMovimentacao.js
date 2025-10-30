import mongoose from 'mongoose';
import { connectToDatabase, Item, Movimentacao } from './_db.js';

export default async function handler(req, res) {
  // 1. Apenas aceita requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }
  
  // 2. LOGIN REMOVIDO!

  // Conecta ao banco
  await connectToDatabase();

  // 3. Inicia a Transação (a parte "robusta")
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 4. RECEBE O PREÇO
    const { nomeItem, quantidade, tipo, precoUnitario } = req.body; 
    const qtd = Number(quantidade);
    const preco = Number(precoUnitario) || 0; // Valida o preço

    // Validação
    if (isNaN(qtd) || qtd <= 0) throw new Error('Quantidade inválida.');
    if (preco < 0) throw new Error('Preço não pode ser negativo.');
    if (!nomeItem || nomeItem.trim().length < 3) throw new Error('Nome inválido.');

    const nomeLimpo = nomeItem.trim();
    const nomeLowerCase = nomeLimpo.toLowerCase();
    let precoTotal = qtd * preco; // <-- CÁLCULO NOVO

    // 5. Encontra o item DENTRO da transação
    let item = await Item.findOne({ nomeLowerCase: nomeLowerCase }).session(session);

    let estoqueAnterior = 0;
    let estoqueNovo = 0;

    // 6. Lógica de Estoque
    if (tipo === 'entrada') {
      if (!item) {
        // Se o item é novo, cria ele
        item = new Item({
          nome: nomeLimpo,
          nomeLowerCase: nomeLowerCase,
          estoqueAtual: 0,
          estoqueMinimo: 5, // Padrão
        });
      }
      estoqueAnterior = item.estoqueAtual;
      estoqueNovo = estoqueAnterior + qtd;
      item.precoCusto = preco; // <-- ATUALIZA O PREÇO DE CUSTO DO ITEM
    
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

    // 7. Atualiza o estoque do item
    item.estoqueAtual = estoqueNovo;
    item.ultimaModificacao = new Date();
    await item.save({ session });

    // 8. Salva o registro no histórico COM PREÇOS
    const movimentacao = new Movimentacao({
      tipo,
      nomeItem: nomeLimpo,
      quantidade: qtd,
      precoUnitario: preco, // <-- NOVO
      precoTotal: precoTotal, // <-- NOVO
      data: new Date(),
      estoqueAnterior,
      estoqueNovo,
    });
    await movimentacao.save({ session });

    // 9. COMITA A TRANSAÇÃO (Confirma tudo no banco)
    await session.commitTransaction();

    // 10. Sucesso!
    res.status(200).json({ 
      status: 'success', 
      message: `Movimentação registrada! Novo estoque: ${estoqueNovo}` 
    });

  } catch (error) {
    // 11. Erro! Desfaz tudo.
    await session.abortTransaction();
    console.error('Falha na Transação:', error);
    res.status(400).json({ message: error.message });
  } finally {
    // 12. Encerra a sessão
    session.endSession();
  }
}