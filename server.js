var http = require("http");
var fs = require("fs");
var wget = require('wget');
var cheerio = require('cheerio');
var urlencode = require('urlencode');
var options = {
    protocol: 'https',
    host: 'share.dmhy.org',
    path: '/cms/page/name/programme.html',
    method: 'GET'
};
var port = process.env.PORT || 5000;

function init_server() {
	var server = http.createServer(function(request, response) {
		if(request.url == '/') {
			next(null, response);
		}
		else {
			request_url(response, request.url.replace('/',''));
		}
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
	
	next(null, response, JSON.stringify(json_str));
}

function load_template(response, json_str) {
	var json_arr = JSON.parse(json_str);
	var table_str = "";
	fs.readFile("templates/index.html", 'utf-8' , function(err, data) {
		if(err) {
			throw err;
		}
		table_str += "<thead><tr><th>動畫名稱</th><th>字幕組</th><th>動畫連結</th></tr></thead>";
		table_str += "<tbody>";
		for(var json_count=0;json_count<json_arr.length;json_count++) {
			table_str += "<tr>";
			table_str += "<td>" + json_arr[json_count]["anime_name"] + "</td>";
			table_str += "<td>" + json_arr[json_count]["team"] + "</td>";
			table_str += "<td><a target='_blank' href='"+'https://share.dmhy.org/'+json_arr[json_count]["link"]+"'>" + '連結' + "</a></td>";
			table_str += "</tr>";
		}
		table_str += "</tbody>";
		response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
		response.end(data.toString().replace('%', table_str));
	});
}

function request_url(response, file_path) {
	response.writeHead(200);
	fs.readFile(file_path, function(err, data) {
		if(err)
			throw err;
		else {
			response.end(data, "binary");
		}
	});
}

var tasks = [init_server, get_html, parse_html, load_template];
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