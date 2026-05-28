// js/auth.js
// Manejo de autenticación y perfil de usuario

class AuthManager {
  
  static async loginAnonimo() {
    try {
      const result = await auth.signInAnonymously();
      console.log('👤 Sesión iniciada:', result.user.uid);
      
      // Crear perfil si no existe
      await this.crearPerfilSiNoExiste(result.user.uid);
      
      return result.user;
    } catch (error) {
      console.error('Error:', error);
      return null;
    }
  }

  static async crearPerfilSiNoExiste(uid) {
    const userRef = db.collection('usuarios').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      // Nuevo usuario con monedas iniciales
      await userRef.set({
        nombre: 'Jugador',
        monedas: 100,
        puntuacion: 1000,
        partidasJugadas: 0,
        partidasGanadas: 0,
        creado: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // También crear entrada en ranking
      await db.collection('ranking').doc(uid).set({
        puntuacion: 1000,
        partidasGanadas: 0
      });
      
      console.log('✅ Nuevo perfil creado');
    }
  }

  static async obtenerPerfil(uid) {
    const userDoc = await db.collection('usuarios').doc(uid).get();
    return userDoc.exists ? userDoc.data() : null;
  }

  static async actualizarNombre(uid, nombre) {
    await db.collection('usuarios').doc(uid).update({ nombre });
  }

  static async actualizarMonedas(uid, cantidad) {
    await db.collection('usuarios').doc(uid).update({
      monedas: firebase.firestore.FieldValue.increment(cantidad)
    });
  }

  static async logout() {
    await auth.signOut();
  }
}
