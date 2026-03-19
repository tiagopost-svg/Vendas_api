const API_URL = window.location.protocol === 'file:'
  ? 'http://localhost:3000/api'
  : `${window.location.origin}/api`;
const token = localStorage.getItem('crm_token');
let visitasCache = [];
const visitaEmDestaqueId = new URLSearchParams(window.location.search).get('visita_id');

const empresaBadge = document.getElementById('empresaBadge');
const visitaForm = document.getElementById('visitaForm');
const clienteSelect = document.getElementById('cliente_id');
const dataVisitaInput = document.getElementById('data_visita');
const tipoVisitaInput = document.getElementById('tipo_visita');
const imagemDesenhoInput = document.getElementById('imagem_desenho');
const imagemLocalInput = document.getElementById('imagem_local');
const resultadoInput = document.getElementById('resultado');
const observacoesInput = document.getElementById('observacoes');
const visitasMensagem = document.getElementById('visitasMensagem');
const visitasLista = document.getElementById('visitasLista');
const recarregarVisitasButton = document.getElementById('recarregarVisitas');

const redirecionarParaLogin = () => {
  localStorage.removeItem('crm_token');
  localStorage.removeItem('crm_usuario');
  window.location.href = 'index.html';
};

const exibirMensagem = (mensagem, tipo = 'info') => {
  visitasMensagem.className = `alert alert-${tipo} mt-3`;
  visitasMensagem.textContent = mensagem;
  visitasMensagem.classList.remove('d-none');
};

const limparMensagem = () => {
  visitasMensagem.classList.add('d-none');
  visitasMensagem.textContent = '';
};

const request = async (endpoint, options = {}) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    redirecionarParaLogin();
    throw new Error('Sessão expirada.');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.mensagem || 'Falha na requisição.');
  }

  return data;
};

const sanitizarTelefone = (numero) => String(numero || '').replace(/\D/g, '');

const montarEnderecoCompleto = (visita) => {
  if (visita.cliente_endereco_completo) {
    return visita.cliente_endereco_completo;
  }

  return [visita.cliente_endereco, visita.cliente_cidade]
    .filter(Boolean)
    .join(', ')
    .trim();
};

const abrirMaps = (endereco) => {
  if (!endereco) {
    exibirMensagem('Endereço da visita não está disponível para abrir no Maps.', 'warning');
    return;
  }

  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
  window.open(url, '_blank', 'noopener');
};

const abrirWhatsApp = (numero, nome, mensagemPersonalizada) => {
  const telefone = sanitizarTelefone(numero);

  if (!telefone) {
    exibirMensagem('Telefone do cliente não está disponível para abrir no WhatsApp.', 'warning');
    return;
  }

  const mensagem = mensagemPersonalizada || `Olá ${nome}, estou a caminho para a visita.`;
  const url = `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, '_blank', 'noopener');
};

const iniciarVisita = (visita) => {
  const endereco = montarEnderecoCompleto(visita);

  if (!endereco) {
    exibirMensagem('Não foi possível iniciar a visita porque o endereço do cliente está vazio.', 'warning');
    return;
  }

  abrirMaps(endereco);
  exibirMensagem('Google Maps aberto. O WhatsApp será aberto em seguida.', 'info');

  window.setTimeout(() => {
    abrirWhatsApp(
      visita.cliente_telefone,
      visita.cliente_nome,
      `Olá ${visita.cliente_nome}, estou indo para sua visita.`,
    );
  }, 2500);
};

const carregarPerfil = async () => {
  const data = await request('/auth/me');
  empresaBadge.textContent = `${data.usuario.empresa_nome} • ${data.usuario.nivel}`;
};

const carregarClientes = async () => {
  const data = await request('/clientes?page=1&limit=100&order=asc');
  clienteSelect.innerHTML = '<option value="">Selecione um cliente</option>';
  data.dados.forEach((cliente) => {
    const option = document.createElement('option');
    option.value = cliente.id;
    option.textContent = `${cliente.nome} #${cliente.id}`;
    clienteSelect.appendChild(option);
  });
};

const renderizarVisitas = (visitas) => {
  visitasCache = visitas;

  if (!visitas.length) {
    visitasLista.innerHTML = '<div class="col-12 text-center text-muted py-4">Nenhuma visita cadastrada.</div>';
    return;
  }

  visitasLista.innerHTML = visitas
    .map(
      (visita) => `
        <div class="col-12">
          <div class="card border-0 bg-light-subtle shadow-sm ${String(visita.id) === String(visitaEmDestaqueId) ? 'visita-highlight' : ''}" id="visita-card-${visita.id}">
            <div class="card-body d-flex flex-column gap-3">
              <div class="d-flex gap-3 align-items-start">
                <img src="${visita.imagem_desenho_url}" alt="Desenho da visita ${visita.id}" class="rounded object-fit-cover" style="width: 88px; height: 88px;" />
                <div class="flex-grow-1">
                  <div class="fw-semibold">${visita.cliente_nome}</div>
                  <div class="small text-muted">${visita.data_visita} • ${visita.tipo_visita}</div>
                  <div class="small">Resultado: <strong>${visita.resultado}</strong></div>
                  <div class="small text-muted">${montarEnderecoCompleto(visita) || 'Endereço não informado'}</div>
                  <div class="small text-muted">${visita.observacoes || 'Sem observações'}</div>
                </div>
              </div>
              <div class="visita-actions d-grid gap-2 d-md-flex flex-wrap">
                <button class="btn btn-primary btn-lg" title="Abrir endereço no Google Maps" data-action="maps" data-id="${visita.id}">📍 Maps</button>
                <button class="btn btn-success btn-lg" title="Abrir conversa com o cliente no WhatsApp" data-action="whatsapp" data-id="${visita.id}">💬 WhatsApp</button>
                <button class="btn btn-warning btn-lg" title="Abrir Maps e depois WhatsApp" data-action="iniciar" data-id="${visita.id}">🚀 Iniciar visita</button>
                <button class="btn btn-outline-primary btn-lg" title="Visualizar imagem do desenho" data-action="visualizar" data-id="${visita.id}">👁️ Visualizar</button>
                <button class="btn btn-outline-danger btn-lg" title="Excluir visita" data-action="excluir" data-id="${visita.id}">🗑️ Excluir</button>
              </div>
            </div>
          </div>
        </div>
      `,
    )
    .join('');
};

const obterVisitaPorId = (id) => visitasCache.find((visita) => String(visita.id) === String(id));

const destacarVisitaDaUrl = () => {
  if (!visitaEmDestaqueId) return;

  const card = document.getElementById(`visita-card-${visitaEmDestaqueId}`);
  if (!card) return;

  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

const carregarVisitas = async () => {
  try {
    const data = await request('/visitas');
    renderizarVisitas(data.dados);
    destacarVisitaDaUrl();
  } catch (error) {
    renderizarVisitas([]);
    exibirMensagem(error.message, 'danger');
  }
};

visitaForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  limparMensagem();

  const formData = new FormData();
  formData.append('cliente_id', clienteSelect.value);
  formData.append('data_visita', dataVisitaInput.value);
  formData.append('tipo_visita', tipoVisitaInput.value);
  formData.append('resultado', resultadoInput.value);
  formData.append('observacoes', observacoesInput.value);
  formData.append('imagem_desenho', imagemDesenhoInput.files[0]);

  if (imagemLocalInput.files[0]) {
    formData.append('imagem_local', imagemLocalInput.files[0]);
  }

  try {
    const response = await fetch(`${API_URL}/visitas`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (response.status === 401) {
      redirecionarParaLogin();
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.mensagem || 'Falha ao salvar visita.');
    }

    visitaForm.reset();
    exibirMensagem('Visita salva com sucesso.', 'success');
    await carregarVisitas();
  } catch (error) {
    exibirMensagem(error.message, 'danger');
  }
});

recarregarVisitasButton.addEventListener('click', carregarVisitas);

visitasLista.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');

  if (!button) {
    return;
  }

  const { action, id } = button.dataset;
  const visita = obterVisitaPorId(id);

  try {
    if (action === 'maps') {
      abrirMaps(montarEnderecoCompleto(visita || {}));
      return;
    }

    if (action === 'whatsapp') {
      abrirWhatsApp(visita?.cliente_telefone, visita?.cliente_nome);
      return;
    }

    if (action === 'iniciar') {
      iniciarVisita(visita || {});
      return;
    }

    if (action === 'visualizar') {
      const data = await request(`/visitas/${id}`);
      window.open(data.dados.imagem_desenho_url, '_blank', 'noopener');
      return;
    }

    if (action === 'excluir') {
      const confirmar = window.confirm('Deseja realmente excluir esta visita?');

      if (!confirmar) {
        return;
      }

      await request(`/visitas/${id}`, { method: 'DELETE' });
      exibirMensagem('Visita excluída com sucesso.', 'success');
      await carregarVisitas();
    }
  } catch (error) {
    exibirMensagem(error.message, 'danger');
  }
});

const iniciarTela = async () => {
  if (!token) {
    redirecionarParaLogin();
    return;
  }

  try {
    await carregarPerfil();
    await carregarClientes();
    await carregarVisitas();
  } catch (error) {
    exibirMensagem(error.message, 'danger');
  }
};

iniciarTela();
