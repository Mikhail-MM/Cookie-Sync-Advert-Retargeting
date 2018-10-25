const express = require('express');
const path = require('path');
const uuidv4 = require('uuid/v4');
const cookieParser = require('cookie-parser')
const serveStatic = require('serve-static')

const app = express();

app.use(cookieParser());

app.use('/*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "https://cookie-sync-audience-service.herokuapp.com, https://cookie-sync-publisher.herokuapp.com, https://cookie-sync-mainframe.herokuapp.com");
  res.header("Access-Control-Allow-Headers", "Origin, partner_1_tracking_id, X-Requested-With, Content-Type, Accept, x-audience-tracking-id, x-partner-1-tracking-id, x-contentFocus");
  res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE, PUT");
  res.header("Access-Control-Allow-Credentials", true);
  console.log('Cookies: ', req.cookies)
  next();
});

app.get('/bidding', (req, res, next) => {
	res.json({
		origin: 'https://cookie-sync-partner-2.herokuapp.com',
		bid: Math.random()
	})
});

app.use('/partnerAd', serveStatic(path.join(__dirname, '/ads')))

app.get('*', (req, res) => {
	console.log("Catch-All Handler")
	res.status(200).send("All Clear Chief.")
});


app.use(function(err, req, res, next) {
	console.log(err)
	res.status(err.status || 500).send();
});


const port = process.env.PORT || 2555;

app.listen(port);

console.log(`Audience Service Host listening on ${port}`);