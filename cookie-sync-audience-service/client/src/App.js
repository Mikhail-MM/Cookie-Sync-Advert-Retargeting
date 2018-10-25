import React, { Component } from 'react';
import { cookieParser } from './utils/cookies.js'
import logo from './logo.svg';
import './App.css';


class App extends Component {
  
  findActiveInterestFromCookies = () => {
    console.log("Logging Nonexistence")
    console.log(cookieParser.getItem('ITDONTEXIST'))
    return cookieParser.getItem('contentFocus')
  }

  findActiveUserFromCookies = () => {
    return cookieParser.getItem('audience_tracking_id')
  }
  
  state = {
   	interestArray: ['Cooking', 'Cars', 'Stylish Clothing', 'Weddings'],
   	activeInterest: this.findActiveInterestFromCookies(),
    activeClient: this.findActiveUserFromCookies(),
  }


  generateInterestColumn = () => {
    if (this.state.activeInterest === null) {
      return "Loading..."
    } else if (this.state.activeInterest === undefined) {
      return "An interest profile has not been generated for this client yet"
    } else if (this.state.activeInterest) {
      return `This client is interested in ${this.state.activeInterest}` 
    }
  }
  
  updateClientPreferences = (interest) => {
    cookieParser.setItem('contentFocus', interest)
    this.setState({
      activeInterest: interest
    })
  }

  renderInteractionMenu = () => {
    return this.state.interestArray.map(interest => {
    	return (
	      <div onClick={() => this.updateClientPreferences(interest)} className={`interest-window${(this.state.activeInterest === interest) ? ' active-interest' : ''}`}>
	      	<img className='interest-image' src={`/${interest}.jpg`} />
	      </div>
      	)
    })
  }

  render() {
    const { activeInterest, activeClient } = this.state
    return (
      <div className="App">
        <header className="App-header">
          <p>
            {this.generateInterestColumn()}
          </p>
          <div className='responsive-flex'>
            {this.renderInteractionMenu()}
          </div>
          <img src={(activeClient && activeInterest) ? 
            `https://cookie-sync-partner-1.herokuapp.com/track?audience_tracking_id=${activeClient}&contentFocus=${activeInterest}` 
              : (activeClient && !activeInterest) ?
            `https://cookie-sync-partner-1.herokuapp.com/track?audience_tracking_id=${activeClient}` 
              : null
            } style={{height: 1, width: 1}}/>
        </header>
      </div>
    );
  }
}

export default App;
