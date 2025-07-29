import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

const socket = io();
const authSection = document.querySelector('.auth-section');
const controlSection = document.querySelector('.control-section');
const authStatus = document.querySelector('.auth-status');
const pinInput = document.getElementById('pin');
const authBtn = document.getElementById('authBtn');
const questionsList = document.getElementById('questionsList');
const answersContainer = document.getElementById('answersContainer');
const rankingTable = document.querySelector('#rankingTable tbody');
const logContainer = document.getElementById('logContainer');

let currentGame = null;
let allAnswers = [];
let currentRanking = [];

// Autenticación
authBtn.addEventListener('click', () => {
  const pin = pinInput.value;
  socket.emit('authSupervisor', pin);
});

socket.on('authResult', ({ success, role }) => {
  if (success && role === 'supervisor') {
    authSection.style.display = 'none';
    controlSection.style.display = 'block';
    authStatus.textContent = 'Autenticado como Supervisor';
    authStatus.classList.add('authenticated');
    
    // Solicitar estado actual
    socket.emit('requestState');
  } else {
    alert('PIN incorrecto');
  }
});

// Recibir estado actual
socket.on('stateUpdate', (state) => {
  currentGame = state.game;
  allAnswers = state.answers;
  currentRanking = state.ranking;
  
  // Mostrar preguntas
  showQuestions(state.publishedQuestions);
  
  // Mostrar respuestas
  showAnswers();
  
  // Mostrar ranking
  showRanking();
});

// Mostrar preguntas
function showQuestions(questions) {
  questionsList.innerHTML = '';
  
  fetch('/api/pack')
    .then(res => res.json())
    .then(pack => {
      pack.preguntas.forEach(question => {
        const isPublished = questions.some(q => q.id === question.id);
        const isCurrent = currentGame?.question?.id === question.id;
        
        const div = document.createElement('div');
        div.className = `question-item ${isPublished ? 'published' : ''}`;
        div.innerHTML = `
          <h4>${question.id}. ${question.texto}</h4>
          <p><strong>Tipo:</strong> ${question.tipo} | <strong>Tiempo:</strong> ${question.tiempo}s</p>
          ${!isPublished ? 
            `<button class="start-btn" data-id="${question.id}" ${isCurrent ? 'disabled' : ''}>
              ${isCurrent ? 'En curso...' : 'Publicar'}
            </button>` : 
            `<span style="color: var(--success);">✅ Publicada</span>`
          }
        `;
        questionsList.appendChild(div);
      });
      
      // Agregar eventos a botones
      document.querySelectorAll('.start-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const qid = parseInt(btn.dataset.id);
          socket.emit('startQuestion', qid);
        });
      });
    });
}

// Publicar pregunta
socket.on('question', (question) => {
  // Actualizar UI para mostrar que la pregunta está en curso
  document.querySelectorAll('.start-btn').forEach(btn => {
    if (parseInt(btn.dataset.id) === question.id) {
      btn.disabled = true;
      btn.textContent = 'En curso...';
    }
  });
});

// Actualizar temporizador
socket.on('timerUpdate', (timeLeft) => {
  // Podríamos mostrar el tiempo en algún lugar
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
  
  if (!currentGame || !currentGame.question) {
    answersContainer.innerHTML = '<p>No hay pregunta activa</p>';
    return;
  }
  
  const currentAnswers = allAnswers.filter(a => a.round === currentGame.round);
  
  if (currentAnswers.length === 0) {
    answersContainer.innerHTML = '<p>No hay respuestas aún</p>';
    return;
  }
  
  currentAnswers.forEach(answer => {
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