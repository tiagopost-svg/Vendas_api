const API_URL = window.location.protocol === 'file:'
  ? 'http://localhost:3000/api'
  : `${window.location.origin}/api`;
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    email: document.getElementById('email').value,
    password: document.getElementById('password').value,
  };

  try {
    let response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 404) {
      response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    }

    const data = await response.json();

    loginMessage.classList.remove('d-none', 'alert-danger', 'alert-info');

    if (!response.ok || !data.sucesso) {
      loginMessage.classList.add('alert-danger');
      loginMessage.textContent = data.mensagem || 'Falha no login.';
      return;
    }

    localStorage.setItem('crm_token', data.token);
    localStorage.setItem('crm_usuario', JSON.stringify(data.usuario));

    loginMessage.classList.add('alert-info');
    loginMessage.textContent = data.mensagem;
    window.location.href = 'dashboard.html';
  } catch (error) {
    loginMessage.classList.remove('d-none', 'alert-info');
    loginMessage.classList.add('alert-danger');
    loginMessage.textContent = 'Não foi possível conectar ao backend. Verifique se a API está ativa.';
  }
});
