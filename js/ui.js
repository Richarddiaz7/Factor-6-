// Manejo de la interfaz
class UIManager {
  actualizarPanelJugadores(jugadores, turnoActual) {
    const panel = document.getElementById('panel-jugadores');
    panel.innerHTML = '';
    jugadores.forEach((jugador, index) => {
      const card = document.createElement('div');
      card.className = `jugador-card ${jugador.esIA ? 'ia' : ''} ${index === turnoActual ? 'activo' : ''}`;
      card.innerHTML = `
        <div class="jugador-emoji">${jugador.emoji}</div>
        <div class="jugador-nombre">${jugador.nombre}</div>
        <div class="jugador-fichas">🪙 ${jugador.fichas}</div>
      `;
      panel.appendChild(card);
    });
  }
}

const uiManager = new UIManager();
