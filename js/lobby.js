// js/lobby.js
// Pantalla de lobby - Crear y unirse a salas

class LobbyManager {
  
  // Crear una sala nueva
  static async crearSala(modo, numBots = 1, apuesta = 0) {
    const user = auth.currentUser;
    if (!user) return null;
    
    const perfil = await AuthManager.obtenerPerfil(user.uid);
    
    // Verificar monedas para apuesta
    if (apuesta > 0 && perfil.monedas < apuesta) {
      alert('No tienes suficientes monedas');
      return null;
    }
    
    const salaRef = await db.collection('salas').add({
      creador: user.uid,
      creadorNombre: perfil.nombre,
      estado: 'esperando',
      modo: modo,
      numBots: numBots,
      apuesta: apuesta,
      maxJugadores: modo === 'solitario' ? 1 : 4,
      jugadores: [{
        uid: user.uid,
        nombre: perfil.nombre,
        listo: true
      }],
      creado: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Sala creada:', salaRef.id);
    return salaRef.id;
  }
  
  // Unirse a una sala existente
  static async unirseSala(salaId) {
    const user = auth.currentUser;
    if (!user) return;
    
    const perfil = await AuthManager.obtenerPerfil(user.uid);
    const salaRef = db.collection('salas').doc(salaId);
    
    await db.runTransaction(async (transaction) => {
      const salaDoc = await transaction.get(salaRef);
      if (!salaDoc.exists) throw new Error('Sala no encontrada');
      
      const sala = salaDoc.data();
      if (sala.estado !== 'esperando') throw new Error('Sala ya empezó');
      if (sala.jugadores.length >= sala.maxJugadores) throw new Error('Sala llena');
      
      // Verificar apuesta
      if (sala.apuesta > 0 && perfil.monedas < sala.apuesta) {
        throw new Error('Monedas insuficientes');
      }
      
      const nuevosJugadores = [...sala.jugadores, {
        uid: user.uid,
        nombre: perfil.nombre,
        listo: true
      }];
      
      transaction.update(salaRef, { jugadores: nuevosJugadores });
    });
    
    console.log('✅ Unido a sala:', salaId);
  }
  
  // Obtener salas disponibles
  static escucharSalas(callback) {
    return db.collection('salas')
      .where('estado', '==', 'esperando')
      .orderBy('creado', 'desc')
      .limit(20)
      .onSnapshot((snapshot) => {
        const salas = [];
        snapshot.forEach(doc => {
          salas.push({ id: doc.id, ...doc.data() });
        });
        callback(salas);
      });
  }
  
  // Escuchar cambios en una sala específica
  static escucharSala(salaId, callback) {
    return db.collection('salas').doc(salaId)
      .onSnapshot((doc) => {
        if (doc.exists) {
          callback({ id: doc.id, ...doc.data() });
        }
      });
  }
  
  // Iniciar partida (cambiar estado)
  static async iniciarPartida(salaId) {
    await db.collection('salas').doc(salaId).update({
      estado: 'jugando'
    });
  }
  
  // Salir de sala
  static async salirSala(salaId) {
    const user = auth.currentUser;
    const salaRef = db.collection('salas').doc(salaId);
    
    await db.runTransaction(async (transaction) => {
      const salaDoc = await transaction.get(salaRef);
      const sala = salaDoc.data();
      const nuevosJugadores = sala.jugadores.filter(j => j.uid !== user.uid);
      transaction.update(salaRef, { jugadores: nuevosJugadores });
    });
  }
}
