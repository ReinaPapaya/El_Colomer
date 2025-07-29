// backend/index.js (fragmento inicial actualizado)
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import multer from 'multer';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// --- Configuración de rutas absolutas ---
// __dirname en ES Modules se obtiene así:
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ruta absoluta al directorio frontend (hermano de backend)
const frontendPath = path.resolve(__dirname, '../frontend');
const publicPath = path.join(__dirname, 'public');
const dataPath = path.join(__dirname, 'data');
const uploadsPath = path.join(publicPath, 'uploads');
const logFilePath = path.join(dataPath, 'acciones.log');
const respuestasFilePath = path.join(dataPath, 'respuestas.json');

console.log('Directorios calculados:');
console.log('  __dirname (backend):', __dirname);
console.log('  frontendPath:', frontendPath);
console.log('  publicPath:', publicPath);
console.log('  dataPath:', dataPath);
console.log('  uploadsPath:', uploadsPath);

// Verificar existencia de frontend
if (!fs.existsSync(frontendPath)) {
  console.error(`❌ ERROR CRÍTICO: El directorio frontend no existe en ${frontendPath}`);
  // Opcional: Crear un index.html básico para diagnóstico
  // fs.mkdirSync(frontendPath, { recursive: true });
  // fs.writeFileSync(path.join(frontendPath, 'index.html'), '<h1>Error: Frontend no encontrado</h1>');
} else {
  console.log(`✅ Directorio frontend encontrado: ${frontendPath}`);
  const frontendFiles = fs.readdirSync(frontendPath);
  console.log(`   Contenido:`, frontendFiles);
}

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
  destination: uploadsPath,
  filename: function (req, file, cb) {
    cb(null, 'logo' + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// --- Servir archivos estáticos ---
// Servir frontend en la raíz
app.use(express.static(frontendPath));
// Servir archivos del supervisor
app.use('/supervisor', express.static(publicPath));

// Crear directorios si no existen
if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true });
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });

// Inicializar archivos si no existen
if (!fs.existsSync(logFilePath)) fs.writeFileSync(logFilePath, '');
if (!fs.existsSync(respuestasFilePath)) fs.writeFileSync(respuestasFilePath, '[]');

// --- Ruta raíz explícita ---
app.get('/', (req, res) => {
  console.log('Solicitud GET a /');
  const indexPath = path.join(frontendPath, 'index.html');
  console.log(`Intentando servir: ${indexPath}`);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error al servir index.html:', err);
      if (err.code === 'ENOENT') {
        res.status(404).send(`
          <h1>404 - index.html no encontrado</h1>
          <p>Se esperaba en: ${indexPath}</p>
          <p>Directorio frontend (${frontendPath}):</p>
          <pre>${fs.existsSync(frontendPath) ? fs.readdirSync(frontendPath).join('\n') : 'Directorio no existe'}</pre>
        `);
      } else {
        res.status(500).send('Error interno del servidor.');
      }
    }
  });
});

// --- Funciones de logging ---
function logAccion(accion, detalles = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} | ${accion} | ${JSON.stringify(detalles)}\n`;
  fs.appendFileSync(logFilePath, logEntry);
  io.emit('logUpdate', { timestamp, accion, detalles }); // Emitir a supervisores
}

// ... (resto del archivo index.js sin cambios) ...

// --- Endpoints ---
// 1. Descargar pack actual
app.get('/api/pack', (_req, res) => {
  try {
    const trivia = JSON.parse(fs.readFileSync('./data/trivia.json', 'utf8'));
    res.json(trivia);
  } catch (e) {
    res.status(500).json({ error: 'Error leyendo pack' });
  }
});

// 2. Subir / reemplazar pack
app.post('/api/upload', (req, res) => {
  try {
    fs.writeFileSync('./data/trivia.json', JSON.stringify(req.body, null, 2));
    trivia = req.body;
    logAccion('PACK_ACTUALIZADO', { titulo: req.body.meta?.titulo });
    io.emit('packUpdated'); // avisar a los supervisores
    res.json({ ok: true });
  } catch (e) {
    logAccion('ERROR_PACK', { error: e.message });
    res.status(400).json({ ok: false, error: e.message });
  }
});

// 3. Servir reglas
app.get('/api/rules', (_req, res) => {
  res.sendFile(path.resolve('./data/REGULAS.md'));
});

// 4. Subir reglas
app.post('/api/upload-rules', (req, res) => {
  try {
    fs.writeFileSync('./data/REGULAS.md', req.body.content);
    logAccion('REGLAS_ACTUALIZADAS');
    res.json({ ok: true });
  } catch (e) {
    logAccion('ERROR_REGLAS', { error: e.message });
    res.status(400).json({ ok: false, error: e.message });
  }
});

// 5. Subir logo del evento
app.post('/api/upload-logo', upload.single('logo'), (req, res) => {
  if (req.file) {
    logAccion('LOGO_ACTUALIZADO', { filename: req.file.filename });
    res.json({ ok: true, filename: req.file.filename });
  } else {
    res.status(400).json({ ok: false, error: 'No file uploaded' });
  }
});

// 6. Descargar respuestas
app.get('/api/download-responses', (req, res) => {
  res.download('./data/respuestas.json');
});

// 7. Descargar log
app.get('/api/download-log', (req, res) => {
  res.download('./data/acciones.log');
});

// 8. Descargar ranking
app.get('/api/download-ranking', (req, res) => {
  try {
    const ranking = calcularRanking();
    res.json(ranking);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Estado en memoria ---
let trivia = (() => {
  try {
    return JSON.parse(fs.readFileSync('./data/trivia.json', 'utf8'));
  } catch (e) {
    return DEFAULT_PACK;
  }
})();
let game = { round: 0, question: null, timeLeft: 0, publishedQuestions: [] }; // Preguntas publicadas
let teams = new Set();
let answers = [];

// --- Función para calcular ranking ---
function calcularRanking() {
  const scores = {};
  answers.forEach(answer => {
    if (!scores[answer.team]) scores[answer.team] = 0;
    scores[answer.team] += answer.points || 0;
  });
  return Object.entries(scores)
    .map(([team, points]) => ({ team, points }))
    .sort((a, b) => b.points - a.points);
}

// --- Socket.IO events ---
io.on('connection', socket => {
  socket.on('join', name => { 
    teams.add(name); 
    socket.team = name;
    logAccion('EQUIPO_UNIDO', { team: name });
  });
  
  socket.on('answer', ({ team, values }) => {
    // Solo aceptar respuestas si la pregunta está activa
    if (game.question && game.timeLeft > 0) {
      const respuesta = { 
        team, 
        round: game.round, 
        values, 
        timestamp: new Date().toISOString() 
      };
      answers.push(respuesta);
      
      // Guardar en archivo
      fs.appendFileSync(respuestasFile, JSON.stringify(respuesta) + ",\n");
      
      logAccion('RESPUESTA_ENVIADA', { team, round: game.round });
      io.emit('newAnswer', respuesta); // Enviar a supervisores
    }
  });
  
  // Autenticación de supervisores
  socket.on('authSupervisor', (pin) => {
    if (parseInt(pin) === trivia.meta.pinSupervisor) {
      socket.isSupervisor = true;
      socket.emit('authResult', { success: true, role: 'supervisor' });
      logAccion('SUPERVISOR_AUTENTICADO');
    } else if (parseInt(pin) === trivia.meta.pinValidador) {
      socket.isValidator = true;
      socket.emit('authResult', { success: true, role: 'validator' });
      logAccion('VALIDADOR_AUTENTICADO');
    } else {
      socket.emit('authResult', { success: false });
      logAccion('INTENTO_AUTENTICACION_FALLIDO', { pin });
    }
  });
  
  // Supervisor lanza pregunta
  socket.on('startQuestion', (qid) => {
    if (!socket.isSupervisor) return;
    
    const q = trivia.preguntas.find(p => p.id === qid);
    if (!q) return;
    
    game = { 
      round: game.round + 1, 
      question: q, 
      timeLeft: q.tiempo,
      publishedQuestions: [...game.publishedQuestions, q]
    };
    
    logAccion('PREGUNTA_PUBLICADA', { id: q.id, texto: q.texto });
    io.emit('question', q);
    
    // Contador regresivo
    const timer = setInterval(() => {
      game.timeLeft--;
      io.emit('timerUpdate', game.timeLeft);
      
      if (game.timeLeft <= 0) {
        clearInterval(timer);
        // Validación automática
        answers.filter(a => a.round === game.round).forEach(a => {
          const correct = q.respuestas[0];
          let points = 0;
          
          if (q.tipo === 'test') {
            // Para preguntas de test, comparamos con las opciones correctas
            if (correct.includes(a.values[0])) {
              points = q.items[0]?.valor || 0;
            }
          } else {
            // Para preguntas de texto
            a.values.forEach((v, i) => {
              if (v && correct[i] && 
                  v.trim().toLowerCase() === correct[i].toLowerCase()) {
                points += q.items[i]?.valor || 0;
              }
            });
          }
          
          const bonus = trivia.meta.bonus && points === q.items.reduce((s, it) => s + it.valor, 0);
          if (bonus) points += 1;
          a.points = points;
        });
        
        const ranking = calcularRanking();
        io.emit('scores', { answers, ranking });
        logAccion('VALIDACION_AUTOMATICA_COMPLETADA', { round: game.round });
      }
    }, 1000);
  });
  
  // Supervisor cambia puntuación
  socket.on('updateScore', ({ team, round, newPoints }) => {
    if (!socket.isSupervisor && !socket.isValidator) return;
    
    const answer = answers.find(a => a.team === team && a.round === round);
    if (answer) {
      answer.points = newPoints;
      const ranking = calcularRanking();
      io.emit('scores', { answers, ranking });
      logAccion('PUNTUACION_ACTUALIZADA', { team, round, old: answer.points, new: newPoints });
    }
  });
  
  // Solicitar estado actual (para cuando se recarga la página del supervisor)
  socket.on('requestState', () => {
    socket.emit('stateUpdate', {
      game,
      answers,
      ranking: calcularRanking(),
      publishedQuestions: game.publishedQuestions
    });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 El Colomer backend on port ${PORT}`);
  logAccion('SERVIDOR_INICIADO', { port: PORT });
});
