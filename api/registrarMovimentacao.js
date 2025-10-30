import mongoose from 'mongoose';
import { connectToDatabase, Item, Movimentacao } from './_db.js';
import { verificarLogin } from './_firebaseAdmin.js';

export default async function handler(req, res) {
  // 1. Apenas aceita requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  // 2. Verifica se o usuário é o Admin (Segurança "Elite")
  try {
    await verificarLogin(req);
  } catch (error) {
    return res.status(401).json({ message: 'Acesso negado: ' + error.message });
  }

  // Conecta ao banco
  await connectToDatabase();

  // 3. Inicia a Transação (a parte "robusta")
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { nomeItem, quantidade, tipo } = req.body;
    const qtd = Number(quantidade);

    // Validação
    if (isNaN(qtd) || qtd <= 0) throw new Error('Quantidade inválida.');
    if (!nomeItem || nomeItem.trim().length < 3) throw new Error('Nome inválido.');

    const nomeLimpo = nomeItem.trim();
    const nomeLowerCase = nomeLimpo.toLowerCase();

    // 4. Encontra o item DENTRO da transação
    let item = await Item.findOne({ nomeLowerCase: nomeLowerCase }).session(session);

    let estoqueAnterior = 0;
    let estoqueNovo = 0;

    // 5. Lógica de Estoque
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

    // 6. Atualiza o estoque do item
    item.estoqueAtual = estoqueNovo;
    item.ultimaModificacao = new Date();
    await item.save({ session });

    // 7. Salva o registro no histórico
    const movimentacao = new Movimentacao({
      tipo,
      nomeItem: nomeLimpo,
      quantidade: qtd,
      data: new Date(),
      estoqueAnterior,
      estoqueNovo,
    });
    await movimentacao.save({ session });

    // 8. COMITA A TRANSAÇÃO (Confirma tudo no banco)
    await session.commitTransaction();

    // 9. Sucesso!
    res.status(200).json({ 
      status: 'success', 
      message: `Movimentação registrada! Novo estoque: ${estoqueNovo}` 
    });

  } catch (error) {
    // 10. Erro! Desfaz tudo.
    await session.abortTransaction();
    console.error('Falha na Transação:', error);
    res.status(400).json({ message: error.message });
  } finally {
    // 11. Encerra a sessão
    session.endSession();
  }
}