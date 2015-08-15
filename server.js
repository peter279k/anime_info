var http = require("http");

var server = http.createServer();
server.on("request", function(req, res) {
	res.writeHead(200, {'Content-type': 'text/plain'});
	res.end('Hello World\n');
});

var port = Number(process.ENV.port || 5000);

server.listen(port);