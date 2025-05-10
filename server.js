const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 10000;

app.use(cors());

const headers = {
  'X-RapidAPI-Key': process.env.API_KEY_FOOTBALL,
  'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
};

const ligas = [39, 140, 135];

app.get('/ultimos-jogos', async (req, res) => {
  try {
    const resultados = [];
    for (const liga of ligas) {
      const response = await fetch(`https://api-football-v1.p.rapidapi.com/v3/fixtures?league=${liga}&season=2024&date=${new Date().toISOString().split('T')[0]}`, { headers });
      const data = await response.json();
      resultados.push(...data.response);
    }
    res.json({ response: resultados });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar jogos' });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
