// Manejo de autenticación
class AuthManager {
  static async loginAnonimo() {
    try {
      const result = await auth.signInAnonymously();
      console.log('👤 Sesión iniciada:', result.user.uid);
      return result.user;
    } catch (error) {
      console.error('Error:', error);
      return null;
    }
  }
}
