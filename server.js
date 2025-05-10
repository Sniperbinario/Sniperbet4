
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_FOOTBALL_KEY;

const BASE_URL = 'https://api-football-v1.p.rapidapi.com/v3';

app.get('/ultimos-jogos', async (req, res) => {
  try {
    const response = await fetch(`${BASE_URL}/fixtures?date=${new Date().toISOString().split('T')[0]}`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': API_KEY,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    const data = await response.json();

    const jogos = data.response.map(jogo => ({
      jogo_id: jogo.fixture.id,
      data: jogo.fixture.date.split('T')[0],
      hora: jogo.fixture.date.split('T')[1].substring(0,5),
      liga: jogo.league.name,
      time_casa: jogo.teams.home.name,
      time_fora: jogo.teams.away.name,
      status: jogo.fixture.status.short
    }));

    res.json(jogos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar jogos' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
