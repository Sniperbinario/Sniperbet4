const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

const leagueIds = [71, 72, 13, 39, 140, 135]; // Séries importantes
const season = 2024;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

app.get('/games', async (req, res) => {
  const apiKey = process.env.API_KEY;
  const brDate = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const [day, month, year] = brDate.split('/');
  const today = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

  let finalGames = [];

  try {
    for (const leagueId of leagueIds) {
      const fixtureRes = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${today}&league=${leagueId}&season=${season}`, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      });

      const fixtures = fixtureRes.data.response;

      for (const match of fixtures) {
        const fixtureId = match.fixture.id;
        const homeId = match.teams.home.id;
        const awayId = match.teams.away.id;
        const leagueId = match.league.id;

        const homeStats = await getTeamStats(apiKey, homeId, leagueId);
        const awayStats = await getTeamStats(apiKey, awayId, leagueId);
        const homeLast5 = await getLastMatches(apiKey, homeId);
        const awayLast5 = await getLastMatches(apiKey, awayId);
        const prediction = await getPrediction(apiKey, fixtureId);
        const standings = await getStandings(apiKey, leagueId);
        const odds = await getOdds(apiKey, fixtureId);

        finalGames.push({
          fixtureId,
          homeTeam: match.teams.home.name,
          awayTeam: match.teams.away.name,
          homeLogo: match.teams.home.logo,
          awayLogo: match.teams.away.logo,
          time: new Date(match.fixture.date).toLocaleTimeString('pt-BR', {
            timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
          }),
          stats: { home: homeStats, away: awayStats },
          last5Matches: { home: homeLast5, away: awayLast5 },
          prediction,
          standings,
          odds,
          recommendation: homeStats.shots > 5 && homeStats.goalsFor > 1 ? 'Vale apostar' : 'Não vale apostar'
        });
      }
    }

    if (finalGames.length < 1) return res.json([]);
    res.json(finalGames);
  } catch (err) {
    console.error('Erro:', err.message);
    res.json([]);
  }
});

async function getTeamStats(apiKey, teamId, leagueId) {
  try {
    const res = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/teams/statistics?team=${teamId}&season=${season}&league=${leagueId}`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    const stats = res.data.response;
    const manual = await calculateShotsAndCorners(apiKey, teamId);

    return {
      goalsFor: stats.goals?.for?.average?.total ?? 0,
      goalsAgainst: stats.goals?.against?.average?.total ?? 0,
      shots: stats.shots?.total?.average ?? manual.shots,
      shotsOn: stats.shots?.on?.average ?? manual.shotsOn,
      corners: manual.corners,
      cards: (Math.random() * 4).toFixed(1)
    };
  } catch {
    const manual = await calculateShotsAndCorners(apiKey, teamId);
    return {
      goalsFor: 0, goalsAgainst: 0,
      shots: manual.shots,
      shotsOn: manual.shotsOn,
      corners: manual.corners,
      cards: 0
    };
  }
}

async function calculateShotsAndCorners(apiKey, teamId) {
  try {
    const res = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${teamId}&last=5`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    const fixtures = res.data.response;
    let totalShots = 0, totalShotsOn = 0, totalCorners = 0, count = 0;

    for (const match of fixtures) {
      await delay(600);
      const fixtureId = match.fixture.id;

      const statsRes = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/fixtures/statistics?fixture=${fixtureId}`, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      });

      const teamStats = statsRes.data.response.find(s => s.team.id === teamId);
      if (!teamStats) continue;

      const shots = teamStats.statistics.find(s => s.type === 'Total Shots')?.value ?? 0;
      const shotsOn = teamStats.statistics.find(s => s.type === 'Shots on Goal')?.value ?? 0;
      const cornersEntry = teamStats.statistics.find(s =>
        ['Corner Kicks', 'Total corners'].includes(s.type)
      );
      const corners = cornersEntry?.value ?? 0;

      totalShots += shots;
      totalShotsOn += shotsOn;
      totalCorners += corners;
      count++;
    }

    return {
      shots: count > 0 ? (totalShots / count).toFixed(1) : '-',
      shotsOn: count > 0 ? (totalShotsOn / count).toFixed(1) : '-',
      corners: count > 0 ? (totalCorners / count).toFixed(1) : '-'
    };
  } catch {
    return { shots: '-', shotsOn: '-', corners: '-' };
  }
}

async function getPrediction(apiKey, fixtureId) {
  try {
    const res = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/predictions?fixture=${fixtureId}`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    const pred = res.data.response?.[0];
    return {
      advice: pred?.predictions?.advice ?? '-',
      win_percent: {
        home: pred?.teams?.home?.win !== undefined ? `${pred.teams.home.win}%` : '-',
        draw: pred?.teams?.draw !== undefined ? `${pred.teams.draw}%` : '-',
        away: pred?.teams?.away?.win !== undefined ? `${pred.teams.away.win}%` : '-'
      }
    };
  } catch {
    return {
      advice: '-',
      win_percent: { home: '-', draw: '-', away: '-' }
    };
  }
}

async function getStandings(apiKey, leagueId) {
  try {
    const res = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/standings?league=${leagueId}&season=${season}`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    return res.data.response?.[0]?.league?.standings?.[0] ?? [];
  } catch {
    return [];
  }
}

async function getOdds(apiKey, fixtureId) {
  try {
    const res = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/odds?fixture=${fixtureId}&bookmaker=6`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    const bets = res.data.response?.[0]?.bookmakers?.[0]?.bets ?? [];
    const odds = {};

    for (const bet of bets) {
      if (bet.name === 'Match Winner') {
        for (const v of bet.values) {
          if (v.value === 'Home') odds.home = v.odd;
          if (v.value === 'Draw') odds.draw = v.odd;
          if (v.value === 'Away') odds.away = v.odd;
        }
      }
      if (bet.name === 'Over/Under') {
        const over = bet.values.find(v => v.value === 'Over 2.5');
        if (over) odds.over25 = over.odd;
      }
      if (bet.name === 'Both Teams To Score') {
        const btts = bet.values.find(v => v.value === 'Yes');
        if (btts) odds.btts = btts.odd;
      }
    }

    return odds;
  } catch {
    return {};
  }
}

async function getLastMatches(apiKey, teamId) {
  try {
    const res = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${teamId}&last=5`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    });

    return res.data.response.map(match => ({
      date: new Date(match.fixture.date).toLocaleDateString('pt-BR'),
      homeTeam: match.teams.home.name,
      awayTeam: match.teams.away.name,
      homeGoals: match.goals.home,
      awayGoals: match.goals.away,
      venue: match.teams.home.id === teamId ? 'Casa' : 'Fora'
    }));
  } catch {
    return [];
  }
}

app.listen(PORT, () => {
  console.log(`🔥 SniperBet rodando na porta ${PORT}`);
});
