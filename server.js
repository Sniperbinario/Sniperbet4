const express = require("express");
const axios = require("axios");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.static("public"));

const API_KEY = "284ce58fecmsha01014ea476b376p179fb2jsn714c3c6f02d8";
const API_HOST = "api-football-v1.p.rapidapi.com";
const headers = {
  "X-RapidAPI-Key": API_KEY,
  "X-RapidAPI-Host": API_HOST,
};

const LEAGUE_IDS = [71, 72, 13]; // Serie A, Serie B, Libertadores

function ajustarHorarioBrasilia(dateStr) {
  const data = new Date(dateStr);
  data.setHours(data.getHours() - 3);
  return data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

app.get("/games", async (req, res) => {
  try {
    const hoje = new Date();
    const ontem = new Date();
    ontem.setDate(hoje.getDate() - 1);

    const datas = [formatDate(hoje), formatDate(ontem)];

    const promises = [];

    datas.forEach(data => {
      LEAGUE_IDS.forEach(leagueId => {
        promises.push(
          axios.get(`https://${API_HOST}/v3/fixtures`, {
            params: { league: leagueId, date: data },
            headers,
          })
        );
      });
    });

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
      console.log("⚠️ Nenhum jogo encontrado hoje ou ontem.");
    } else {
      console.log(`✅ ${jogos.length} jogos encontrados.`);
    }

    res.json(jogos);
  } catch (error) {
    console.error("❌ Erro ao buscar jogos:", error.message);
    res.status(500).json({ erro: "Erro ao buscar jogos" });
  }
});

// --- ROTA DE ANÁLISE (PASSO 2) ---
app.get("/analisar/:fixtureId", async (req, res) => {
  try {
    const fixtureId = req.params.fixtureId;

    const fixtureRes = await axios.get(`https://${API_HOST}/v3/fixtures`, {
      params: { id: fixtureId },
      headers,
    });
    const fixture = fixtureRes.data.response[0];
    const homeId = fixture.teams.home.id;
    const awayId = fixture.teams.away.id;

    async function buscarEstatisticas(timeId) {
      const jogosRes = await axios.get(`https://${API_HOST}/v3/fixtures`, {
        params: { team: timeId, last: 5 },
        headers,
      });

      const jogos = jogosRes.data.response;

      let total = {
        golsFeitos: 0,
        golsSofridos: 0,
        escanteios: 0,
        cartoes: 0,
        chutesGol: 0,
        chutesTotais: 0,
      };

      for (let j of jogos) {
        const statsRes = await axios.get(`https://${API_HOST}/v3/fixtures/statistics`, {
          params: { fixture: j.fixture.id },
          headers,
        });

        const stats = statsRes.data.response.find(s => s.team.id === timeId)?.statistics || [];

        total.golsFeitos += j.goals.for;
        total.golsSofridos += j.goals.against;
        total.escanteios += stats.find(s => s.type === "Corner Kicks")?.value || 0;
        total.cartoes += (stats.find(s => s.type === "Yellow Cards")?.value || 0)
                       + (stats.find(s => s.type === "Red Cards")?.value || 0);
        total.chutesGol += stats.find(s => s.type === "Shots on Goal")?.value || 0;
        total.chutesTotais += stats.find(s => s.type === "Total Shots")?.value || 0;
      }

      const dividir = jogos.length || 1;

      return {
        mediaGolsFeitos: (total.golsFeitos / dividir).toFixed(1),
        mediaGolsSofridos: (total.golsSofridos / dividir).toFixed(1),
        mediaEscanteios: (total.escanteios / dividir).toFixed(1),
        mediaCartoes: (total.cartoes / dividir).toFixed(1),
        mediaChutesGol: (total.chutesGol / dividir).toFixed(1),
        mediaChutesTotais: (total.chutesTotais / dividir).toFixed(1),
      };
    }

    const homeStats = await buscarEstatisticas(homeId);
    const awayStats = await buscarEstatisticas(awayId);

    res.json({
      timeCasa: fixture.teams.home.name,
      timeFora: fixture.teams.away.name,
      estatisticas: {
        casa: homeStats,
        fora: awayStats,
      },
    });
  } catch (error) {
    console.error("Erro na análise:", error.message);
    res.status(500).json({ erro: "Erro ao analisar fixture" });
  }
});

app.listen(PORT, () => {
  console.log(`🔥 SniperBet rodando na porta ${PORT}`);
});
