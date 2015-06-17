/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var JWT_STRING = /^[A-Za-z0-9_=\-\.]*$/ // roughly
var boom = require('boom')
var config = require('./lib/config')
var Filter = require('./lib/filter')
var P = require('./lib/promise')
var JWTool = require('fxa-jwtool')
var log = require('./lib/log')
var Hapi = require('hapi')
var joi = require('joi')

function Server(config) {
  this.config = config
  var keys = this.keys = require('./lib/keys')(config)
  var jwtool = this.jwtool = new JWTool(config.jwk.trustedJKUs)
  this.hapi = new Hapi.Server()
  var db = this.db =
    new (
      require('./lib/db/' + config.db.driver)
    )(config.db[config.db.driver])
  var subscriptions = this.subscriptions = require('./lib/subscriptions')(db)

  this.hapi.connection({
    host: config.server.host,
    port: config.server.port
  })
  var plugins = [{
    register: require('hapi-fxa-oauth'),
    options: {
      host: config.oauth.host,
      port: config.oauth.port,
      insecure: config.oauth.insecure,
      keepAlive: config.oauth.host !== '127.0.0.1'
    }
  }]
  /* istanbul ignore else */
  if (config.oauth.host === '127.0.0.1') {
    plugins.push(require('./test/lib/oauth_plugin'))
  }

  this.hapi.register(
    plugins,
    function (err) {
      /* istanbul ignore if */
      if (err) {
        log.critical('plugin', { err: err })
        process.exit(8)
      }
    }
  )
  this.hapi.route([
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
        P.all(
          events.map(
            function (str) {
              // All events must verify, otherwise abort the whole batch
              return jwtool.verify(str)
            }
          )
        )
        .then(
          function (jwts) {
            return P.all(
              events.map(
                function (str) {
                  return db.append(str)
                }
              )
            )
            .then(
              function () {
                return subscriptions.notify(jwts)
              }
            )
          }
        )
        .then(
          function () {
            reply({})
          }
        )
        .catch(
          JWTool.JWTVerificationError,
          function (err) {
            reply(boom.wrap(err, 400))
          }
        )
        .catch(
          function (err) {
            reply(boom.wrap(err, 500))
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
        db.read(pos, num, new Filter(filter)).then(reply, reply)
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
        db.head().then(
          function (pos) {
            reply({ pos: pos })
          },
          reply
        )
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
        db.tail().then(
          function (pos) {
            reply({ pos: pos })
          },
          reply
        )
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
        subscriptions.create(req.payload)
          .then(
            function (sub) {
              reply({ id: sub.id })
            },
            reply
          )
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
        subscriptions.get(req.params.id)
          .then(
            function (sub) {
              subscriptions.set(sub) //touch
              reply(sub)
            },
            reply
          )
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
        subscriptions.get(req.params.id)
          .then(
            function (sub) {
              /* istanbul ignore else */
              if (req.payload.pos) { sub.pos = req.payload.pos }
              /* istanbul ignore else */
              if (req.payload.notify_url) { sub.notify_url = req.payload.notify_url }
              return subscriptions.set(sub)
            }
          )
          .then(
            function (sub) {
              reply(sub)
            },
            reply
          )
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
        subscriptions.del(req.params.id)
          .then(
            function () {
              reply({})
            },
            reply
          )
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
        var pos = req.query.pos || '0'
        var num = req.query.num || 1000
        subscriptions.get(req.params.id)
          .then(
            function (sub) {
              return P.all(
                [
                  subscriptions.set(sub), // touch
                  db.read(pos, num, sub.filter)
                ]
              )
            }
          )
          .then(
            function (all) {
              reply(all[1])
            },
            reply
          )
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
        subscriptions.get(req.params.id)
          .then(
            function (sub) {
              sub.pos = req.payload.pos
              return subscriptions.set(sub)
            }
          )
          .then(
            function (sub) {
              return db.read(sub.pos, 1000, sub.filter)
            }
          )
          .then(reply, reply)
      }
    }
  ])
}

Server.prototype.start = function () {
  return this.db.start()
    .then(
      function () {
        var d = P.defer()
        this.hapi.start(
          function () {
            log.info('start', this.config.server)
            d.resolve(this)
          }.bind(this)
        )
        return d.promise
      }.bind(this)
    )
}

Server.prototype.stop = function () {
  var d = P.defer()
  this.hapi.stop(
    function () {
      log.info('stopped')
      d.resolve()
    }
  )
  return d.promise
    .then(
      function () {
        return this.db.stop()
      }.bind(this)
    )
}

/* istanbul ignore if */
if (require.main === module) {
  var server = new Server(config)
  server.start()
  process.on(
    'SIGINT',
    function () {
      server.stop()
    }
  )
}
else {
  module.exports = Server
}
