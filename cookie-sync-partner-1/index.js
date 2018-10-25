const express = require('express');
const path = require('path');
const uuidv4 = require('uuid/v4');
const cookieParser = require('cookie-parser')
const serveStatic = require('serve-static')
const request = require('request')
const rp = require('request-promise')

const app = express();

app.use(cookieParser());

app.use('/*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "https://cookie-sync-audience-service.herokuapp.com, https://cookie-sync-publisher.herokuapp.com");
  res.header("Access-Control-Allow-Headers", "Origin, partner_1_tracking_id, X-Requested-With, Content-Type, Accept, x-audience-tracking-id, x-partner-1-tracking-id, x-contentFocus");
  res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE, PUT");
  res.header("Access-Control-Allow-Credentials", true);
  next();
});

app.use('/*', (req, res, next) => {
			console.log("Check Origin: ", req.headers['origin'])
			console.log("Logging Cookies: ", req.cookies)
			if (!req.cookies['partner_1_tracking_id']) {
				const uniqueID = uuidv4();
				res.setHeader('Set-Cookie', [`partner_1_tracking_id=${uniqueID}`]);
			}
	next();
});

app.get('/track', (req, res, next) => {
		req.headers['x-audience-tracking-id'] = req.query.audience_tracking_id;
		req.headers['x-partner-1-tracking-id'] = req.cookies.partner_1_tracking_id;
		req.headers['x-contentfocus'] = req.query.contentFocus;
		req.headers['x-original-ip'] = (req.headers['x-forwarded-for']) ? req.headers['x-forwarded-for'].split(',')[0] : req.ip
		req.pipe(request.get('https://cookie-sync-mainframe.herokuapp.com/partner-sync')
			.on('response', (response) => { })).pipe(res)
});

app.get('/bidding', (req, res, next) => {
	res.json({
		origin: 'https://cookie-sync-partner-1.herokuapp.com', 
		bid: Math.random() 
	})
})
app.get('/adwork', async (req, res, next) => {
	if (req.query['mainframe-tracking-id'] && req.cookies.partner_1_tracking_id) {
		req.headers['x-mainframe-tracking-id'] = req.query['mainframe-tracking-id']
		req.headers['x-partner-1-tracking-id'] = req.cookies.partner_1_tracking_id
			const options = {
				url: 'https://cookie-sync-mainframe.herokuapp.com/mainframe-sync',
				headers: {
					'x-mainframe-tracking-id': req.query['mainframe-tracking-id'],
					'x-partner-1-tracking-id': req.cookies.partner_1_tracking_id
				}
			}
			const mainframeLink = await rp(options)
	}
	req.pipe(request.get('https://cookie-sync-mainframe.herokuapp.com/adworks').on('response', (response) => {})).pipe(res)
})

app.use('/partnerAd', serveStatic(path.join(__dirname, '/ads')))

app.get('*', (req, res) => {
	res.status(200).send("All Clear Chief.")
});


app.use(function(err, req, res, next) {
	console.log(err)
	res.status(err.status || 500).send();
});


const port = process.env.PORT || 7000;

app.listen(port);

console.log(`Partner 1 Host listening on ${port}`);