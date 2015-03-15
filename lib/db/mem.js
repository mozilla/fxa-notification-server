/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var db = []

function match(event, filter) {
  var filterNames = Object.keys(filter)
  for (var i = 0; i < filterNames.length; i++) {
    var name = filterNames[i]
    if (event[name] && event[name] === filter[name]) {
      continue
    }
    else {
      return false
    }
  }
  return true
}

module.exports = {
  append: function (event) {
    db.push(event)
    return (db.length - 1).toString()
  },
  read: function (pos, num, filter) {
    pos = +pos || 0
    num = num || 1000
    filter = filter || {}
    var events = []
    while (events.length < num && pos < db.length) {
      var event = db[pos]
      if (match(event, filter)) {
        events.push(event)
      }
      pos++
    }
    return {
      next_pos: pos.toString(),
      events: events
    }
  },
  head: function () {
    return db.length.toString()
  },
  tail: function () {
    return '0'
  }
}
