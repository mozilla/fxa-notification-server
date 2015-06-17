/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var convict = require('convict')
var fs = require('fs')
var path = require('path')

var config = convict(
  {
    log: {
      level: {
        format: String,
        default: 'info'
      },
      fmt: {
        format: String,
        default: 'heka'
      }
    },
    server: {
      host: {
        format: 'ipaddress',
        default: '127.0.0.1'
      },
      port: {
        format: 'port',
        default: 7879
      }
    },
    db: {
      driver: {
        format: String,
        default: 'mem'
      },
      redis: {
        host: {
          format: String,
          default: '127.0.0.1'
        },
        port: {
          default: 6379
        },
        keyPrefix: {
          format: String,
          default: 'fxa'
        }
      }
    },
    oauth: {
      host: {
        format: String,
        default: 'oauth.accounts.firefox.com'
      },
      port: {
        format: 'port',
        default: 443
      },
      insecure: {
        format: Boolean,
        default: false
      }
    },
    jwk: {
      secretKeyFile: {
        default: path.resolve(__dirname, '../secret.pem')
      },
      publicKeyFile: {
        default: path.resolve(__dirname, '../public.pem')
      },
      trustedJKUs: {
        default: []
      },
      iss: {
        default: 'localhost'
      },
      jku: {
        default: 'http://127.0.0.1:7879/.well-known/public-keys'
      },
      kid: {
        default: 'dev-1'
      }
    }
  }
)

var files = ('config.json,' + process.env.CONFIG_FILES)
  .split(',')
  .map(
    function (file) {
      return path.resolve(__dirname, '..', file)
    }
  )
  .filter(fs.existsSync)
config.loadFile(files)


config.validate()

module.exports = config.root()
