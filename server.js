// Please leave here even though it looks unused - this enables Node.js metrics to be pushed to Hosted Graphite
require('./app/utils/metrics.js').metrics()

// Node.js core dependencies
const path = require('path')
const fs = require('fs')

// npm dependencies
const express = require('express')
const nunjucks = require('nunjucks')
const favicon = require('serve-favicon')
const bodyParser = require('body-parser')
const logger = require('winston')
const loggingMiddleware = require('morgan')
const i18n = require('i18n')
const staticify = require('staticify')(path.join(__dirname, 'public'))
const compression = require('compression')

// Local dependencies
const router = require('./app/router')
const cookies = require('./app/utils/cookies')
const noCache = require('./app/utils/no_cache')
const session = require('./app/utils/session')

// Global constants
const CSS_PATH = staticify.getVersionedPath('/stylesheets/application.min.css')
const JAVASCRIPT_PATH = staticify.getVersionedPath('/javascripts/application.js')
const IFRAME_CSS_PATH = staticify.getVersionedPath('/stylesheets/iframe.css')
const PORT = process.env.PORT || 3000
const {NODE_ENV} = process.env
const argv = require('minimist')(process.argv.slice(2))
const unconfiguredApp = express()
const oneYear = 86400000 * 365
const publicCaching = {maxAge: oneYear}

// Define app views
const APP_VIEWS = [
  path.join(__dirname, '/govuk_modules/govuk_template/views/layouts'),
  path.join(__dirname, '/app/views')
]

function initialiseGlobalMiddleware (app) {
  logger.stream = {
    write: function (message) {
      logger.info(message)
    }
  }
  app.set('settings', {getVersionedPath: staticify.getVersionedPath})
  app.use(/\/((?!images|public|stylesheets|javascripts).)*/, loggingMiddleware(
    ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - total time :response-time ms'))
  app.use(favicon(path.join(__dirname, 'govuk_modules', 'govuk_template', 'assets', 'images', 'favicon.ico')))
  app.use(staticify.middleware)

  app.use(function (req, res, next) {
    res.locals.asset_path = '/public/'
    if (typeof process.env.ANALYTICS_TRACKING_ID === 'undefined') {
      logger.warn('Google Analytics Tracking ID [ANALYTICS_TRACKING_ID] is not set')
      res.locals.analyticsTrackingId = '' // to not break the app
    } else {
      res.locals.analyticsTrackingId = process.env.ANALYTICS_TRACKING_ID
    }
    res.locals.session = function () {
      return session.retrieve(req, req.chargeId)
    }
    next()
  })

  app.use(function (req, res, next) {
    noCache(res)
    next()
  })

  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({extended: true}))

  app.use(compression())

  app.disable('x-powered-by')
}

function initialisei18n (app) {
  i18n.configure({
    locales: ['en'],
    directory: path.join(__dirname, '/locales'),
    objectNotation: true,
    defaultLocale: 'en',
    register: global
  })

  app.use(i18n.init)
}

function initialiseProxy (app) {
  app.enable('trust proxy')
}

function initialiseCookies (app) {
  cookies.configureSessionCookie(app)
}

function initialiseTemplateEngine (app) {
  // Configure nunjucks
  // see https://mozilla.github.io/nunjucks/api.html#configure
  const nunjucksConfiguration = {
    express: app, // the express app that nunjucks should install to
    autoescape: true, // controls if output with dangerous characters are escaped automatically
    throwOnUndefined: false, // throw errors when outputting a null/undefined value
    trimBlocks: true, // automatically remove trailing newlines from a block/tag
    lstripBlocks: true, // automatically remove leading whitespace from a block/tag
    watch: NODE_ENV !== 'production', // reload templates when they are changed (server-side). To use watch, make sure optional dependency chokidar is installed
    noCache: NODE_ENV !== 'production' // never use a cache and recompile templates each time (server-side)
  }

  // Initialise nunjucks environment
  const nunjucksEnvironment = nunjucks.configure(APP_VIEWS, nunjucksConfiguration)

  // Set view engine
  app.set('view engine', 'njk')

  // Version static assets on production for better caching
  // if it's not production we want to re-evaluate the assets on each file change
  nunjucksEnvironment.addGlobal('css_path', NODE_ENV === 'production' ? CSS_PATH : staticify.getVersionedPath('/stylesheets/application.min.css'))
  nunjucksEnvironment.addGlobal('iframe_css_path', NODE_ENV === 'production' ? IFRAME_CSS_PATH : staticify.getVersionedPath('/stylesheets/iframe.css'))
  nunjucksEnvironment.addGlobal('js_path', NODE_ENV === 'production' ? JAVASCRIPT_PATH : staticify.getVersionedPath('/javascripts/application.js'))
  // Initialise internationalisation
  fs.readFile('./locales/en.json', 'utf8', (err, data) => {
    if (err) {
      throw err
    }
    nunjucksEnvironment.addGlobal('i18n', JSON.parse(data))
    nunjucksEnvironment.addGlobal('i18n_as_string', data)
  })
}

function initialisePublic (app) {
  app.use('/public', express.static(path.join(__dirname, '/public'), publicCaching))
  app.use('/public', express.static(path.join(__dirname, '/govuk_modules/govuk_template/assets'), publicCaching))
  app.use('/public', express.static(path.join(__dirname, '/app/data'), publicCaching))
  app.use('/public', express.static(path.join(__dirname, '/govuk_modules/govuk-country-and-territory-autocomplete'), publicCaching))
  app.use('/public', express.static(path.join(__dirname, '/govuk_modules/govuk_frontend_toolkit'), publicCaching))
  app.use('/javascripts', express.static(path.join(__dirname, '/public/assets/javascripts'), publicCaching))
  app.use('/images', express.static(path.join(__dirname, '/public/images'), publicCaching))
  app.use('/stylesheets', express.static(path.join(__dirname, '/public/assets/stylesheets'), publicCaching))
}

function initialiseRoutes (app) {
  router.bind(app)
}

function listen () {
  const app = initialise()
  app.listen(PORT)
  logger.log('Listening on port ' + PORT)
}

/**
 * Configures app
 * @return app
 */
function initialise () {
  const app = unconfiguredApp
  initialiseProxy(app)

  initialiseGlobalMiddleware(app)
  initialisei18n(app)
  initialiseCookies(app)
  initialiseTemplateEngine(app)
  initialiseRoutes(app)
  initialisePublic(app)

  return app
}

/**
 * Starts app
 */
function start () {
  listen()
}

// Immediately invoke start if -i flag set. Allows script to be run by task runner
if (argv.i) {
  start()
}

module.exports = {
  start: start,
  getApp: initialise
}
