document.addEventListener('DOMContentLoaded', () => {
    // --- INICIALIZAÇÃO E AUTENTICAÇÃO (Firebase Auth continua!) ---
    const auth = firebase.auth();
    const db = firebase.firestore(); // Ainda precisamos disso para os listeners
  
    // Elementos do DOM
    const userEmailSpan = document.getElementById('user-email');
    const btnLogout = document.getElementById('btn-logout');
    const form = document.getElementById('form-movimentacao');
    const nomeItemInput = document.getElementById('nome-item');
    const quantidadeInput = document.getElementById('quantidade');
    const btnEntrada = document.getElementById('btn-entrada');
    const btnSaida = document.getElementById('btn-saida');
    const statusContainer = document.getElementById('status-container');
    const autocompleteDropdown = document.getElementById('autocomplete-sugestoes');
    const dashboardAlertas = document.getElementById('dashboard-alertas');
    const dashboardHistorico = document.getElementById('dashboard-historico');
  
    // ... (elementos de busca) ...
    const buscaDataInput = document.getElementById('busca-data');
    const btnBuscar = document.getElementById('btn-buscar');
    const buscaResultados = document.getElementById('busca-resultados');
    const buscaResultadosLista = document.getElementById('busca-resultados-lista');
    const btnLimparBusca = document.getElementById('btn-limpar-busca');
  
    // --- GUARDA DE AUTENTICAÇÃO ---
    auth.onAuthStateChanged((user) => {
      if (user) {
        console.log('Admin logado:', user.email);
        userEmailSpan.textContent = user.email;
        iniciarDashboard();
      } else {
        console.log('Nenhum usuário logado. Redirecionando...');
        window.location.href = '/login.html';
      }
    });
  
    // Logout
    btnLogout.addEventListener('click', () => {
      auth.signOut();
    });
  
    function iniciarDashboard() {
      carregarDashboardTempoReal(); // Isso ainda vem do Firestore (ou Mongo)
      configurarFormularioPDV();
      configurarAutocomplete();
      configurarBuscaPorDia();
    }
  
    // --- NOVA FUNÇÃO HELPER DE FETCH (ELITE) ---
    // Esta função vai chamar nossa API na Vercel e enviar o token de login
    async function fetchApi(endpoint, body) {
      const user = auth.currentUser;
      if (!user) {
        mostrarStatus('Usuário não logado.', 'error');
        throw new Error('Usuário não logado.');
      }
  
      // Pega o token de autenticação do Firebase
      const token = await user.getIdToken();
  
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`, // Envia o token para o backend
        },
        body: JSON.stringify(body),
      });
  
      const data = await res.json();
  
      if (!res.ok) {
        // Se a API retornar um erro (ex: "Estoque insuficiente")
        throw new Error(data.message || 'Erro desconhecido na API.');
      }
  
      return data;
    }
  
    // --- 1. FORMULÁRIO PDV (ATUALIZADO) ---
    function configurarFormularioPDV() {
      form.addEventListener('submit', (e) => e.preventDefault());
      btnEntrada.addEventListener('click', () => handleRegistro('entrada'));
      btnSaida.addEventListener('click', () => handleRegistro('saida'));
    }
  
    async function handleRegistro(tipo) {
      const nomeItem = nomeItemInput.value;
      const quantidade = quantidadeInput.value;
  
      if (!nomeItem || !quantidade) {
        mostrarStatus('Preencha o nome e a quantidade.', 'error');
        return;
      }
  
      btnEntrada.disabled = true;
      btnSaida.disabled = true;
      mostrarStatus('Registrando...', 'loading');
  
      try {
        // Chama nossa nova API via fetch
        const resultado = await fetchApi('/api/registrarMovimentacao', {
          nomeItem: nomeItem,
          quantidade: Number(quantidade),
          tipo: tipo,
        });
  
        mostrarStatus(resultado.message, 'success');
        form.reset();
  
        // **IMPORTANTE**: Como nosso dashboard em tempo real AINDA é do Firestore
        // precisamos atualizar o Firestore também, ou migrar o dashboard.
        // Por enquanto, vamos recarregar os dados manualmente após o sucesso.
        carregarDashboardTempoReal(); // Força a recarga
  
      } catch (error) {
        console.error('Erro na movimentação:', error);
        mostrarStatus(error.message, 'error');
      } finally {
        btnEntrada.disabled = false;
        btnSaida.disabled = false;
      }
    }
  
    function mostrarStatus(mensagem, tipo) {
      statusContainer.textContent = mensagem;
      statusContainer.className = tipo;
      statusContainer.classList.remove('hidden');
      if (tipo !== 'loading') {
        setTimeout(() => {
          statusContainer.classList.add('hidden');
        }, 5000);
      }
    }
  
    // --- 2. AUTOCOMPLETE (ATUALIZADO) ---
    let autocompleteTimer;
    function configurarAutocomplete() {
      nomeItemInput.addEventListener('input', () => {
        clearTimeout(autocompleteTimer);
        autocompleteTimer = setTimeout(async () => {
          const query = nomeItemInput.value;
          if (query.length < 2) {
            autocompleteDropdown.innerHTML = '';
            return;
          }
  
          try {
            // Chama nossa nova API via fetch
            const resultados = await fetchApi('/api/buscarItemsAutocomplete', {
              query: query,
            });
            renderizarAutocomplete(resultados);
          } catch (error) {
            console.error('Erro no autocomplete:', error);
          }
        }, 300);
      });
  
      document.addEventListener('click', (e) => {
        if (!autocompleteDropdown.contains(e.target) && e.target !== nomeItemInput) {
          autocompleteDropdown.innerHTML = '';
        }
      });
    }
  
    function renderizarAutocomplete(items) {
      autocompleteDropdown.innerHTML = '';
      if (!items || items.length === 0) {
        autocompleteDropdown.innerHTML = `<div class="sugestao-item"><span>Nenhum item encontrado.</span></div>`;
        return;
      }
      items.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'sugestao-item';
        div.innerHTML = `
          <span>${item.nome}</span>
          <span>[Estoque: ${item.estoqueAtual}]</span>
        `;
        div.addEventListener('click', () => {
          nomeItemInput.value = item.nome;
          autocompleteDropdown.innerHTML = '';
        });
        autocompleteDropdown.appendChild(div);
      });
    }
  
    // --- 3. DASHBOARD EM TEMPO REAL ---
    // !! ATENÇÃO !!
    // Este código ainda está lendo do FIRESTORE (seu banco antigo).
    // O ideal seria migrar isso para o MongoDB também, mas é mais complexo.
    // Por enquanto, o dashboard só vai atualizar DEPOIS que você registrar
    // um item, porque chamamos carregarDashboardTempoReal() manualmente.
    function carregarDashboardTempoReal() {
      // Alertas de Estoque Baixo (do FIRESTORE)
      db.collection('items')
        .where('estoqueAtual', '<=', 5)
        .orderBy('estoqueAtual', 'asc')
        .get() // Trocado de onSnapshot para .get() para ser manual
        .then((snapshot) => {
          dashboardAlertas.innerHTML = '';
          if (snapshot.empty) {
            dashboardAlertas.innerHTML = `<p class="sem-alerta">✔ Nenhum item com estoque baixo.</p>`;
            return;
          }
          snapshot.forEach((doc) => {
            // ... (código do alerta) ...
            const item = doc.data();
            const div = document.createElement("div");
            div.className = "alerta-item";
            div.innerHTML = `<span>${item.nome}</span><span class="estoque">${item.estoqueAtual}</span>`;
            dashboardAlertas.appendChild(div);
          });
        })
        .catch((error) => console.error('Erro ao buscar alertas:', error));
  
      // Últimas Movimentações (do FIRESTORE)
      db.collection('movimentacoes')
        .orderBy('data', 'desc')
        .limit(10)
        .get() // Trocado de onSnapshot para .get()
        .then((snapshot) => {
          dashboardHistorico.innerHTML = '';
          if (snapshot.empty) {
            dashboardHistorico.innerHTML = `<p class="loading-placeholder">Nenhuma movimentação.</p>`;
            return;
          }
          snapshot.forEach((doc) => {
            dashboardHistorico.appendChild(renderizarItemHistorico(doc.data()));
          });
        })
        .catch((error) => console.error('Erro ao buscar histórico:', error));
    }
    
    // (Função renderizarItemHistorico e Busca por Dia continuam iguais)
    // ... (Cole o resto do seu app.js original aqui) ...
  
      // Função helper para criar o HTML de um item de histórico
      function renderizarItemHistorico(mov) {
          const div = document.createElement("div");
          div.className = `historico-item ${mov.tipo}`; // 'entrada' ou 'saida'
          
          const sinal = mov.tipo === "entrada" ? "+" : "-";
          const dataFormatada = mov.data ? mov.data.toDate().toLocaleString('pt-BR') : 'processando...';
  
          div.innerHTML = `
              <span class="nome">${mov.nomeItem}</span>
              <span class="qtd">${sinal} ${mov.quantidade}</span>
              <span class="estoque-audit">${mov.estoqueAnterior} ➔ ${mov.estoqueNovo}</span>
              <span class="data">${dataFormatada}</span>
          `;
          return div;
      }
  
      // --- 4. BUSCA POR DIA (RELATÓRIOS) ---
      function configurarBuscaPorDia() {
          btnBuscar.addEventListener("click", async () => {
              const dataQuery = buscaDataInput.value;
              if (!dataQuery) {
                  alert("Por favor, selecione uma data.");
                  return;
              }
  
              const dataInicio = new Date(dataQuery + "T00:00:00");
              const dataFim = new Date(dataQuery + "T23:59:59");
  
              const timestampInicio = firebase.firestore.Timestamp.fromDate(dataInicio);
              const timestampFim = firebase.firestore.Timestamp.fromDate(dataFim);
  
              try {
                  const snapshot = await db.collection("movimentacoes")
                      .where("data", ">=", timestampInicio)
                      .where("data", "<=", timestampFim)
                      .orderBy("data", "desc")
                      .get();
                  
                  buscaResultados.classList.remove("hidden");
                  buscaResultadosLista.innerHTML = "";
                  
                  if (snapshot.empty) {
                      buscaResultadosLista.innerHTML = `<p class="loading-placeholder">Nenhum resultado.</p>`;
                  } else {
                      snapshot.forEach(doc => {
                          buscaResultadosLista.appendChild(renderizarItemHistorico(doc.data()));
                      });
                  }
  
              } catch (error) {
                  console.error("Erro na busca por data:", error);
                  buscaResultadosLista.innerHTML = `<p class="loading-placeholder" style="color: red;">Erro ao buscar dados.</p>`;
              }
          });
  
          btnLimparBusca.addEventListener("click", () => {
              buscaResultados.classList.add("hidden");
              buscaResultadosLista.innerHTML = "";
              buscaDataInput.value = "";
          });
      }
  
  }); // Fim do DOMContentLoaded