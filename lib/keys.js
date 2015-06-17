/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var path = require('path')
var JWK = require('fxa-jwtool').JWK

module.exports = function (config) {
  var secretKey = JWK.fromFile(
    path.resolve(__dirname, '..', config.jwk.secretKeyFile),
    {
      alg: 'RS256',
      kid: config.jwk.kid,
      jku: config.jwk.jku,
      iss: config.jwk.iss
    }
  )
  var publicKey = JWK.fromFile(
    path.resolve(__dirname, '..', config.jwk.publicKeyFile),
    {
      kid: config.jwk.kid,
      use: 'sig',
      alg: 'RS256'
    }
  )
  return {
    secret: secretKey,
    public: publicKey
  }
}
