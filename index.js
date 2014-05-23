var fs = require('fs')
var path = require('path')
var exec = require('child_process').exec
var Reload = require('nginx-reload')

module.exports = Vhosts

function Vhosts(opts, onChange) {
  if (!(this instanceof Vhosts)) return new Vhosts(opts, onChange)
  if (typeof opts === 'function') {
    onChange = opts
    opts = {}
  }
  this.opts = opts || {}
  this.confDir = opts.confDir || '/etc/nginx/conf.d/'
  this.onChange = onChange || function noop(){}
  this.nginx = Reload(opts.pidLocation, function (running) {
    if (onChange) onChange(running)
  })
}

Vhosts.prototype.config = function(opts) {
    var _ports = ["3001", "3002", "3003", "3004"];
    var _configuration = '';
    _configuration += 'upstream ' + opts.name + 'backend {\n';
    _configuration += 'least_conn;\n';
    opts.servers.forEach(function(server) {
        _configuration += "\n# " + server.host + '\n';
        _ports.forEach(function(port) {
            _configuration +=  '  server ' + server.ip +':' + port + ';\n'
        })

    })
    _configuration += '}\n\n';
    _configuration += "map $cookie_" + opts.name + "backend $sticky_backend {\n\n";
    _configuration += "  default " + opts.name + 'backend;\n\n'
    opts.servers.forEach(function(server) {
        _configuration += "\n  # " + server.host + '\n';
        _ports.forEach(function(port, index) {
            _configuration += "  " + server.host + '_' + index + ' ' + server.ip +':' + port + ';\n'
        })

    });

    _configuration += '}\n\n';

    _configuration += 'server {\n';
    _configuration += '  listen 80;\n';
    _configuration += '  server_name ' + opts.domain + ';\n';

    // ssl

    _configuration += '  location / {\n';
    // try with proxy upgrade
    // move with proxy_pass
    _configuration += '    proxy_set_header Host $host;\n';
    _configuration += '    error_page 502 @rrfallback;\n'; // can we use this name a couple times?
    _configuration += '    proxy_pass http://$sticky_backend$request_uri;\n';
    _configuration += '  }\n\n';

    _configuration += '  location @rrfallback {\n';
    _configuration += '    proxy_set_header Host $host;\n';
    _configuration += '    proxy_pass http://' + opts.name + 'backend;\n';
    _configuration += '  }\n}\n';

    return _configuration;

//  return  ''
//  +  'upstream ' + opts.name + ' {\n'
//  + '  server 127.0.0.1:' + opts.port + ';\n'
//  + '}\n'
//  + 'server {\n'
//  + '  listen 80;\n'
//  + '  server_name ' + opts.domain + ';\n'
//  + '  location / {\n'
//  + '    proxy_pass http://' + opts.name + ';\n'
//  + '    proxy_set_header X-Forwarded-For $remote_addr;\n'
//  + '    proxy_buffering off;\n'
//  + '  }\n'
//  + '}\n'
}

Vhosts.prototype.write = function(opts, cb) {
  var self = this
  var config = this.config(opts)
  var confPath = path.join(this.confDir, opts.name + '.conf')
  fs.writeFile(confPath, config, function(err) {
    if (err) return cb(err)
//

  })
}

Vhosts.prototype.end = function() {
  this.nginx.end()
}

Vhosts.prototype.remove = function(name, cb) {
  var self = this
  var confPath = path.join(this.confDir, name + '.conf')
  fs.unlink(confPath, function(err) {
    if (err) return cb(err)
    self.nginx.reload(cb)
  })
}

Vhosts.prototype.reload = function(cb) {
    this.nginx.reload(cb);
}


