// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
'use strict';
 
const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Card, Suggestion} = require('dialogflow-fulfillment');
const axios = require('axios');
const moment = require('moment-timezone');
 
process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements
 
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({ request, response });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));
 
  function welcome(agent) {
    agent.add(`Welcome to my agent!`);
  }
 
  function fallback(agent) {
    agent.add(`I didn't understand`);
    agent.add(`I'm sorry, can you try again?`);
  }
  
  
  
 function preserveContext(agent){
    agent.contexts.forEach(function(selectedContext){
        if(!selectedContext.lifespan) { selectedContext.lifespan = 0;}
        agent.context.set({name: selectedContext.name, lifespan: selectedContext.lifespan+1});
        
    });
   	agent.end("");
   
  }

 

  // // Uncomment and edit to make your own intent handler
  // // uncomment `intentMap.set('your intent name here', yourFunctionHandler);`
  // // below to get this function to be run when a Dialogflow intent is matched
  // function yourFunctionHandler(agent) {
  //   agent.add(`This message is from Dialogflow's Cloud Functions for Firebase editor!`);
  //   agent.add(new Card({
  //       title: `Title: this is a card title`,
  //       imageUrl: 'https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png',
  //       text: `This is the body text of a card.  You can even use line\n  breaks and emoji! 💁`,
  //       buttonText: 'This is a button',
  //       buttonUrl: 'https://assistant.google.com/'
  //     })
  //   );
  //   agent.add(new Suggestion(`Quick Reply`));
  //   agent.add(new Suggestion(`Suggestion`));
  //   agent.setContext({ name: 'weather', lifespan: 2, parameters: { city: 'Rome' }});
  // }

  // // Uncomment and edit to make your own Google Assistant intent handler
  // // uncomment `intentMap.set('your intent name here', googleAssistantHandler);`
  // // below to get this function to be run when a Dialogflow intent is matched
  // function googleAssistantHandler(agent) {
  //   let conv = agent.conv(); // Get Actions on Google library conv instance
  //   conv.ask('Hello from the Actions on Google client library!') // Use Actions on Google library
  //   agent.add(conv); // Add Actions on Google library responses to your agent's response
  // }
  // // See https://github.com/dialogflow/fulfillment-actions-library-nodejs
  // // for a complete Dialogflow fulfillment library Actions on Google client library v2 integration sample

  
  function sleep(millis){
  	return new Promise( resolve => setTimeout(resolve, millis));
  } 
  
  function timeoutFunc(agent){
   	//get current date
  	//var currentTime = new Date().getTime(); 
    
    return sleep("5000").then( test_trans => {  agent.setFollowupEvent("timeout_1"); });
    
    //setTimeout(function(){ agent.setFollowupEvent("timeout_1"); }, 5000);
    
    
  }
  
  function signUp(agent) {
    
    const DATA_API = 'https://flaskapp.ccweb.uk/signup';
    const {emailId, pssWrd} = agent.parameters;
    console.log(emailId);
    
    if(true){
      
      const bodyParameters = {
   		"email":emailId,
		"password":pssWrd
	  };
      
      let time_out = false;
      setTimeout(() => {time_out = true;},5000);
      
      return axios.post(DATA_API,bodyParameters).then(data_response => {

      
      if(!time_out ){

          const response_str = data_response.data.message;
          const str_2 = "<meta command=\"INPUT_TEXT_ONLY\"/>" ;
            
            console.log(response_str);
          	agent.add(response_str);
			agent.add("Now, please enter your email to login");
        	agent.setContext({name: 'get_username', lifespan:1});
        	agent.add(str_2);
            
            
         
          
        }}).catch(error => console.log(error));
      
    }

    //agent.end("");
    
  }
  
  
    function logIn(agent) {
    
    const DATA_API = 'https://flaskapp.ccweb.uk/login';
    const {emailId, pssWrd} = agent.parameters;
    console.log(emailId);
    
    if(true){
      
      
      const bodyParameters = {
   		"email":emailId,
		"password":pssWrd
	  };
      
      let time_out = false;
      setTimeout(() => {time_out = true;},5000);
      
      return axios.post(DATA_API,bodyParameters).then(data_response => {

      
      if(!time_out ){

          const response_str = data_response.data.message;
          const br_token = data_response.data.token;
          
            
            console.log(response_str);
          	agent.add(response_str);
            agent.setContext({name: 'login_success', lifespan:1, parameters: { brToken: br_token }});
            
          
          	agent.add("Do you have an existing enquiry ? Or do you want to make a new enquiry ?");
          
        }}).catch(error => console.log(error));
      
    }

    //agent.end("");
    
  }
  
  function postEnq(agent) {
    
    const DATA_API = 'https://flaskapp.ccweb.uk/add_enquiry';
    const {enQuiry, brToken} = agent.parameters;
    console.log(enQuiry);
    const sessionId = agent.session.toString().split("/").pop().toString();
    console.log(sessionId);
    
    if(true){
      
      const brr_token = "bearer "+brToken;
      const config = {
    	headers: { Authorization: brr_token }
	  };
      const bodyParameters = {
   		"enquiry_id":sessionId,
		"enquiry":enQuiry
	  };
      
      let time_out = false;
      setTimeout(() => {time_out = true;},5000);
      
      return axios.post(DATA_API,bodyParameters,config).then(data_response => {

      
      if(!time_out ){

          const response_str = data_response.data.message;
          const enq_id = data_response.data.id;
          
            
            console.log(response_str);
          	agent.add(response_str);
        	const resp_2 = "Your enquiery id is "+enq_id.toString();
        	agent.add(resp_2);
        	agent.add("Have a nice day");
        	agent.add("<meta command=\"END\"/>");
            
            //return agent;
          	//return agent.end("");
          
        }}).catch(error => console.log(error));
      
    }

    //agent.end("");
    
  }
  
  function getEnq(agent) {
    
    const DATA_API = 'https://flaskapp.ccweb.uk/get_enquiry/';
    const {enQuiryId, brToken} = agent.parameters;
    console.log(enQuiryId);
    const DATA_GET_PATH =  DATA_API + enQuiryId.toString();   
    if(true){
      
      const brr_token = "bearer "+brToken;
      const config = {
    	headers: { Authorization: brr_token }
	  };
      
      
      let time_out = false;
      setTimeout(() => {time_out = true;},5000);
      
      return axios.get(DATA_GET_PATH,config).then(data_response => {

      
      if(!time_out ){

          const response_str = data_response.data.message;
          
            
            console.log(response_str);
        	agent.add(response_str);
          	agent.add("Please tell me if you want to update your enquiry ? or delete your enquiry ?");
        	
        	
            agent.setContext({name: 'enq_status_change', lifespan:1, parameters: { enQuiryId: enQuiryId, brToken: brToken }});
            
          
          
            //return agent;
          	//return agent.end("");
          
        }}).catch(error => console.log(error));
      
    }

    //agent.end("");
    
  }
  
  function updateEnq(agent) {
    
    const DATA_API = 'https://flaskapp.ccweb.uk/update_enquiry/';
    const {enQuiryId, brToken, newEnq} = agent.parameters;
    console.log(enQuiryId);
    const DATA_UPDATE_PATH =  DATA_API + enQuiryId.toString();  
    const bodyParameters = {
		"enquiry":newEnq
	  };
    
    if(true){
      
      const brr_token = "bearer "+brToken;
      const config = {
    	headers: { Authorization: brr_token }
	  };
      
      
      let time_out = false;
      setTimeout(() => {time_out = true;},5000);
      
      return axios.put(DATA_UPDATE_PATH,bodyParameters,config).then(data_response => {

      
      if(!time_out ){

          const response_str = data_response.data.message;
          
            agent.add(response_str);
            console.log(response_str);
          	agent.add("Have a nice day");
        	agent.add("<meta command=\"END\"/>");
  
          
            //return agent;
          	//return agent.end("");
          
        }}).catch(error => console.log(error));
      
    }

    agent.end("");
    
  }
  
  function deleteEnq(agent) {
    
    const DATA_API = 'https://flaskapp.ccweb.uk/delete_enquiry/';
    const {enQuiryId, brToken} = agent.parameters;
    console.log(enQuiryId);
    const DATA_DELETE_PATH =  DATA_API + enQuiryId.toString();  
    
    
    if(true){
      
      const brr_token = "bearer "+brToken;
      const config = {
    	headers: { Authorization: brr_token }
	  };
      
      
      let time_out = false;
      setTimeout(() => {time_out = true;},5000);
      
      return axios.delete(DATA_DELETE_PATH,config).then(data_response => {

      
      if(!time_out ){

          const response_str = data_response.data.message;
          
            agent.add(response_str);
            console.log(response_str);
          	agent.add("Have a nice day");
        	agent.add("<meta command=\"END\"/>");
  
          
            //return agent;
          	//return agent.end("");
          
        }}).catch(error => console.log(error));
      
    }

    agent.end("");
    
  }
  
  
  
  // Run the proper function handler based on the matched Dialogflow intent name
  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', preserveContext);
  // intentMap.set('your intent name here', yourFunctionHandler);
  // intentMap.set('your intent name here', googleAssistantHandler);
  
  // For small talk, we need to preserve context
  intentMap.set('Small Talk: Welcome',preserveContext);
  intentMap.set('Small Talk: Welcome I am Fine',preserveContext);
  intentMap.set('Small Talk: Happy',preserveContext);
  intentMap.set('Small Talk: How Are You',preserveContext);
  intentMap.set('Small Talk: Insult',preserveContext);
  intentMap.set('Small Talk: Sad',preserveContext);
  intentMap.set('Small Talk: Who Build You',preserveContext);
  intentMap.set('Small Talk: Joke',preserveContext);  
  intentMap.set('Small Talk: Weather',preserveContext);
   intentMap.set('Small Talk: Move to Next Question',preserveContext);
  intentMap.set('Small Talk: I Dont Know',preserveContext);
  intentMap.set('Small Talk: Who Are You',preserveContext);
  intentMap.set('Small Talk: Joke Another',preserveContext);
  intentMap.set('Small Talk: Joke Funny Ack',preserveContext);
  intentMap.set('Small Talk: Joke Not Funny Ack',preserveContext);
  intentMap.set('Small Talk: Thank You',preserveContext);
  intentMap.set('Small Talk: Let Me Ask You a Question',preserveContext);
  intentMap.set('Small Talk: Being Funny',preserveContext);
  intentMap.set('Small Talk: Give Me a Minute',preserveContext);
  intentMap.set('Small Talk: More Options',preserveContext);
  
  
  intentMap.set('FAQ: English Requirement',preserveContext);
  intentMap.set('FAQ: Tution Fees',preserveContext);
  intentMap.set('FAQ: Financial Aid',preserveContext);
  intentMap.set('FAQ: Credit Transfer',preserveContext);
  intentMap.set('FAQ: Academic Year',preserveContext);
  intentMap.set('FAQ: Course List',preserveContext);
  intentMap.set('FAQ: Distance Learning',preserveContext);
  intentMap.set('FAQ: Professional Development',preserveContext);
  intentMap.set('FAQ: Alumni and Friends',preserveContext); 
  intentMap.set('FAQ: International Students',preserveContext);
  
  intentMap.set('5_En_Delete',deleteEnq);
  intentMap.set('6_En_Update_Up',updateEnq);
  intentMap.set('4_Create_Eq',postEnq);
  intentMap.set('4_Get_Eq_Yes',getEnq);
  intentMap.set('2_Get_Password_New',signUp);
  intentMap.set('2_Get_Password',logIn);
  agent.handleRequest(intentMap);
});
