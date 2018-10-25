import React, { Component } from 'react';
import { cookieParser } from './utils/cookies.js'
import './App.css';

const uuidv4 = require('uuid/v4')

class App extends Component {
  
  state = { mainframeTrackingID: cookieParser.getItem('x-mainframe-tracking-id') }

  componentDidMount() {
    if (!cookieParser.getItem('x-mainframe-tracking-id')) {
      console.log("no Clientside Cookie")
      const uniqueID = uuidv4();
      cookieParser.setItem('x-mainframe-tracking-id', uniqueID)
    }
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <p>
            Serving Advertisment From Cookie-Sync Mainframe (GOTO Partner 1).
          </p>
          <img src={(this.state.mainframeTrackingID) ? 
            `https://cookie-sync-partner-1.herokuapp.com/adwork?mainframe-tracking-id=${this.state.mainframeTrackingID}` :
            'https://cookie-sync-partner-1.herokuapp.com/adwork'}
            alt="Ad Retarget" 
          />
          <p>
            Volume Bid
          </p>
           <img src={(this.state.mainframeTrackingID) ? 
            `https://cookie-sync-mainframe.herokuapp.com/prebid?mainframe-tracking-id=${this.state.mainframeTrackingID}` :
            'https://cookie-sync-mainframe.herokuapp.com/prebid'} />
          <p>
            Timed Bid
          </p>
          <img src={(this.state.mainframeTrackingID) ? 
            `https://cookie-sync-mainframe.herokuapp.com/timed-prebid?mainframe-tracking-id=${this.state.mainframeTrackingID}` :
            'https://cookie-sync-mainframe.herokuapp.com/timed-prebid'} />
          <a
            className="App-link"
            href="https://reactjs.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn React
          </a>
        </header>
      </div>
    );
  }
}

export default App;
