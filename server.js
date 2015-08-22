var http = require("http");
var wget = require('wget');
var cheerio = require('cheerio');
var urlencode = require('urlencode');
var options = {
    protocol: 'https',
    host: 'share.dmhy.org',
    path: '/cms/page/name/programme.html',
    method: 'GET'
};
var port = process.env.PORT || 3000;

function init_server() {
	var server = http.createServer(function(request, response) {
		next(null, response);
	}).listen(port);
}

//若有遇到亂碼:�，請重新整理(取JSON)
function get_html(response) {
	var req = wget.request(options, function(res) {
		var html_str = "";
		if(res.statusCode === 200) {
			res.on('error', function(err) {
				console.log(err);
			});
			res.on('data', function(chunk) {
				html_str += chunk;
			});
			res.on('end', function() {
				next(null, response, html_str);
			});
		
		}
	});

	req.end();
	req.on('error', function(err) {
		console.log(err);
	});
}

function parse_html(response, html_str) {
	response.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
	var $ = cheerio.load(html_str);
	var href_text = "";
	var a_text = "";
	var anime_name = "";
	var tmp_arr = new Array();
	var json_str = [];
	$('script').each(function(index, el) {
		if($(el).text().indexOf('/*******修改開始******/') !== -1) {
			var $$ = cheerio.load($(el).text());
			var tag_arr = $$('a');
			
			$$('a').each(function(index, el) {
				if(index != 0) {
					href_text = $$(el).attr('href');
					a_text = $$(el).text();
					tmp_arr = href_text.split('=');
					anime_name =  urlencode.decode(tmp_arr[1]);
					json_str.push({"anime_name": anime_name,"team": a_text,"link": href_text});
				}
			});
		}
	});
	
	response.write(JSON.stringify(json_str));
	response.end();
	
}

var tasks = [init_server, get_html, parse_html];
function next(err, res, str) {
	if(err) {
		throw err;
	}
	else {
		var current_task = tasks.shift();
		if(current_task) {
			current_task(res, str);
		}
	}
}

next();