import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

const socket = io();
let currentTeam = null;
let answeredThisRound = false;

// Elementos del DOM
const joinSection = document.getElementById('joinSection');
const rulesSection = document.getElementById('rulesSection');
const gameSection = document.getElementById('gameSection');
const historySection = document.getElementById('historySection');
const joinForm = document.getElementById('joinForm');
const teamNameInput = document.getElementById('teamName');
const rulesContent = document.getElementById('rulesContent');
const acceptRulesBtn = document.getElementById('acceptRules');
const questionText = document.getElementById('questionText');
const answerSlots = document.getElementById('answerSlots');
const timeLeft = document.getElementById('timeLeft');
const sendBtn = document.getElementById('sendBtn');
const publishedQuestions = document.getElementById('publishedQuestions');
const historyList = document.getElementById('historyList');

// Cargar reglas al iniciar
fetch('/api/rules')
  .then(response => response.text())
  .then(content => {
    rulesContent.innerHTML = marked.parse(content);
  });

// Unirse al juego
joinForm.addEventListener('submit', e => {
  e.preventDefault();
  const teamName = teamNameInput.value.trim();
  if (teamName) {
    socket.emit('join', teamName);
    currentTeam = teamName;
    joinSection.style.display = 'none';
    rulesSection.style.display = 'block';
  }
});

// Aceptar reglas
acceptRulesBtn.addEventListener('click', () => {
  rulesSection.style.display = 'none';
  gameSection.style.display = 'block';
});

// Enviar respuesta
sendBtn.addEventListener('click', () => {
  if (answeredThisRound) return;
  
  const values = [];
  const inputs = answerSlots.querySelectorAll('input');
  inputs.forEach(input => {
    if (input.type === 'radio') {
      if (input.checked) values.push(input.value);
    } else {
      values.push(input.value);
    }
  });
  
  socket.emit('answer', { team: currentTeam, values });
  answeredThisRound = true;
  sendBtn.disabled = true;
  sendBtn.textContent = 'Respuesta enviada';
});

// Eventos de Socket.IO
socket.on('question', question => {
  // Agregar pregunta a las publicadas
  const publishedDiv = document.createElement('div');
  publishedDiv.className = 'published-question';
  publishedDiv.innerHTML = `
    <h3>Pregunta #${question.id}</h3>
    <p>${question.texto}</p>
  `;
  publishedQuestions.appendChild(publishedDiv);
  
  // Mostrar pregunta actual
  questionText.textContent = question.texto;
  answerSlots.innerHTML = '';
  answeredThisRound = false;
  sendBtn.disabled = false;
  sendBtn.textContent = 'Enviar respuesta';
  
  if (question.tipo === 'test') {
    question.opciones.forEach((opcion, index) => {
      const div = document.createElement('div');
      div.className = 'question-item';
      div.innerHTML = `
        <label class="answer-option">
          <input type="radio" name="answer-${question.id}" value="${opcion}" required>
          ${opcion}
        </label>
      `;
      answerSlots.appendChild(div);
    });
  } else {
    question.items.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'question-item';
      div.innerHTML = `
        <label for="item-${index}">${item.campo}</label>
        <input type="text" id="item-${index}" placeholder="${item.campo}" required>
      `;
      answerSlots.appendChild(div);
    });
  }
});

socket.on('timerUpdate', seconds => {
  timeLeft.textContent = seconds;
  if (seconds <= 0) {
    sendBtn.disabled = true;
  }
});

// Cargar logo del evento si existe
window.addEventListener('load', () => {
  const logoImg = document.createElement('img');
  logoImg.src = '/supervisor/uploads/logo.png';
  logoImg.onerror = () => {
    logoImg.src = '/supervisor/uploads/logo.jpg';
    logoImg.onerror = () => {
      logoImg.src = '/supervisor/uploads/logo.jpeg';
      logoImg.onerror = () => {
        document.getElementById('event-logo').innerHTML = '🎤';
      };
    };
  };
  logoImg.onload = () => {
    document.getElementById('event-logo').innerHTML = '';
    document.getElementById('event-logo').appendChild(logoImg);
  };
});

// Función para parsear markdown (simplificada)
const marked = {
  parse: (text) => {
    return text
      .replace(/\#\# (.*)/g, '<h2>$1</h2>')
      .replace(/\# (.*)/g, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }
};