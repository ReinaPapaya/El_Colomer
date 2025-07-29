import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

const socket = io();
const rankingTable = document.querySelector('#rankingTable tbody');
const refreshBtn = document.getElementById('refreshBtn');
const downloadBtn = document.getElementById('downloadBtn');

let currentRanking = [];

// Conectar y solicitar estado
socket.on('connect', () => {
  socket.emit('requestState');
});

// Recibir estado actual
socket.on('stateUpdate', (state) => {
  currentRanking = state.ranking;
  showRanking();
});

// Recibir puntuaciones actualizadas
socket.on('scores', ({ ranking }) => {
  currentRanking = ranking;
  showRanking();
});

// Mostrar ranking
function showRanking() {
  rankingTable.innerHTML = '';
  
  currentRanking.forEach((entry, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${entry.team}</td>
      <td>${entry.points}</td>
    `;
    rankingTable.appendChild(tr);
  });
}

// Refrescar
refreshBtn.addEventListener('click', () => {
  socket.emit('requestState');
});

// Descargar ranking
downloadBtn.addEventListener('click', () => {
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