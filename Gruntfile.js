/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

module.exports = function (grunt) {
  grunt.initConfig({
    JS_FILES: '{,lib/**/,test/**/}*.js',

    copyright: {
      app: {
        options: {
          pattern: /This Source Code Form is subject to the terms of the Mozilla Public/i
        },
        src: [
          '<%= JS_FILES %>'
        ]
      }
    },

    eslint: {
      options: {
        eslintrc: '.eslintrc'
      },
      files: [
        '<%= JS_FILES %>'
      ]
    }
  })

  grunt.loadNpmTasks('grunt-copyright')
  grunt.loadNpmTasks('grunt-eslint')

  grunt.registerTask('default', ['eslint', 'copyright'])
}
