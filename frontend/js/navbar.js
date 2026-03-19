const CRMNavbar = (() => {
  const API_URL = window.location.protocol === 'file:'
    ? 'http://localhost:3000/api'
    : `${window.location.origin}/api`;

  const atualizarContador = async () => {
    const badge = document.getElementById('navbarNotificacoesCount');
    const token = localStorage.getItem('crm_token');

    if (!badge || !token) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/notificacoes?limit=1`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        badge.textContent = '0';
        badge.classList.add('d-none');
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.mensagem || 'Falha ao carregar notificações.');
      }

      const total = Number(data.resumo?.nao_lidas || 0);
      badge.textContent = total > 99 ? '99+' : String(total);
      badge.classList.toggle('d-none', total <= 0);
    } catch (error) {
      console.error('[navbar] erro ao carregar notificações:', error.message);
    }
  };

  return {
    atualizarContador,
  };
})();

window.CRMNavbar = CRMNavbar;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    CRMNavbar.atualizarContador();
  });
} else {
  CRMNavbar.atualizarContador();
}
