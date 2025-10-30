import mongoose from 'mongoose';

// Pegue sua String de Conexão do Bloco de Notas!
// NÃO COLOQUE A STRING AQUI. Vamos colocar no Vercel.
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI não definida nas variáveis de ambiente');
}

// Cache da conexão (para não reconectar toda hora)
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

// Função de conexão
export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// --- NOSSOS MODELOS DE BANCO DE DADOS ---

// 1. Modelo de Item (para estoque e autocomplete)
const ItemSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  nomeLowerCase: { type: String, required: true, unique: true, index: true },
  estoqueAtual: { type: Number, default: 0 },
  estoqueMinimo: { type: Number, default: 5 },
  ultimaModificacao: { type: Date, default: Date.now },
});
// Evita erro de recriação do modelo
export const Item = mongoose.models.Item || mongoose.model('Item', ItemSchema);


// 2. Modelo de Movimentação (para o histórico)
const MovimentacaoSchema = new mongoose.Schema({
  tipo: { type: String, required: true, enum: ['entrada', 'saida'] },
  nomeItem: { type: String, required: true },
  quantidade: { type: Number, required: true },
  data: { type: Date, default: Date.now },
  estoqueAnterior: { type: Number, required: true },
  estoqueNovo: { type: Number, required: true },
});
export const Movimentacao = mongoose.models.Movimentacao || mongoose.model('Movimentacao', MovimentacaoSchema);

export default connectToDatabase;