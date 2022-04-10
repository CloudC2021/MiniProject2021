# University Chat-Bot
This a chat bot that can be used from any University in their main website to guide visitors.

<h2>About</h2>

Voice and textual information play an essential role in communication between people. According to an article published in The New York Times, adults spend more than eight hours a day front of a computer or mobile phone screen. Some of the primary sources of communication are web applications such as WhatsApp, Facebook, Twitter etc., as a form of speech and textual conversation. 
Chatbots are computer programs that simulate human conversations via voice commands and/or text chat. Chatbots are changing several roles that might be historically accomplished via human workers, including online customer support dealers and educators and many more. Today, around 1.4 billion people use a chatbot, and 27% of these consumers are interested in artificial intelligence support tools.

Most university website are complicated and that make it difficult to navigated though them. 
This is a chat bot that can be used from any University in their main website to guide visitors. It can be used to answer questions, guide them to available programs and show the entry requirements. All of that in the form of a friendly conversation. It will not replace websites, but it will be use along side of them to offer more user-friendly option. 

<h2>System Architecture</h2>

<p>&nbsp;</p>
<kbd>
<img src="https://user-images.githubusercontent.com/48182913/162636159-72f56775-d843-4fc8-9b12-1a66210026d6.jpg"  width="1000" ></kbd>
<p>&nbsp;</p>


The front-end is consist of the main website (in our example is empty but that is where the university website is supposed to be) and the chat bot in the bottom right of the side. The user can interact with the chat bot ether by writing questions in the chat or by vocally asking. The chat bot both displayed the answers in the place of the chat and by voice. 
The backend is a REST-based service interface for CRUD operations. Those operations are consisting of user sing up and log in and data query of university information’s and is also using Google Dialog Flow, Google STT and Google TTS external APIs for voice speech and voice recognition. The Chat-bot is deployed though Google Cloud PLatform and user's sensitive information (here we only colelct the password) is hashed and then stored in cloud MongoDB, a NoSQL cloud persistent database. 


<h2>How the code works (Flask Data management App - Sign Up, Login & Update User Queries)</h2>

The app is split to the user Sing Up & Log in and the data emthods such as store, update and delete user queries for a particular user account. First, in the usermethods.py & datamethods.py we connect with MongoDB to store and retreive our user information as well as the enquiry data.

<h3>Usermethods.py</h3>
We are using a sing up function to let new users’ login in our site. Inside the sing up function we request email and password from the user, we encrypted the password using pbkdf2_sha256 hashing algorithm and we save those values in our database. In the case that the email that the user gave already exist we return the 400 code and print error "Email address already in use". 
Going now onwards in the login function we are searching though the database using the email that the user gave us. If the email exist in our database and the hashed value of the password matches the value we have in our database we create an authorized token and allow access to the user, else we return 201 and print “Invalid login credentials”. 

<h3>Datamethonds.py</h3>
Inside data methods we give the option to the user to add an enquire (in case the chat bot does not have the answer for someone to answer it physically). We created four functions for that purpose- add, get, update, delete). In every function we first check if the user is logged in to the system by using the authorization token that we already created and received back in the usermethods.py file during log in. Then is the add_enquire function we get the enquire from the user, we check the user have ask again the same enquire, if not the enquire store in the mongoDB database for review, and we also create an enquire id. The get_enquiry function is used in case a user want to see an enquiry that he already submitted. We ask the enquire id from the user and by using the id and the email of the user (that we took from the authentication token) check in the enquiries collection of our database and if the enquiry exist in our database we print it for the user to see. After that we ask the user if he want to update or delete his enquiry. If he wants to update his enquire we ask for the new enquiry and update it in our database under the same id, else we delete the enquiry from our database. 

<h3>App.py</h3>
The app.py is using RESTful methodology to Post, Put, Get and Delete the enquiries of the user. The app.py is calling the functions from the previous two files and routes the data in the appropriate destination.  

<h2>How the code works (Natural Voice Chat-Bot)</h2>

<h3>APIs</h3>

<h3>Google Dialog Flow</h3>
“Dialogflow is a natural language understanding platform that makes it easy to design and integrate a conversational user interface into your mobile app, web application, device, bot, interactive voice response system, and so on.” (https://cloud.google.com/dialogflow)
<h3>Google STT</h3>
Google STT is a speech-to-text API design to convert speech into text using Google’s AI technology.
<h3>Google TTS</h3>
Google STT is a Text-to-Speech API design to convert text into natural-sounding speech using Google’s AI technology

<h3>Main App (app.js)</h3>
In the main app we first pass all the public libraries and Google’s APIs. In the public libraries we have used a front-end template for our UI, sounds, a css template to align our feature properly socket.IO library. Socket.Io is a library that enables real-time, bidirectional, and event-based communication between the browser and the server. It consists of a Node. js server: Source | API.
After passing all relevant libraries we use routing to set how the application responds to a client request, we use res.render(‘index) to send the rendered view to the client. Finally, we use socket.io to connect server with client and initiate our chat-bot. Then we created 4 functions based on 4 different scenarios, if that’s the first time the user interacts with the bot, one to start recognition stream, one to stop recognition stream and a final for generating voice. 

Then, once session is initiated a connection is established with the Google DialogFlow engine authenticating the credentials of the token we have obatained to connect with our trained chatbot in DialogFlow. Nex, once the conversation is started, if the input is in voice, it will be translated to text using google Speech To Text(STT) apis and using talkToBotText method we send the input text to our DialogFlow chat bot and once the output is received and if the voice is enables the text output will be again translated to voice using google Text To Speech(TTS) apis before giving the output to the user.

<h2>Google Dialog Flow</h2>

<h3>Training the Chat Bot</h3>

In Google DialogFlow, we create intents to recognize the user's intention while interacting with the bot and to do so we use example training data to train the machine learning algorithm which the DialogFlow incorporates in it's intent detection. Here we creates main intents to find if the user is an existing user or a new one and then sign the person up or make the person login to the system to obtain the authorization token and then create a new enquiry or else to update or delete existing enquiries related to the user's account authenticating the user with the recieved auth token.

<h3>Sending and receiving the user and enquiry data with the flask data management app from DialogFlow</h3>

For this purpose we make use of the webhook fulfillment functionality of the Google DialogFlow where we can write a javascript backend code to send and receive data using REST API. Here we have written javascript axios library methods to send and receive data from our flask data management app to signup user, login to get the auth token and do modifications with the user query storage.

<h2>Deployment of the chatbot back end node app</h2>

First, we login to our GCP account. 

From Computer Engine->VM Instances we create a virtual machine instance. 

We use SSH to connect to our instance using our terminal. 

Then we install the nvm (node version manager) to install node js to our instance. To install nvm though a linux terminal we first install curl.

    sudo apt install curl
    curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash
  
Then we close and reopen the terminal. After that we run nvm -v to check that nvm is install probably.

	nvm -v
  
Then we use nvm to install node.js.

	nvm install 12.18.3 
  
By indicating 12.18.3 it will install 12.18.3 version of node.js. Any version over 10.00.0 could work, anything below that could not work with Google’s APIs. 
To run then app on the GCP we zip and upload all the files on our vm instance. Then we must unzip them.

	sudo apt install unzip
  	unzip <name>.zip
  
Before we run the code we first have to install all the dependencies. For that we navigate to the folder where app.js is and then we run npm.

	npm install
	
Afterwards, we navigate to the folder where app.js is and we run the app. We are using nohup to run the app to run on background in the port 3002 even if we close our terminal. 
  
	nohup node app.js >/dev/null 2>&1 &
  
Our app is now running. We can see it using the external IP and the port we gave to it (in our case is port 3002).
If we want to kill our operation, we first must find its id.
  
	sudo netstat -lntp | grep 3002
	kill -9 <id>
	
<h2>Deployment of the Flask Data management app</h2>

First, we login to our GCP account. 

From Computer Engine->VM Instances we create a virtual machine instance. 

We use SSH to connect to our instance using our terminal. 

Then we install anaconda python to have the python base.
  
Then we restart the terminal and change into the flask datamanagement app folder and install the requred python libraries from the requirements.txt file.

	pip install -r ./requirements.txt
  
Then we will run our app.py in the background to launch the app in the port 5001.

	nohup python app.py >/dev/null 2>&1 &
	
Our app is now running. We can see it using the external IP and the port we gave to it (in our case is port 5001).
If we want to kill our operation, we first must find its id.
  
	ps -ef | grep python
	kill -9 <id>
	
<h2>Steps to setup SSL on Google Cloud Platform load balancer</h2>

First we have to obtain a domain from a domain name registrar.

Then we have to create two unmanaged instance groups for the 2 instances on GCP running the chatbot backend node app and the flask datamanagement app to map them to static urls with respective ports of 3002 and 5001.
	
Next we have to set up 2 HTTPS load balancers installing 2 different SSL certificates with dedicated static public ips(mapped to domain urls) pointing to the 2 managed instance groups.

Finally we have to update the DNS settings of our domain to map the 2 static public https ips to the mapped urls.  .

<h2>Our Example Deployment</h2>

First we obtained a domain called ccweb.uk for our deployment.

Then to showcase HTTPS as an example, we obtained a SSL Certificate from Google managed SSL Certs

<p>&nbsp;</p>
<kbd>
<img src="https://user-images.githubusercontent.com/14356479/162636365-059c73ac-586a-4d11-a966-9151d91fd153.jpg"  width="380" ></kbd>
<p>&nbsp;</p>

Then we mapped that SSL certificate to deploy our application in a public https url https://chat1.ccweb.uk/ .

<p>&nbsp;</p>
<kbd>
<img src="https://user-images.githubusercontent.com/14356479/162638410-a7605351-15ba-4970-a072-9c58d8436e08.jpg"  width="1000" ></kbd>
<p>&nbsp;</p>
