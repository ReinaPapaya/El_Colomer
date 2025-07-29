import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

const socket = io();
const authSection = document.querySelector('.auth-section');
const validationSection = document.querySelector('.validation-section');
const authStatus = document.querySelector('.auth-status');
const pinInput = document.getElementById('pin');
const authBtn = document.getElementById('authBtn');
const answersContainer = document.getElementById('answersContainer');
const rankingTable = document.querySelector('#rankingTable tbody');
const logContainer = document.getElementById('logContainer');

let allAnswers = [];
let currentRanking = [];

// Autenticación
authBtn.addEventListener('click', () => {
  const pin = pinInput.value;
  socket.emit('authSupervisor', pin);
});

socket.on('authResult', ({ success, role }) => {
  if (success && role === 'validator') {
    authSection.style.display = 'none';
    validationSection.style.display = 'block';
    authStatus.textContent = 'Autenticado como Validador';
    authStatus.classList.add('authenticated');
    
    // Solicitar estado actual
    socket.emit('requestState');
  } else {
    alert('PIN incorrecto');
  }
});

// Recibir estado actual
socket.on('stateUpdate', (state) => {
  allAnswers = state.answers;
  currentRanking = state.ranking;
  
  // Mostrar respuestas
  showAnswers();
  
  // Mostrar ranking
  showRanking();
});

// Recibir nueva respuesta
socket.on('newAnswer', (answer) => {
  allAnswers.push(answer);
  showAnswers();
});

// Recibir puntuaciones actualizadas
socket.on('scores', ({ answers, ranking }) => {
  allAnswers = answers;
  currentRanking = ranking;
  showAnswers();
  showRanking();
});

// Mostrar respuestas
function showAnswers() {
  answersContainer.innerHTML = '';
  
  // Agrupar respuestas por ronda
  const rounds = {};
  allAnswers.forEach(answer => {
    if (!rounds[answer.round]) rounds[answer.round] = [];
    rounds[answer.round].push(answer);
  });
  
  // Mostrar por ronda (últimas primero)
  Object.keys(rounds).sort((a, b) => b - a).forEach(round => {
    const roundDiv = document.createElement('div');
    roundDiv.innerHTML = `<h3>Ronda ${round}</h3>`;
    answersContainer.appendChild(roundDiv);
    
    rounds[round].forEach(answer => {
      const div = document.createElement('div');
      div.className = 'answer-item';
      div.innerHTML = `
        <strong>${answer.team}</strong>
        <div>Respuesta: ${Array.isArray(answer.values) ? answer.values.join(', ') : answer.values}</div>
        <div>
          <input type="number" class="score-input" value="${answer.points || 0}" 
                 data-team="${answer.team}" data-round="${answer.round}">
          <button class="update-score-btn" 
                  data-team="${answer.team}" data-round="${answer.round}">
            Actualizar
          </button>
        </div>
      `;
      answersContainer.appendChild(div);
    });
  });
  
  // Agregar eventos a botones de actualización
  document.querySelectorAll('.update-score-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const team = btn.dataset.team;
      const round = parseInt(btn.dataset.round);
      const newPoints = parseInt(btn.previousElementSibling.value);
      socket.emit('updateScore', { team, round, newPoints });
    });
  });
}

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

// Mostrar log
socket.on('logUpdate', (entry) => {
  const div = document.createElement('div');
  div.className = 'log-entry';
  div.textContent = `${entry.timestamp} | ${entry.accion} | ${JSON.stringify(entry.detalles)}`;
  logContainer.insertBefore(div, logContainer.firstChild);
  
  // Limitar a 100 entradas
  if (logContainer.children.length > 100) {
    logContainer.removeChild(logContainer.lastChild);
  }
});