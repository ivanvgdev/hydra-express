// var debug = require('debug')('express-list-endpoints')
var regexpExpressRegexp = /^\/\^\\\/(?:(:?[\w\\.-]*(?:\\\/:?[\w\\.-]*)*)|(\(\?:\(\[\^\\\/]\+\?\)\)))\\\/.*/;
var regexpExpressParam = /\(\?:\(\[\^\\\/]\+\?\)\)/g;
let secureMiddlewareFnNames = process.env.SECURE_MIDDLEWARE_FN_NAMES || ['isAuthorized', 'isAuthorizedOrInternal'];

if (typeof secureMiddlewareFnNames === 'string' && secureMiddlewareFnNames.indexOf(',') > -1) {
  secureMiddlewareFnNames = secureMiddlewareFnNames.split(',');
  secureMiddlewareFnNames = secureMiddlewareFnNames.map(name => {
    return name.trim();
  });
} else if (typeof secureMiddlewareFnNames === 'string' && secureMiddlewareFnNames.indexOf(',') === -1) {
  console.warn('Secure middleware function names passed but malformed. Please use comma delimited values "fn1,fn2,fn3,...".');
}

/**
 * Returns all the verbs detected for the passed route
 */
var getRouteMethods = function (route) {
  var methods = []

  for (var method in route.methods) {
    if (method === '_all') continue

    methods.push(method.toUpperCase())
  }

  return methods
}

/**
 * Returns true if found regexp related with express params
 */
var hasParams = function (pathRegexp) {
  return regexpExpressParam.test(pathRegexp)
}

/**
 * @param {Object} route Express route object to be parsed
 * @param {string} basePath The basePath the route is on
 * @return {Object} Endpoint info
 */
var parseExpressRoute = function (route, basePath) {
  return {
    path: basePath + (basePath && route.path === '/' ? '' : route.path),
    methods: getRouteMethods(route)
  }
}

var parseExpressPath = function (expressPathRegexp, params) {
  var parsedPath = regexpExpressRegexp.exec(expressPathRegexp)
  var parsedRegexp = expressPathRegexp
  var paramIdx = 0

  while (hasParams(parsedRegexp)) {
    parsedRegexp = parsedRegexp.toString().replace(/\(\?:\(\[\^\\\/]\+\?\)\)/, ':' + params[paramIdx].name)
    paramIdx++
  }

  if (parsedRegexp !== expressPathRegexp) {
    parsedPath = regexpExpressRegexp.exec(parsedRegexp)
  }

  parsedPath = parsedPath[1].replace(/\\\//g, '/')

  return parsedPath
}

var parseEndpoints = function (app, basePath, endpoints) {
  var stack = app.stack || (app._router && app._router.stack)

  endpoints = endpoints || []
  basePath = basePath || ''

  stack.forEach(function (stackItem) {
    if (stackItem.route) {
      let routeMiddlewareSecured = stackItem.route.stack && stackItem.route.stack.some(layer => secureMiddlewareFnNames.includes(layer.name));
      let fullRoute = parseExpressRoute(stackItem.route, basePath);
      fullRoute.isSecured = routeMiddlewareSecured;
      endpoints.push(fullRoute);
    } else if (stackItem.name === 'router' || stackItem.name === 'bound dispatch') {
      if (regexpExpressRegexp.test(stackItem.regexp)) {
        var parsedPath = parseExpressPath(stackItem.regexp, stackItem.keys)

        parseEndpoints(stackItem.handle, basePath + '/' + parsedPath, endpoints)
      } else {
        parseEndpoints(stackItem.handle, basePath, endpoints)
      }
    }
  })

  return endpoints;
}

/**
 * Returns an array of strings with all the detected endpoints
 * @param {Object} app the express/route instance to get the endponts from
 */
var getEndpoints = function (app) {
  return parseEndpoints(app)
}

module.exports = getEndpoints 
