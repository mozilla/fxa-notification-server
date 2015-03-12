var convict = require('convict')
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

try {
  config.loadFile('./config.json')
}
catch (e) {}

config.validate()

module.exports = config.root()
