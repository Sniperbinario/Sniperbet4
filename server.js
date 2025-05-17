const express = require("express");
const axios = require("axios");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.static("public")); // para servir o frontend (index.html)

const API_KEY = "284ce58fecmsha01014ea476b376p179fb2jsn714c3c6f02d8";
const LEAGUE_IDS = [71, 72, 13, 140, 39, 135]; // Serie A, Serie B, Liberta, La Liga, Premier, ITA

function ajustarHorarioBrasilia(dateStr) {
  const data = new Date(dateStr);
  data.setHours(data.getHours() - 3);
  return data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

app.get("/games", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const promises = LEAGUE_IDS.map((leagueId) =>
      axios.get("https://api-football-v1.p.rapidapi.com/v3/fixtures", {
        params: { league: leagueId, date: today },
        headers: {
          "X-RapidAPI-Key": API_KEY,
          "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
        },
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

    res.json(jogos);
  } catch (error) {
    console.error("Erro ao buscar jogos:", error.message);
    res.status(500).json({ erro: "Erro ao buscar jogos" });
  }
});

app.listen(PORT, () => {
  console.log(`🔥 SniperBet rodando na porta ${PORT}`);
});
