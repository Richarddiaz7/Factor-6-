// js/lobby.js
// Pantalla de lobby - Crear y unirse a salas multijugador

class LobbyManager {
  
  /**
   * Crear una sala nueva
   * @param {string} modo - 'solitario' o 'multijugador'
   * @param {number} numBots - Número de bots (solo modo solitario)
   * @param {number} apuesta - Cantidad de monedas a apostar
   * @returns {string|null} ID de la sala creada
   */
  static async crearSala(modo, numBots = 1, apuesta = 0) {
    const user = auth.currentUser;
    if (!user) {
      alert('❌ Debes iniciar sesión primero');
      return null;
    }
    
    const perfil = await AuthManager.obtenerPerfil(user.uid);
    const nombre = perfil?.nombre || 'Jugador';
    
    // Verificar monedas para apuesta
    if (apuesta > 0 && perfil && perfil.monedas < apuesta) {
      alert(`❌ No tienes suficientes monedas. Tienes ${perfil.monedas} 💰`);
      return null;
    }
    
    try {
      const salaRef = await db.collection('salas').add({
        creador: user.uid,
        creadorNombre: nombre,
        estado: 'esperando',
        modo: modo,
        numBots: numBots,
        apuesta: apuesta,
        maxJugadores: modo === 'solitario' ? 1 : 4,
        jugadores: [{
          uid: user.uid,
          nombre: nombre,
          listo: true
        }],
        creado: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('✅ Sala creada:', salaRef.id);
      return salaRef.id;
      
    } catch (error) {
      console.error('Error al crear sala:', error);
      alert('❌ Error al crear la sala');
      return null;
    }
  }
  
  /**
   * Unirse a una sala existente
   * @param {string} salaId - ID de la sala
   */
  static async unirseSala(salaId) {
    const user = auth.currentUser;
    if (!user) {
      alert('❌ Debes iniciar sesión primero');
      return;
    }
    
    const perfil = await AuthManager.obtenerPerfil(user.uid);
    const nombre = perfil?.nombre || 'Jugador';
    const salaRef = db.collection('salas').doc(salaId);
    
    try {
      await db.runTransaction(async (transaction) => {
        const salaDoc = await transaction.get(salaRef);
        
        if (!salaDoc.exists) {
          throw new Error('La sala ya no existe');
        }
        
        const sala = salaDoc.data();
        
        if (sala.estado !== 'esperando') {
          throw new Error('La partida ya empezó');
        }
        
        if (sala.jugadores.length >= sala.maxJugadores) {
          throw new Error('La sala está llena');
        }
        
        // Verificar si el jugador ya está en la sala
        const yaEnSala = sala.jugadores.some(j => j.uid === user.uid);
        if (yaEnSala) {
          throw new Error('Ya estás en esta sala');
        }
        
        // Verificar apuesta
        if (sala.apuesta > 0 && perfil && perfil.monedas < sala.apuesta) {
          throw new Error(`Necesitas ${sala.apuesta} monedas. Tienes ${perfil.monedas}`);
        }
        
        // Descontar apuesta al unirse
        if (sala.apuesta > 0) {
          await AuthManager.actualizarMonedas(user.uid, -sala.apuesta);
        }
        
        const nuevosJugadores = [...sala.jugadores, {
          uid: user.uid,
          nombre: nombre,
          listo: true
        }];
        
        transaction.update(salaRef, { 
          jugadores: nuevosJugadores,
          // Si se llenó, iniciar automáticamente
          estado: nuevosJugadores.length >= sala.maxJugadores ? 'jugando' : 'esperando'
        });
      });
      
      console.log('✅ Unido a sala:', salaId);
      
    } catch (error) {
      console.error('Error al unirse:', error);
      throw error;
    }
  }
  
  /**
   * Escuchar salas disponibles en tiempo real
   * @param {function} callback - Función que recibe el array de salas
   * @returns {function} Función para cancelar la suscripción
   */
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
      }, (error) => {
        console.error('Error escuchando salas:', error);
        callback([]);
      });
  }
  
  /**
   * Escuchar cambios en una sala específica
   * @param {string} salaId - ID de la sala
   * @param {function} callback - Función que recibe los datos de la sala
   * @returns {function} Función para cancelar la suscripción
   */
  static escucharSala(salaId, callback) {
    return db.collection('salas').doc(salaId)
      .onSnapshot((doc) => {
        if (doc.exists) {
          callback({ id: doc.id, ...doc.data() });
        } else {
          callback(null);
        }
      }, (error) => {
        console.error('Error escuchando sala:', error);
      });
  }
  
  /**
   * Iniciar partida manualmente (el creador)
   * @param {string} salaId - ID de la sala
   */
  static async iniciarPartida(salaId) {
    const user = auth.currentUser;
    const salaRef = db.collection('salas').doc(salaId);
    
    try {
      const salaDoc = await salaRef.get();
      const sala = salaDoc.data();
      
      if (sala.creador !== user.uid) {
        alert('❌ Solo el creador puede iniciar la partida');
        return;
      }
      
      if (sala.jugadores.length < 2) {
        alert('❌ Se necesitan al menos 2 jugadores');
        return;
      }
      
      await salaRef.update({ estado: 'jugando' });
      console.log('✅ Partida iniciada');
      
    } catch (error) {
      console.error('Error al iniciar:', error);
      alert('❌ Error al iniciar la partida');
    }
  }
  
  /**
   * Salir de una sala
   * @param {string} salaId - ID de la sala
   */
  static async salirSala(salaId) {
    const user = auth.currentUser;
    if (!user) return;
    
    const salaRef = db.collection('salas').doc(salaId);
    
    try {
      await db.runTransaction(async (transaction) => {
        const salaDoc = await transaction.get(salaRef);
        if (!salaDoc.exists) return;
        
        const sala = salaDoc.data();
        const nuevosJugadores = sala.jugadores.filter(j => j.uid !== user.uid);
        
        if (nuevosJugadores.length === 0) {
          // Si no quedan jugadores, eliminar la sala
          transaction.delete(salaRef);
        } else {
          transaction.update(salaRef, { 
            jugadores: nuevosJugadores,
            // Si era el creador, pasar al siguiente
            creador: sala.creador === user.uid ? nuevosJugadores[0].uid : sala.creador,
            creadorNombre: sala.creador === user.uid ? nuevosJugadores[0].nombre : sala.creadorNombre
          });
        }
      });
      
      console.log('✅ Saliste de la sala');
      
    } catch (error) {
      console.error('Error al salir:', error);
    }
  }
  
  /**
   * Eliminar una sala (solo el creador)
   * @param {string} salaId - ID de la sala
   */
  static async eliminarSala(salaId) {
    const user = auth.currentUser;
    const salaRef = db.collection('salas').doc(salaId);
    
    try {
      const salaDoc = await salaRef.get();
      const sala = salaDoc.data();
      
      if (sala.creador !== user.uid) {
        alert('❌ Solo el creador puede eliminar la sala');
        return;
      }
      
      await salaRef.delete();
      console.log('✅ Sala eliminada');
      
    } catch (error) {
      console.error('Error al eliminar:', error);
    }
  }
}
