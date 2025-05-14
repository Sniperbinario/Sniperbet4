const buscarEstatisticas = async (timeId) => {
  const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${timeId}&season=2024&last=5`;
  const response = await fetch(url, { headers });
  const data = await response.json();

  let mediaGolsFeitos = 0;
  let mediaGolsSofridos = 0;
  let mediaEscanteios = 0;
  let mediaCartoes = 0;
  let mediaChutes = 0;

  const ultimosJogos = [];

  for (const jogo of data.response) {
    const isCasa = jogo.teams.home.id === timeId;
    const timeMandante = jogo.teams.home.name;
    const timeVisitante = jogo.teams.away.name;

    const golsFeitos = isCasa ? jogo.goals.home : jogo.goals.away;
    const golsSofridos = isCasa ? jogo.goals.away : jogo.goals.home;
    const placar = `${jogo.goals.home}x${jogo.goals.away}`;
    const dataJogo = new Date(jogo.fixture.date).toLocaleDateString("pt-BR");

    ultimosJogos.push(`${dataJogo} — ${timeMandante} ${placar} ${timeVisitante}`);

    mediaGolsFeitos += golsFeitos;
    mediaGolsSofridos += golsSofridos;

    // Corrigido: acessar statistics diretamente por time
    const statsUrl = `https://api-football-v1.p.rapidapi.com/v3/fixtures/statistics?fixture=${jogo.fixture.id}`;
    const statsResponse = await fetch(statsUrl, { headers });
    const statsData = await statsResponse.json();
    const statsList = statsData.response;

    const statsTime = statsList.find(s => s.team.id === timeId);

    if (statsTime) {
      const stats = statsTime.statistics;
      mediaEscanteios += stats.find(e => e.type === "Corner Kicks")?.value || 0;
      mediaCartoes += stats.find(e => e.type === "Yellow Cards")?.value || 0;
      mediaChutes += stats.find(e => e.type === "Shots on Goal")?.value || 0;
    }
  }

  const total = data.response.length || 1;
  return {
    mediaGolsFeitos: (mediaGolsFeitos / total).toFixed(2),
    mediaGolsSofridos: (mediaGolsSofridos / total).toFixed(2),
    mediaEscanteios: (mediaEscanteios / total).toFixed(2),
    mediaCartoes: (mediaCartoes / total).toFixed(2),
    mediaChutes: (mediaChutes / total).toFixed(2),
    ultimosJogos
  };
};
