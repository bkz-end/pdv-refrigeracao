import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI não definida nas variáveis de ambiente');
}

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

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

// 1. Modelo de Item (ATUALIZADO)
const ItemSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  nomeLowerCase: { type: String, required: true, unique: true, index: true },
  estoqueAtual: { type: Number, default: 0 },
  estoqueMinimo: { type: Number, default: 5 },
  precoCusto: { type: Number, default: 0 }, // <-- NOVO
  ultimaModificacao: { type: Date, default: Date.now },
});
export const Item = mongoose.models.Item || mongoose.model('Item', ItemSchema);


// 2. Modelo de Movimentação (ATUALIZADO)
const MovimentacaoSchema = new mongoose.Schema({
  tipo: { type: String, required: true, enum: ['entrada', 'saida'] },
  nomeItem: { type: String, required: true },
  quantidade: { type: Number, required: true },
  precoUnitario: { type: Number, default: 0 }, // <-- NOVO
  precoTotal: { type: Number, default: 0 }, // <-- NOVO
  data: { type: Date, default: Date.now },
  estoqueAnterior: { type: Number, required: true },
  estoqueNovo: { type: Number, required: true },
});
export const Movimentacao = mongoose.models.Movimentacao || mongoose.model('Movimentacao', MovimentacaoSchema);

export default connectToDatabase;