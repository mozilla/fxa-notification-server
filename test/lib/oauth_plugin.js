/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

exports.register = function (server, options, next) {
  server.route([
    {
      method: 'GET',
      path: '/__heartbeat__',
      handler: function (req, reply) { reply() }
    },
    {
      method: 'POST',
      path: '/v1/verify',
      // Test tokens ala handlebars template:
      // "{{ user }}-{{ client_id }}-{{ scope }}"
      // use the token "bad" to trigger an invalid token error
      handler: function (req, reply) {
        var token = req.payload.token
        var words = token.split('-')
        var creds = {
          user: words[0],
          client_id: words[1],
          scope: words[2]
        }
        if (creds.user === 'bad') {
          return reply({ code: 400, message: 'Invalid token'}).code(400)
        }
        reply(creds)
      }
    }
  ])
  next()
}

exports.register.attributes = {
  name: 'dummy-oauth',
  version: '1.0.0'
}
