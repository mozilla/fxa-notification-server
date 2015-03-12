var jws = require('jws')
var request = require('request')
var jwk2pem = require('pem-jwk').jwk2pem
var pem2jwk = require('pem-jwk').pem2jwk

function PrivateJWK(jwk) {
  this.jwk = jwk
  this.pem = jwk2pem(jwk)
}

PrivateJWK.fromPEM = function (pem, extras) {
  return new PrivateJWK(pem2jwk(pem, extras))
}

PrivateJWK.prototype.toJSON = function () {
  return this.jwk
}

PrivateJWK.prototype.sign = function (data) {
  return jws.sign(
    {
      header: {
        alg: this.jwk.alg,
        jku: this.jwk.jku,
        kid: this.jwk.kid
      },
      payload: {
        iss: this.jwk.iss,
        sub: data
      },
      secret: this.pem
    }
  )
}

function PublicJWK(jwk) {
  this.jwk = jwk
  this.pem = jwk2pem(jwk)
}

PublicJWK.fromPEM = function (pem, extras) {
  return new PublicJWK(pem2jwk(pem, extras))
}

PublicJWK.prototype.toJSON = function () {
  return this.jwk
}

PublicJWK.prototype.verify = function (str) {
  if (jws.verify(str, this.pem)) {
    return jws.decode(str)
  }
}

function JWKSet(trusted) {
  this.trusted = trusted
  this.jwkSets = {}
}
JWKSet.PublicJWK = PublicJWK
JWKSet.PrivateJWK = PrivateJWK

function getJwkSet(jku, cb) {
  request(
    {
      method: 'GET',
      url: jku,
      strictSSL: true,
      json: true
    },
    function (err, res, json) {
      if (err || res.statusCode !== 200) {
        return cb(err || new Error('unavailable'))
      }
      var set = {}
      json.keys.forEach(
        function (key) {
          set[key.kid] = new PublicJWK(key)
        }
      )
      cb(null, set)
    }
  )
}


JWKSet.prototype.fetch = function (jku, kid, cb) {
  var set = this.jwkSets[jwt.header.jku]
  if (set && set[kid]) {
    return cb(null, set[kid])
  }
  getJwkSet(
    jku,
    function (err, set) {
      if (err) { return cb(err) }
      this.jwkSets[jku] = set
      if (!set[kid]) { return cb(new Error('unknown kid')) }
      cb(null, set[kid])
    }.bind(this)
  )
}

JWKSet.prototype.verify = function (str, cb) {
  var jwt = jws.decode(str)
  if (!jwt) { return cb(new Error('invalid')) }
  if (this.trusted.indexOf(jwt.header.jku) === -1) {
    return cb(new Error('untrusted'))
  }
  this.fetch(
    jwt.header.jku,
    jwt.header.kid,
    function (err, jwk) {
      if (err) { return cb(err) }
      cb(null, jwk.verify(str))
    }
  )
}

module.exports = JWKSet
