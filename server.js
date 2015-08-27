var http = require("http");
var fs = require("fs");
var wget = require('wget');
var cheerio = require('cheerio');
var urlencode = require('urlencode');
var url = require('url');
var options = {
    protocol: 'https',
    host: 'share.dmhy.org',
    path: '/cms/page/name/programme.html',
    method: 'GET'
};
var port = process.env.PORT || 5000;
var get_method = "";

var server = http.createServer(function(request, response) {
	get_method = url.parse(request.url, true);
	if(request.url == '/' || get_method.query.action == "every_week") {
		detect_cache(response);
	}
	else if(get_method.query.action == "over_week") {
		options.path = "/json/index.json";
		detect_cache(response);
	}
	else
		request_url(response, __dirname + request.url);
}).listen(port); 

function detect_cache(response) {
	var file_name = null;
	fs.readdir("./cache", function(err, files) {
		if(err)
			console.log(err);
		else if(files.length == 0) {
			get_cache(response, "create_new");
		}
		else {
			file_name = files[0].split('.');
			if(Math.round(new Date().getTime() - parseInt(file_name[0]))/1000/60/60 >= 24)
				get_cache(response, "cache_expired");
			else
				get_cache(response, parseInt(file_name[0]));
		}
	});
}

function get_cache(response, type) {
	switch(type) {
		case "create_new":
		case "cache_expired":
			get_html(response, type);
			break;
		default:
			read_cache(response, type);
	}
}

function read_cache(response, type) {
	fs.readFile("./cache/" + type + ".json", function(err, data) {
		if(err)
			console.log(err);
		else {
			load_template(response, data);
		}
	});
}

//若有遇到亂碼:�，請重新整理(取JSON)
function get_html(response, type) {
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
				parse_html(response, html_str, type);
			});
		
		}
	});

	req.end();
	req.on('error', function(err) {
		console.log(err);
	});
}

function parse_html(response, html_str, type) {
	var $ = cheerio.load(html_str);
	var href_text = "";
	var a_text = "";
	var anime_name = "";
	var tmp_arr = new Array();
	var json_str = [];
	var anime_arr = [];
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
					anime_arr = anime_name.split('+');
					anime_arr.pop();
					json_str.push({"anime_name": anime_arr.toString().replace(',', '+'),"team": a_text,"link": href_text});
				}
			});
			
			write_cache(response, JSON.stringify(json_str));
			//load_template(response, JSON.stringify(json_str));
		}
	});
}

function write_cache(response, json_str) {
	fs.writeFile("./cache/" + new Date().getTime() + ".json", json_str, function(err) {
		if(err)
			console.log(err);
		else
			load_template(response, json_str);
	});
}

function load_template(response, json_str) {
	response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
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
		response.end(data.toString().replace('%', table_str));
	});
}

function request_url(response, file_path) {
	fs.readFile(file_path, function(err, data) {
		if(err) {
			response.writeHead(404);
			response.end("File not found.");
			return;
		}
		else {
			response.writeHead(200);
			response.end(data, "binary");
		}
	});
}