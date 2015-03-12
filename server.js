var JWT_STRING = /^[A-Za-z0-9_=\-\.]*$/ // roughly
var async = require('async')
var config = require('./lib/config')
var JWKSet = require('./lib/jwkset')
var log = require('./lib/log')
var subscriptions = require('./lib/subscriptions')
var notifier = require('./lib/notifier')
var hapi = require('hapi')
var joi = require('joi')

var db = require('./lib/db/' + config.db.driver)

var keys = require('./lib/keys')(config)
var jw = new JWKSet(config.jwk.trustedJKUs)

var server = new hapi.Server()
server.connection({
  host: config.server.host,
  port: config.server.port
})

server.register(
  {
    register: require('hapi-fxa-oauth'),
    options: {
      host: config.oauth.host,
      port: config.oauth.port,
      insecure: config.oauth.insecure
    }
  },
  function (err) {
    if (err) {
      log.critical('plugin', { err: err })
      process.exit(8)
    }
  }
)

server.route([
  {
    method: 'GET',
    path: '/.well-known/public-keys',
    handler: function (req, reply) {
      reply(
        {
          keys: [ keys.public ]
        }
      )
    }
  },
  {
    method: 'POST',
    path: '/v0/publish',
    config: {
      validate: {
        payload: {
          events: joi.array()
            .max(1000)
            .items(joi.string().regex(JWT_STRING))
            .required()
        }
      }
    },
    handler: function (req, reply) {
      var events = req.payload.events
      var notifyUrls = {}
      async.forEach(
        events,
        function (str, next) {
          jw.verify(
            str,
            function (err, jwt) {
              if (err) { return next(err) }
              db.append(jwt)
              subscriptions.whoToNotify(event).forEach(
                function (url) {
                  notifyUrls[url] = true
                }
              )
              next()
            }
          )
        },
        function (err) {
          if (err) { return reply(err) }
          notifier.ping(Object.keys(notifyUrls))
          reply({})
        }
      )
    }
  },
  {
    method: 'GET',
    path: '/v0/events',
    config: {
      auth: {
        strategy: 'fxa-oauth',
        scope: ['notify']
      },
      validate: {
        query: {
          pos: joi.string().optional(),
          num: joi.number().min(1).max(1000).optional(),
          uid: joi.string().optional(),
          rid: joi.string().optional(),
          iss: joi.string().optional(),
          typ: joi.string().optional()
        }
      }
    },
    handler: function (req, reply) {
      var query = req.query
      var pos = query.pos || '0'
      var num = query.num || 1000
      var filter = {}
      if (query.uid) { filter.uid = query.uid }
      if (query.rid) { filter.rid = query.rid }
      if (query.iss) { filter.iss = query.iss }
      if (query.typ) { filter.typ = query.typ }
      reply(db.read(pos, num, filter))
    }
  },
  {
    method: 'GET',
    path: '/v0/events/head',
    config: {
      auth: {
        strategy: 'fxa-oauth',
        scope: ['notify']
      }
    },
    handler: function (req, reply) {
      reply({
        pos: db.head()
      })
    }
  },
  {
    method: 'GET',
    path: '/v0/events/tail',
    config: {
      auth: {
        strategy: 'fxa-oauth',
        scope: ['notify']
      }
    },
    handler: function (req, reply) {
      reply({
        pos: db.tail()
      })
    }
  },
  {
    method: 'POST',
    path: '/v0/subscribe',
    config: {
      auth: {
        strategy: 'fxa-oauth',
        scope: ['notify']
      },
      validate: {
        payload: {
          notify_url: joi.string().required(),
          filter: joi.object().keys({
            uid: joi.string().optional(),
            rid: joi.string().optional(),
            iss: joi.string().optional(),
            typ: joi.string().optional()
          }).optional(),
          ttl: joi.number().min(0).optional(),
          pos: joi.string().optional()
        }
      }
    },
    handler: function (req, reply) {
      var sub = subscriptions.add(req.payload)
      reply({
        id: sub.id
      })
    }
  },
  {
    method: 'GET',
    path: '/v0/subscription/{id}',
    config: {
      auth: {
        strategy: 'fxa-oauth',
        scope: ['notify']
      }
    },
    handler: function (req, reply) {
      reply(subscriptions.get(req.params.id))
    }
  },
  {
    method: 'POST',
    path: '/v0/subscription/{id}',
    config: {
      auth: {
        strategy: 'fxa-oauth',
        scope: ['notify']
      },
      validate: {
        payload: {
          pos: joi.string().optional(),
          notify_url: joi.string().optional()
        }
      }
    },
    handler: function (req, reply) {
      var sub = subscriptions.get(req.params.id)
      if (sub) {
        if (req.payload.pos) { sub.pos = req.payload.pos }
        if (req.payload.notify_url) { sub.notify_url = req.payload.notify_url }
      }
      reply(sub)
    }
  },
  {
    method: 'DELETE',
    path: '/v0/subscription/{id}',
    config: {
      auth: {
        strategy: 'fxa-oauth',
        scope: ['notify']
      }
    },
    handler: function (req, reply) {
      subscriptions.remove(req.params.id)
      reply({})
    }
  },
  {
    method: 'GET',
    path: '/v0/subscription/{id}/events',
    config: {
      auth: {
        strategy: 'fxa-oauth',
        scope: ['notify']
      },
      validate: {
        query: {
          pos: joi.string().optional(),
          num: joi.number().min(1).max(1000).optional()
        }
      }
    },
    handler: function (req, reply) {
      var sub = subscriptions.get(req.params.id)
      var pos = req.query.pos || '0'
      var num = req.query.num || 1000
      if (sub) {
        reply(db.read(pos, num, sub.filter))
      }
      else {
        reply({})
      }
    }
  },
  {
    method: 'POST',
    path: '/v0/subscription/{id}/events',
    config: {
      auth: {
        strategy: 'fxa-oauth',
        scope: ['notify']
      },
      validate: {
        payload: {
          pos: joi.string().required()
        }
      }
    },
    handler: function (req, reply) {
      var sub = subscriptions.get(req.params.id)
      if (sub) {
        sub.pos = req.payload.pos
        reply(db.read(sub.pos, 1000, sub.filter))
      }
      else {
        reply({})
      }
    }
  }
])

server.start(
  function () {
    log.info('start', config.server)
  }
)

process.on(
  'SIGINT',
  function () {
    server.stop()
  }
)
