import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/', express.static('../frontend'));

// --- Endpoints ---
// 1. Descargar pack actual
app.get('/api/pack', (_req, res) => res.json(trivia));

// 2. Subir / reemplazar pack
app.post('/api/upload', (req, res) => {
    try {
        fs.writeFileSync('./data/trivia.json', JSON.stringify(req.body, null, 2));
        trivia = req.body;
        io.emit('packUpdated'); // avisar a los supervisores
        res.json({ ok: true });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
});

// 3. Servir reglas
app.get('/api/rules', (_req, res) => res.sendFile('REGULAS.md', { root: '.' }));

// --- Estado en memoria ---
let trivia = JSON.parse(fs.readFileSync('./data/trivia.json', 'utf8'));
let game = { round: 0, question: null, timeLeft: 0 };
let teams = new Set();
let answers = [];

// --- Socket.IO events ---
io.on('connection', socket => {
    socket.on('join', name => { teams.add(name); socket.team = name; });

    socket.on('answer', ({ team, values }) => {
        answers.push({ team, round: game.round, values });
    });

    // supervisor lanza pregunta
    socket.on('startQuestion', qid => {
        const q = trivia.preguntas.find(p => p.id === qid);
        if (!q) return;
        game = { round: game.round + 1, question: q, timeLeft: q.tiempo };
        io.emit('question', q);
        setTimeout(() => {
            // Validación dummy para demo
            answers.filter(a => a.round === game.round).forEach(a => {
                const correct = trivia.preguntas.find(p => p.id === qid).respuestas[0];
                let points = 0;
                a.values.forEach((v, i) => {
                    if (v.trim().toLowerCase() === (correct[i] || '').toLowerCase())
                        points += q.items[i]?.valor || 0;
                });
                const bonus = trivia.meta.bonus && points === q.items.reduce((s, it) => s + it.valor, 0);
                if (bonus) points += 1;
                a.points = points;
            });
            io.emit('scores', answers);
        }, q.tiempo * 1000);
    });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Trivia backend on port ${PORT}`));
