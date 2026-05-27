// Punto de entrada principal
let currentGame = null;
let juegoActivo = false;

async function initApp() {
  await AuthManager.loginAnonimo();
  
  const jugadores = [
    { nombre: 'Tú', emoji: '😎', fichas: 6, esIA: false },
    { nombre: 'Bot', emoji: '🤖', fichas: 6, esIA: true }
  ];
  
  currentGame = new Factor6Game(jugadores);
  currentGame.iniciar();
  juegoActivo = true;
  
  uiManager.actualizarPanelJugadores(currentGame.jugadores, currentGame.turnoActual);
  iniciarTurno();
}

document.addEventListener('DOMContentLoaded', initApp);
