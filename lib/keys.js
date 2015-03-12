var fs = require('fs')
var PrivateJWK = require('./jwkset').PrivateJWK
var PublicJWK= require('./jwkset').PublicJWK

module.exports = function (config) {
  var secretPem = fs.readFileSync(config.jwk.secretKeyFile, 'utf8')
  var publicPem = fs.readFileSync(config.jwk.publicKeyFile, 'utf8')
  return {
    secret: PrivateJWK.fromPEM(
      secretPem,
      {
        alg: 'RS256',
        kid: config.jwk.kid,
        jku: config.jwk.jku,
        iss: config.jwk.iss
      }
    ),
    public: PublicJWK.fromPEM(
      publicPem,
      {
        kid: config.jwk.kid,
        use: 'sig',
        alg: 'RS256'
      }
    ),
    secretPem: secretPem,
    publicPem: publicPem
  }
}
