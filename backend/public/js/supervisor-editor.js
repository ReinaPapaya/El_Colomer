import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

const socket = io();
const authSection = document.querySelector('.auth-section');
const editorSection = document.querySelector('.editor-section');
const authStatus = document.querySelector('.auth-status');
const pinInput = document.getElementById('pin');
const authBtn = document.getElementById('authBtn');

// Autenticación
authBtn.addEventListener('click', () => {
  const pin = pinInput.value;
  socket.emit('authSupervisor', pin);
});

socket.on('authResult', ({ success, role }) => {
  if (success && role === 'supervisor') {
    authSection.style.display = 'none';
    editorSection.style.display = 'block';
    authStatus.textContent = 'Autenticado como Editor';
    authStatus.classList.add('authenticated');
  } else {
    alert('PIN incorrecto');
  }
});

// Cargar pack
document.getElementById('uploadPackBtn').addEventListener('click', () => {
  const fileInput = document.getElementById('packFile');
  const file = fileInput.files[0];
  if (!file) return alert('Selecciona un archivo');
  
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const pack = JSON.parse(e.target.result);
      fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pack)
      }).then(res => res.json()).then(data => {
        if (data.ok) {
          alert('Pack cargado correctamente');
        } else {
          alert('Error: ' + data.error);
        }
      });
    } catch (e) {
      alert('Archivo JSON inválido');
    }
  };
  reader.readAsText(file);
});

// Cargar reglas
document.getElementById('uploadRulesBtn').addEventListener('click', () => {
  const fileInput = document.getElementById('rulesFile');
  const file = fileInput.files[0];
  if (!file) return alert('Selecciona un archivo');
  
  const reader = new FileReader();
  reader.onload = e => {
    fetch('/api/upload-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: e.target.result })
    }).then(res => res.json()).then(data => {
      if (data.ok) {
        alert('Reglas cargadas correctamente');
      } else {
        alert('Error: ' + data.error);
      }
    });
  };
  reader.readAsText(file);
});

// Cargar logo
document.getElementById('uploadLogoBtn').addEventListener('click', () => {
  const fileInput = document.getElementById('logoFile');
  const file = fileInput.files[0];
  if (!file) return alert('Selecciona un archivo');
  
  const formData = new FormData();
  formData.append('logo', file);
  
  fetch('/api/upload-logo', {
    method: 'POST',
    body: formData
  }).then(res => res.json()).then(data => {
    if (data.ok) {
      alert('Logo cargado correctamente');
    } else {
      alert('Error: ' + data.error);
    }
  });
});

// Descargar respuestas
document.getElementById('downloadResponsesBtn').addEventListener('click', () => {
  window.open('/api/download-responses', '_blank');
});

// Descargar log
document.getElementById('downloadLogBtn').addEventListener('click', () => {
  window.open('/api/download-log', '_blank');
});

// Descargar ranking
document.getElementById('downloadRankingBtn').addEventListener('click', () => {
  fetch('/api/download-ranking')
    .then(res => res.json())
    .then(data => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ranking.json';
      a.click();
    });
});