This Cookie Sync Simulation includes 5 different components living on different domains:
	
	1) Audience Service - Keeps track of the user's browsing activity and purchasing habits.
	2) Partner 1 - Allows the mainframe to sync cookies from multiple domains to the same user by embedding itself in multiple sites visiting by the client. 
	3) Partner 2 - Serves advertisments.
	4) Mainframe - Keeps a database of users containing a cookie-matching table and known IP addresses, as well as their purchasing and browsing habits.
	5) Publisher - Hosts retargeted advertisment space.


- When the **Audience Service** _frontend_ is served to the client, the _backend_ attaches a cookie via Express Middleware:

```javascript
	app.use('/', (req, res, next) => {
		if (!req.cookies['audience_tracking_id']) {
			const uniqueID = uuidv4();
			res.setHeader('Set-Cookie', [`audience_tracking_id=${uniqueID}`]);
		}
		next();
	});
```

- **Audience Service** hosts a 1x1 tracking pixel which feeds information to **Partner 1** about the user.
- The **Audience Service** web-page consists of a simplified menu which establishes the user's browsing habits (Can think of it as simulating an online-store checkout, or pageview behavior metrics). The user's interests and identifier are forwarded to **Partner 1** via a **_query string_**
- React will handle re-sending the request via component state update & re-rendering when the _activeInterest_ cookie is reset.

```html
<img src={`https://cookie-sync-partner-1.herokuapp.com/track?audience_tracking_id=${activeClient}&contentFocus=${activeInterest}`}/>
```

- **Partner 1** receives the data and deposits its own tracking cookie onto the Client. 
- **Partner 1** forwards the data to **Mainframe** as HTTP Headers, which will build a persistent MongoDB entry for the user for tracking purposes.

```javascript
// Partner 1 Backend
const req = require('request')

app.get('/track', (req, res, next) => {
	
	req.headers['x-audience-tracking-id'] = req.query.audience_tracking_id;
	req.headers['x-partner-1-tracking-id'] = req.cookies.partner_1_tracking_id;
	req.headers['x-contentfocus'] = req.query.contentFocus;
	req.headers['x-original-ip'] = (req.headers['x-forwarded-for']) ? req.headers['x-forwarded-for'].split(',')[0] : req.ip
	
	req.pipe(
		request.get('https://cookie-sync-mainframe.herokuapp.com/partner-sync')
			.on('response', (response) => {
				console.log("Received Response from Mainframe")
			})).pipe(res)
});
```

```javascript
// Mainframe Backend
app.get('/partner-sync', async (req, res, next) => {
	
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

			res.status(200).json(updatedClient)

	} catch(err) { next(err) }
}
```

- When the Client visits **Publisher**, the goal is to serve a Re-Targeted ad via **Partner 1**. Thee retargeted images are hosted on **Mainframe** 
- Since **Partner 1** deposited a cookie to the Client's browser through the **Audience Service _tracking pixel_**, it will automatically be sent with any requests to **Partner 1**
- **Publisher** contains an image tag which will:
	1) Send a request to **Partner 1** requesting a dynamically targetted ad
	2) **Partner 1** will forward this request to **Mainframe**, because it needs to find out if this user is being tracked.
	3) If the user is found, **Mainframe** will infer the user's interests and send the appropriate image file back to the Client.
	4) If the user is not found, a general `Unknown.jpg` will be sent, representing a generalized advertisment from a third-party, or a randomly selected ad from eligible advertisers.

```html
/* Publisher */
<img src='https://cookie-sync-partner-1.herokuapp.com/adwork' />
```
```javascript
// Partner 1 Backend

app.get('/adwork', async (req, res, next) => {
	req.pipe(
		request.get('https://cookie-sync-mainframe.herokuapp.com/adworks')
		.on('response', (response) => {
			console.log("Response Received.")
	})).pipe(res)
})
```
```javascript
// Mainframe Backend
app.get('/adworks', async (req, res, next) => {
	try {
		
		const partner1Query =  req.headers['x-partner-1-tracking-id'] || req.cookies['partner_1_tracking_id']
		const clientMatch = await Client.findOne({partner1TrackingID: partner1Query})
			
			if (clientMatch && clientMatch.contentFocus) {
				res.sendFile(path.join(__dirname + `/ads/${clientMatch.contentFocus}.jpg`))
			} else {
				res.sendFile(path.join(__dirname + `/ads/Unknown.jpg`))
			}

	} catch(err) { next(err) }
})
```

This will return a re-targeted advertisment which is built through analysis of the client's browsing habits and purchases.


- The **Mainframe** also simulates _timed_ and _volume-based_ ad-buys served on **Publisher's Homepage** by coordinating bids between **Partner 1** and **Partner 2**. 
- The code above will be slightly modified to facilitate this data transfer	
	1) **Publisher** generates a UUID locally through clientside code and saves it as a Cookie with **Publisher** as the _Origin/Domain_.
	2) In the _/adworks_ request to **Partner 1**, this cookie is sent along as a query-string, so that the **Mainframe** can directly track the user by matching him to the stored cookie sent by **Partner 1**.
	3) After this request, the **Mainframe** will be able to identify users via any requests sent to its domain, as opposed to requiring coordination with **Partner 1**
	4) Two new image tags request a bidding service directly from **Mainframe**. These require the UUID generated on **Publisher**'s page locally as a _query-string_.
	5) **Mainframe** receives these requests, finds the user which we linked to in step 2, and signals **Partner 1** and **Partner 2** to place their bids (Just a random float between 0-1).
	6) In the first tag, the Partner with the *highest bid* is allocated ad-space, and **Mainframe** will forward **_Ads which are locally hosted on Partner Servers__** to the client.
	7) In the second tag, the partner with the *fastest bid* is allocated ad-space


```html
/* All Image Tags Send Locally Generated Publisher-Mainframe Link UUID to backends */
<img src={`https://cookie-sync-partner-1.herokuapp.com/adwork?mainframe-tracking-id=${this.state.mainframeTrackingID}`} />
<img src={`https://cookie-sync-mainframe.herokuapp.com/prebid?mainframe-tracking-id=${this.state.mainframeTrackingID}`} />
<img src={`https://cookie-sync-mainframe.herokuapp.com/timed-prebid?mainframe-tracking-id=${this.state.mainframeTrackingID}`} />
```

```javascript
// Partner 1 syncs Client directly to Mainframe by matching its own cookie with Publisher cookie
// Subsequent requests to directly Mainframe from Publisher will match user

// Partner 1 Backend

const rp = require('request-promise')

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
	// ...
})
```


```javascript
// Mainframe Backend

app.get('/mainframe-sync', async (req, res, next) => {
	try {
		const partner1Query =  req.headers['x-partner-1-tracking-id'] || req.cookies['partner_1_tracking_id']
		
		const updatedClient = await Client.findOneAndUpdate(
			{partner1TrackingID: partner1Query}, 
			{mainframeTrackingID: req.headers['x-mainframe-tracking-id']}, 
			{new: true})

				res.json(updatedClient)
	} catch(err) { next(err) }
})

app.get('/prebid', async (req, res, next) => {
	try{
		const bids = await Promise.all([
			rp('https://cookie-sync-partner-2.herokuapp.com/bidding').json(), 
			rp('https://cookie-sync-partner-1.herokuapp.com/bidding').json()
		])

		const partner1Query =  req.headers['x-partner-1-tracking-id'] || req.cookies['partner_1_tracking_id']
		const clientMatch = await Client.findOne({mainframeTrackingID: req.query['mainframe-tracking-id']})

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
		const partner1Query =  req.headers['x-partner-1-tracking-id'] || req.cookies['partner_1_tracking_id']
		const fastBid = await Promise.race([
			rp('https://cookie-sync-partner-1.herokuapp.com/bidding').json(), 
			rp('https://cookie-sync-partner-2.herokuapp.com/bidding').json()]
		)

			if (clientMatch && clientMatch.contentFocus) {
				request(`${fastBid.origin}/partnerAd/${clientMatch.contentFocus}.jpg`).pipe(res)
			} else {
				request(`${fastBid.origin}/partnerAd/Unknown.jpg`).pipe(res)
			}

	} catch(err) { next(err) }
})
```


You can test this system with the following:
	
1) Visit the **Publisher** at http://cookie-sync-publisher.herokuapp.com/
	- The system is not tracking the user. All advertisments are _Unknown.jpg_ (Placeholder Images).
	
2) Visit the **Audience Service** at https://cookie-sync-audience-service.herokuapp.com/
	- The system is tracking the user, but until it has received user input, the system does not know what kind of ad to serve the user
	- The Publisher still sends randomized ads

3) Select a category in the **Audience Service _Menu_**

4) Visit the **Publisher**
	-The advertisments will be re-targeted based on the category sent from **Audience Service**.

5) Refresh the **Publisher**
	-The second and third ads will be different depending on:
	- (#2) Which Partner posted a higher bid.
	- (#3) Which Partner posted a faster bid.