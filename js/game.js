// Lógica del juego Factor 6
class Factor6Game {
  constructor(jugadores) {
    this.jugadores = jugadores || [];
    this.turnoActual = 0;
    this.casillas = { 1: null, 2: null, 3: null, 4: null, 5: null };
    this.pozo = 0;
    this.juegoActivo = false;
  }

  procesarTirada(jugadorIndex, numero) {
    if (!this.juegoActivo) return null;
    if (jugadorIndex !== this.turnoActual) return null;

    const jugador = this.jugadores[jugadorIndex];
    let mantieneTurno = false;

    if (numero >= 1 && numero <= 5) {
      if (this.casillas[numero] === null) {
        this.casillas[numero] = jugadorIndex;
        jugador.fichas--;
        mantieneTurno = true;
      } else {
        this.casillas[numero] = null;
        jugador.fichas++;
        mantieneTurno = false;
      }
    }

    if (numero === 6) {
      this.pozo++;
      jugador.fichas--;
      mantieneTurno = true;
    }

    if (jugador.fichas <= 0) {
      this.ganador = jugadorIndex;
      this.juegoActivo = false;
      return { mantieneTurno: false, ganador: jugadorIndex };
    }

    return { mantieneTurno, numero };
  }

  siguienteTurno() {
    this.turnoActual = (this.turnoActual + 1) % this.jugadores.length;
  }

  getJugadorActual() {
    return this.jugadores[this.turnoActual];
  }

  iniciar() {
    this.juegoActivo = true;
  }
}
