const crypto = require('crypto');

class PKCEUtils {
  // Generar code_verifier aleatorio
  static generateCodeVerifier() {
    const randomBytes = crypto.randomBytes(32);
    return randomBytes
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Generar code_challenge a partir del code_verifier
  static generateCodeChallenge(codeVerifier) {
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    return hash
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Generar par completo PKCE
  static generatePKCEPair() {
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    
    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256'
    };
  }
}

module.exports = PKCEUtils;