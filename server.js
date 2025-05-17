const express = require("express");
const axios = require("axios");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.static("public"));

const API_KEY = "284ce58fecmsha01014ea476b376p179fb2jsn714c3c6f02d8";
const API_HOST = "api-football-v1.p.rapidapi.com";

// ⚠️ Teste só com 3 ligas por enquanto. Depois volta pra [71, 72, 13, 140, 39, 135]
const LEAGUE_IDS = [71, 72, 13]; // Serie A, Serie B e Libertadores

// Função para ajustar o horário para fuso de Brasília
function ajustarHorarioBrasilia(dateStr) {
  const data = new Date(dateStr);
  data.setHours(data.getHours() - 3);
  return data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Rota principal que retorna os jogos do dia
app.get("/games", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const headers = {
      "X-RapidAPI-Key": API_KEY,
      "X-RapidAPI-Host": API_HOST,
    };

    // Promessas para cada liga
    const promises = LEAGUE_IDS.map((leagueId) =>
      axios.get(`https://${API_HOST}/v3/fixtures`, {
        params: { league: leagueId, date: today },
        headers,
      })
    );

    const results = await Promise.all(promises);
    const jogos = [];

    results.forEach((response) => {
      response.data.response.forEach((jogo) => {
        jogos.push({
          id: jogo.fixture.id,
          horario: ajustarHorarioBrasilia(jogo.fixture.date),
          liga: jogo.league.name,
          timeCasa: jogo.teams.home.name,
          timeFora: jogo.teams.away.name,
          logoCasa: jogo.teams.home.logo,
          logoFora: jogo.teams.away.logo,
        });
      });
    });

    if (jogos.length === 0) {
      console.log("⚠️ Nenhum jogo encontrado hoje.");
    } else {
      console.log(`✅ ${jogos.length} jogos encontrados e enviados.`);
    }

    res.json(jogos);
  } catch (error) {
    console.error("❌ Erro ao buscar jogos:", error.response?.status, error.message);
    res.status(500).json({ erro: "Erro ao buscar jogos" });
  }
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`🔥 SniperBet rodando na porta ${PORT}`);
});
