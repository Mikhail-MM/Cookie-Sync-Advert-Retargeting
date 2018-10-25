const express = require('express');
const path = require('path');
const uuidv4 = require('uuid/v4');
const cookieParser = require('cookie-parser')
const rp = require('request-promise')
const request = require('request')

const mongoose = require('mongoose');
const mongoDBuri = `mongodb://${process.env.MLABS_USER}:${process.env.MLABS_PW}@ds137581.mlab.com:37581/cookie-sync-mainframe` 

mongoose.Promise = global.Promise; 
mongoose.connect(mongoDBuri, { useNewUrlParser: true });

const Schema = mongoose.Schema;

const ClientSchema = new Schema({
	ipRange: [String],
	audienceTrackingID: String,
	partner1TrackingID: String,
	mainframeTrackingID: String,
	contentFocus: String,
});

const Client = mongoose.model('Client', ClientSchema);

const app = express();

app.use(cookieParser());

app.use('/*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "https://cookie-sync-partner-1.herokuapp.com, https://cookie-sync-audience-service.herokuapp.com, https://cookie-sync-publisher.herokuapp.com");
  res.header("Access-Control-Allow-Headers", "Origin, partner_1_tracking_id, X-Requested-With, Content-Type, Accept, x-audience-tracking-id, x-partner-1-tracking-id, x-contentFocus");
  res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE, PUT");
  res.header("Access-Control-Allow-Credentials", true);
  next();
});

app.use('/', (req, res, next) => {
	console.log("LOGGING COOKIES: ", req.cookies)
	console.log(" ")
	next();
});

app.get('/partner-sync', async (req, res, next) => {
	console.log("Partner sync request")
	let updateObject = {};
	if (req.headers['x-audience-tracking-id']) updateObject.audienceTrackingID = req.headers['x-audience-tracking-id'];
	if (req.headers['x-partner-1-tracking-id']) updateObject.partner1TrackingID = req.headers['x-partner-1-tracking-id'];
	if (req.headers['x-mainframe-tracking-id']) updateObject.mainFrameTrackingID = req.headers['x-mainframe-tracking-id'];
	if (req.headers['x-contentfocus']) updateObject.contentFocus = req.headers['x-contentfocus'];

	try {
			const updatedClient = await Client.findOneAndUpdate(
			{ 	$or: [
					{ ipRange: { $elemMatch: { $eq: req.headers['x-original-ip'] || '' } } },
					{ audienceTrackingID: req.headers['x-audience-tracking-id'] || '' },
					{ partner1TrackingID: req.headers['x-partner-1-tracking-id'] || '' },
					{ mainframeTrackingID: req.headers['x-mainframe-tracking-id'] || '' }]
			}, { 
				$set: updateObject, 
				$addToSet: { ipRange: req.headers['x-original-ip'] },
			}, { new: true, upsert: true })

			console.log("Did Client Update?")
			console.log(updatedClient)

			res.status(200).json(updatedClient)

	} catch(err) { next(err) }
});

app.get('/mainframe-sync', async (req, res, next) => {
	try {
		console.log("Syncing on Mainframe")
		const partner1Query =  req.headers['x-partner-1-tracking-id'] || req.cookies['partner_1_tracking_id']
		console.log('Partner 1 Query:', partner1Query)
		console.log('ReqHeaders Mainframe Tracking ID: ', req.headers['x-mainframe-tracking-id'])
		const updatedClient = await Client.findOneAndUpdate({partner1TrackingID: partner1Query}, {mainframeTrackingID: req.headers['x-mainframe-tracking-id']}, {new: true})
		const WTF = await Client.findOne({partner1TrackingID: partner1Query})
		console.log("WTF:", WTF)
		console.log("Updated existing client")
		console.log(updatedClient)
			res.send('OK')
	} catch(err) { next(err) }
})


app.get('/adworks', async (req, res, next) => {
	try {
		console.log("Generating Dynamic Retargetted Ad")
		const partner1Query =  req.headers['x-partner-1-tracking-id'] || req.cookies['partner_1_tracking_id']
		console.log(partner1Query)
		const clientMatch = await Client.findOne({partner1TrackingID: partner1Query})
		console.log(clientMatch)
			if (clientMatch && clientMatch.contentFocus) {
				res.sendFile(path.join(__dirname + `/ads/${clientMatch.contentFocus}.jpg`))
			} else {
				res.sendFile(path.join(__dirname + `/ads/Unknown.jpg`))
			}
	} catch(err) { next(err) }
})

// We can't send the ad request directly to the mainframe sync without dropping in a dummy script to identify this machine. Need to implement mainframe sync method

app.get('/prebid', async (req, res, next) => {
	try{
		const bids = await Promise.all([rp('https://cookie-sync-partner-2.herokuapp.com/bidding').json(), rp('https://cookie-sync-partner-1.herokuapp.com/bidding').json()])
		const partner1Query =  req.headers['x-partner-1-tracking-id'] || req.cookies['partner_1_tracking_id']
		const clientMatch = await Client.findOne({mainframeTrackingID: req.query['mainframe-tracking-id']})
		console.log(clientMatch)
		const winningBid = bids.reduce((a, b) => {
			if (a.bid > b.bid) {
				return a
			} else return b
		});
		const { origin, bid } = winningBid;

			if (clientMatch && clientMatch.contentFocus) {
				request(`${origin}/partnerAd/${clientMatch.contentFocus}.jpg`).pipe(res)
			} else {
				request(`${origin}/partnerAd/Unknown.jpg`).pipe(res)
			}
	} catch(err) { next(err) }
})


app.get('/timed-prebid', async (req, res, next) => {
	try {
		console.log("Fast Prebid")
		const partner1Query =  req.headers['x-partner-1-tracking-id'] || req.cookies['partner_1_tracking_id']
		console.log(partner1Query)
		const fastBid = await Promise.race([
			rp('https://cookie-sync-partner-1.herokuapp.com/bidding').json(), 
			rp('https://cookie-sync-partner-2.herokuapp.com/bidding').json()]
		)
		console.log("LOOKING FOR THE QUERY:", req.query['x-mainframe-tracking-id'])
		const clientMatch = await Client.findOne({mainframeTrackingID: req.query['mainframe-tracking-id']})

			if (clientMatch && clientMatch.contentFocus) {
				request(`${fastBid.origin}/partnerAd/${clientMatch.contentFocus}.jpg`).pipe(res)
			} else {
				request(`${fastBid.origin}/partnerAd/Unknown.jpg`).pipe(res)
			}
	} catch(err) { next(err) }
})


app.get('*', (req, res) => {
	console.log("Catch-All Handler")
	res.status(200).send("All Clear Chief.")
});


app.use(function(err, req, res, next) {
	console.log(err)
	res.status(err.status || 500).send();
});


const port = process.env.PORT || 1000;

app.listen(port);

console.log(`Audience Service Host listening on ${port}`);