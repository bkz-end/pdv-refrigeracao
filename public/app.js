document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO DOM ---
    const form = document.getElementById('form-movimentacao');
    const nomeItemInput = document.getElementById('nome-item');
    const quantidadeInput = document.getElementById('quantidade');
    const precoUnitarioInput = document.getElementById('preco-unitario'); // <-- NOVO
    const btnEntrada = document.getElementById('btn-entrada');
    const btnSaida = document.getElementById('btn-saida');
    const statusContainer = document.getElementById('status-container');
    const autocompleteDropdown = document.getElementById('autocomplete-sugestoes');
    const dashboardAlertas = document.getElementById('dashboard-alertas');
    const dashboardHistorico = document.getElementById('dashboard-historico');
    const buscaDataInput = document.getElementById('busca-data');
    const btnBuscar = document.getElementById('btn-buscar');
    const buscaResultados = document.getElementById('busca-resultados');
    const buscaResultadosLista = document.getElementById('busca-resultados-lista');
    const btnLimparBusca = document.getElementById('btn-limpar-busca');
  
    // --- INICIA O APP ---
    iniciarDashboard();
  
    function iniciarDashboard() {
      carregarDashboardTempoReal(); 
      configurarFormularioPDV();
      configurarAutocomplete();
      configurarBuscaPorDia();
    }
  
    // --- FUNÇÃO HELPER DE FETCH (SUPER SIMPLES) ---
    // Não precisa mais de token de login!
    async function fetchApi(endpoint, method = 'POST', body = null) {
      const options = {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
      };
  
      if (method === 'POST' && body) {
        options.body = JSON.stringify(body);
      }
      
      const res = await fetch(endpoint, options);
      const data = await res.json();
  
      if (!res.ok) {
        throw new Error(data.message || 'Erro desconhecido na API.');
      }
      return data;
    }
  
    // --- 1. FORMULÁRIO PDV (ATUALIZADO COM PREÇO) ---
    function configurarFormularioPDV() {
      form.addEventListener('submit', (e) => e.preventDefault());
      btnEntrada.addEventListener('click', () => handleRegistro('entrada'));
      btnSaida.addEventListener('click', () => handleRegistro('saida'));
    }
  
    async function handleRegistro(tipo) {
      const nomeItem = nomeItemInput.value;
      const quantidade = quantidadeInput.value;
      const precoUnitario = precoUnitarioInput.value; // <-- NOVO
  
      if (!nomeItem || !quantidade || precoUnitario === '') {
        mostrarStatus('Preencha nome, quantidade e preço.', 'error');
        return;
      }
  
      btnEntrada.disabled = true;
      btnSaida.disabled = true;
      mostrarStatus('Registrando...', 'loading');
  
      try {
        // Envia o preço para a API
        const resultado = await fetchApi('/api/registrarMovimentacao', 'POST', {
          nomeItem: nomeItem,
          quantidade: Number(quantidade),
          tipo: tipo,
          precoUnitario: Number(precoUnitario) // <-- NOVO
        });
  
        mostrarStatus(resultado.message, 'success');
        form.reset();
        
        carregarDashboardTempoReal(); 
  
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
  
    // --- 2. AUTOCOMPLETE (ATUALIZADO COM PREÇO) ---
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
            const resultados = await fetchApi('/api/buscarItemsAutocomplete', 'POST', {
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
        // Formata o preço de custo
        const precoCustoFormatado = (item.precoCusto || 0).toLocaleString('pt-BR', {
           style: 'currency', currency: 'BRL'
        });
        div.innerHTML = `
          <span>${item.nome}</span>
          <span>[Custo: ${precoCustoFormatado}] [Est: ${item.estoqueAtual}]</span>
        `;
        div.addEventListener('click', () => {
          nomeItemInput.value = item.nome;
          // Ao clicar, preenche o preço de entrada/saída
          precoUnitarioInput.value = item.precoCusto || 0; 
          autocompleteDropdown.innerHTML = '';
        });
        autocompleteDropdown.appendChild(div);
      });
    }
  
    // --- 3. DASHBOARD EM TEMPO REAL (OK) ---
    async function carregarDashboardTempoReal() {
      dashboardAlertas.innerHTML = '<p class="loading-placeholder">Carregando alertas...</p>';
      dashboardHistorico.innerHTML = '<p class="loading-placeholder">Carregando histórico...</p>';
  
      try {
        const data = await fetchApi('/api/getDashboardData', 'GET');
        
        // Renderizar Alertas
        dashboardAlertas.innerHTML = '';
        if (!data.alertas || data.alertas.length === 0) {
          dashboardAlertas.innerHTML = `<p class="sem-alerta">✔ Nenhum item com estoque baixo.</p>`;
        } else {
          data.alertas.forEach(item => {
            const div = document.createElement("div");
            div.className = "alerta-item";
            div.innerHTML = `<span>${item.nome}</span><span class="estoque">${item.estoqueAtual}</span>`;
            dashboardAlertas.appendChild(div);
          });
        }
  
        // Renderizar Histórico
        dashboardHistorico.innerHTML = '';
        if (!data.historico || data.historico.length === 0) {
          dashboardHistorico.innerHTML = `<p class="loading-placeholder">Nenhuma movimentação.</p>`;
        } else {
          data.historico.forEach(mov => {
            dashboardHistorico.appendChild(renderizarItemHistorico(mov));
          });
        }
  
      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
        dashboardAlertas.innerHTML = '<p class="loading-placeholder" style="color: red;">Erro ao carregar alertas.</p>';
        dashboardHistorico.innerHTML = '<p class="loading-placeholder" style="color: red;">Erro ao carregar histórico.</p>';
      }
    }
  
    // Função helper para criar o HTML de um item de histórico (ATUALIZADA COM PREÇO)
    function renderizarItemHistorico(mov) {
      const div = document.createElement("div");
      div.className = `historico-item ${mov.tipo}`; 
      
      const sinal = mov.tipo === "entrada" ? "+" : "-";
      const dataFormatada = new Date(mov.data).toLocaleString('pt-BR');
      
      // Formata o preço para R$
      const precoTotalFormatado = (mov.precoTotal || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });
  
      // Atualiza o HTML para incluir o preço
      div.innerHTML = `
          <span class="nome">${mov.nomeItem}</span>
          <span class="qtd">${sinal} ${mov.quantidade}</span>
          <span class="preco">${precoTotalFormatado}</span> <span class="estoque-audit">${mov.estoqueAnterior} ➔ ${mov.estoqueNovo}</span>
          <span class="data">${dataFormatada}</span>
      `;
      return div;
    }
  
    // --- 4. BUSCA POR DIA (OK) ---
    function configurarBuscaPorDia() {
      btnBuscar.addEventListener("click", async () => {
        const dataQuery = buscaDataInput.value;
        if (!dataQuery) {
          alert("Por favor, selecione uma data.");
          return;
        }
  
        const dataInicioISO = dataQuery + "T00:00:00.000Z";
        const dataFimISO = dataQuery + "T23:59:59.999Z";
  
        try {
          const resultados = await fetchApi('/api/buscarPorData', 'POST', {
            dataInicioISO,
            dataFimISO
          });
          
          buscaResultados.classList.remove("hidden");
          buscaResultadosLista.innerHTML = "";
          
          if (!resultados || resultados.length === 0) {
            buscaResultadosLista.innerHTML = `<p class="loading-placeholder">Nenhum resultado.</p>`;
          } else {
            resultados.forEach(mov => {
              buscaResultadosLista.appendChild(renderizarItemHistorico(mov));
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