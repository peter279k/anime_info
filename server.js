var http = require("http");
var fs = require("fs");
var wget = require('wget');
var cheerio = require('cheerio');
var urlencode = require('urlencode');
var url = require('url');
var sqlite3 = require('sqlite3').verbose();
var sqlite_handler = new sqlite3.Database('./cache/my.db.sqlite');
var options = {
    protocol: 'https',
    host: 'share.dmhy.org',
    path: '/cms/page/name/programme.html',
    method: 'GET'
};

//for Heroku
//var port = process.env.PORT || 5000;
//for vps
var port = 5000;
var get_method = "";

var server = http.createServer(function(request, response) {
	get_method = url.parse(request.url, true);
	if(request.url == '/' || get_method.query.action == "every_week") {
		detect_cache(response, "every_week");
	}
	else if(get_method.query.action == "over_week") {
		options.path = "/json/index.json";
		detect_cache(response, "over_week");
	}
	else
		request_url(response, __dirname + request.url);
}).listen(port); 

function detect_cache(response, type) {
	sqlite_handler.serialize(function() {
		sqlite_handler.all("SELECT * FROM " + type, function(err, rows) {
			if(err)
				console.log(err);
			else if(rows.length <= 0)
				get_cache(response, "create_new", null, type);
			else if(((new Date().getTime() - rows[0]["create_time"])/1000/60/60) >= 24)
				get_cache(response, "cache_expired", null, type);
			else
				get_cache(response, "cache_lived", rows, null);
		});
	});
}

function get_cache(response, type, rows, table_name) {
	switch(type) {
		case "create_new":
		case "cache_expired":
			get_html(response, type, table_name);
			break;
		default:
			load_template(response, rows);
	}
}

//若有遇到亂碼:�，請重新整理(取JSON)
function get_html(response, type, table_name) {
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
				parse_html(response, html_str, type, table_name);
			});
		
		}
	});

	req.end();
	req.on('error', function(err) {
		console.log(err);
	});
}

function parse_html(response, html_str, type, table_name) {
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
			
			write_cache(json_str, table_name);
			load_template(response, json_str);
		}
	});
}

function write_cache(json_arr, table_name) {
	sqlite_handler.serialize(function() {
		sqlite_handler.run("DELETE FROM " + table_name);
		var stmt = sqlite_handler.prepare("INSERT INTO " + table_name + "(create_time,anime_name,team,link) VALUES($create_time,$anime_name,$team,$link)");
		for(var count=0;count<json_arr.length;count++) {
			stmt.run({
				$create_time: new Date().getTime(),
				$anime_name: json_arr[count]["anime_name"],
				$team: json_arr[count]["team"],
				$link: json_arr[count]["link"]
			});
		}
		
		stmt.finalize();
	});
	
	sqlite_handler.close();
}

function load_template(response, json_arr) {
	response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
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