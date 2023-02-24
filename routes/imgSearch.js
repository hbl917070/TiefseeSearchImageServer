const fs = require("fs");
const express = require("express");
const path = require("path");
const fileUpload = require("express-fileupload");
const url = require("url");

//-----------

//避免同一個IP過度請求
var ar_stop_ip = [];

setInterval(func_timer_02, 1000 * 1800);//30分鐘清一次ip黑名單
function func_timer_02() {
	ar_stop_ip = [];
}

//-----------

var app = express();

// 啟用上傳檔案
app.use(fileUpload({
	createParentPath: true
}));

app.get("/", (req, res, next) => {
	res.send(`
		<p>此為Tiefsee用於搜圖的圖片暫存伺服器</p>
		<p>上傳的圖片會在60秒後永久刪除</p>
	`);
})

//上傳檔案
app.post("/upload", (req, res, next) => {

	//避免同一個IP過度請求
	let ip = req.connection.remoteAddress;
	if (ip.indexOf("::ffff:") === 0) { ip = ip.substr(7); }
	if (ar_stop_ip[ip] === undefined) { ar_stop_ip[ip] = 0; }
	ar_stop_ip[ip] += 1;
	if (ar_stop_ip[ip] > 600) {//半小時內超過600次
		console.log("請求過度頻繁，禁止請求：" + ip);
		return res.status(400).send(getErrJson("請求太頻繁"));
	}

	//----------

	let ua = req.headers["user-agent"];
	if (typeof ua === "string" && ua.indexOf("Tiefsee") > -1) {
	} else {
		return res.status(400).send(getErrJson("身份錯誤"));
	}

	if (!req.files || Object.keys(req.files).length === 0) {
		return res.status(400).send(getErrJson("未上傳圖片"));
	}

	let sampleFile = req.files.media;//取得欄位名稱為"media"的檔案

	if (sampleFile === undefined) {
		return res.status(400).send(getErrJson("欄位錯誤"));
	}

	let fileSize = sampleFile.size / 1024;//檔案大小(k)
	let fileType = sampleFile.mimetype;//檔案類型
	let fileName = makeRandom(20) + ".jpg";//檔名
	let filePath = `${path.dirname(__filename)}/../public/imgSearch/${fileName}`;
	let fileUrl = `${fullUrl(req)}/imgSearch/${fileName}`;//回傳的網址

	if (fileSize > 2000) {//2000k
		return res.status(400).send(getErrJson("檔案過大"));
	}
	if (fileType.indexOf("image/") !== 0) {
		return res.status(400).send(getErrJson("錯誤的圖片類型"));
	}

	sampleFile.mv(filePath, (err) => {
		if (err) { return res.status(500).send(err); }

		//60秒後刪除檔案
		setTimeout(() => {
			try {
				fs.unlinkSync(filePath);
			} catch (e) {
				console.log("刪除檔案失敗：" + filePath);
				console.log(e);
			}
		}, 1000 * 60);

		let json = {
			status: 200,
			success: true,
			data: {
				media: fileUrl
			}
		}
		res.send(json);
	});

});

module.exports = app;

//---------------------

/**
 * 取得網址
 */
function fullUrl(req) {
	return url.format({
		protocol: req.protocol,
		host: req.get("host"),
		//pathname: req.originalUrl
	});
}

/**
 * json資料格式
 */
function getErrJson(msg) {
	return {
		status: 400,
		success: false,
		error: {
			message: msg
		}
	}
}

/**
 * 取得隨機亂數
 * @param {*} digits 長度
 */
function makeRandom(digits) {
	let text = "";
	//var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let possible = "abcdefghijkmnopqrstuvwxyz23456789";

	for (let i = 0; i < digits; i++)
		text += possible.charAt(Math.floor(Math.random() * possible.length));

	return text;
}
