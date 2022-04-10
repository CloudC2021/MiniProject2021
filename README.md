# University Chat-Bot
This a chat bot that can be used from any University in their main website to guide visitors.

<h2>About</h2>

Voice and textual information play an essential role in communication between people. According to an article published in The New York Times, adults spend more than eight hours a day front of a computer or mobile phone screen. Some of the primary sources of communication are web applications such as WhatsApp, Facebook, Twitter etc., as a form of speech and textual conversation. 
Chatbots are computer programs that simulate human conversations via voice commands and/or text chat. Chatbots are changing several roles that might be historically accomplished via human workers, including online customer support dealers and educators and many more. Today, around 1.4 billion people use a chatbot, and 27% of these consumers are interested in artificial intelligence support tools.

Most university website are complicated and that make it difficult to navigated though them. 
This is a chat bot that can be used from any University in their main website to guide visitors. It can be used to answer questions, guide them to available programs and show the entry requirements. All of that in the form of a friendly conversation. It will not replace websites, but it will be use along side of them to offer more user-friendly option. 

<h2>System Architect</h2>

![image](https://user-images.githubusercontent.com/103259172/162576570-cd8caca9-ad97-4ad7-bdb4-4128d174f1e5.png)

The front-end is consist of the main website (in our example is empty but that is where the university website is supposed to be) and the chat bot in the bottom right of the side. The user can interact with the chat bot ether by writing questions in the chat or by vocally asking. The chat bot both displayed the answers in the place of the chat and by voice. 
The backend is a REST-based service interface for CRUD operations. Those operations are consisting of user sing up and log in and data query of university information’s and is also using Google Dialog Flow, Google STT and Google TTS external APIs for voice speech and voice recognition. The Chat-bot is deployed though Google Cloud PLatform and user's sensitive information (here we only colelct the password) is hashed and then stored in cloud MongoDB, a NoSQL cloud persistent database. 


<h2>How the code works (Flask Data management App - Sing Up Login & Update User Queries)</h2>

The app is split to the user Sing Up & Log in and the data emthods such as store, update and delete user queries for a particular user account. First, in the usermethods.py & datamethods.py we connect with MongoDB to store and retreive our user information as well as the enquiry data.

<h3>Usermethods.py</h3>
We are using a sing up function to let new users’ login in our site. Inside the sing up function we request email and password from the user, we encrypted the password using pbkdf2_sha256 hashing algorithm and we save those values in our database. In the case that the email that the user gave already exist we return the 400 code and print error "Email address already in use". 
Going now onwards in the login function we are searching though the database using the email that the user gave us. If the email exist in our database and the hashed value of the password matches the value we have in our database we create an authorized token and allow access to the user, else we return 201 and print “Invalid login credentials”. 

<h3>Datamethonds.py</h3>
Inside data methods we give the option to the user to add an enquire (in case the chat bot does not have the answer for someone to answer it physically). We created four functions for that purpose- add, get, update, delete). In every function we first check if the user is logged in to the system by using the authorization token that we already created and received back in the usermethods.py file during log in. Then is the add_enquire function we get the enquire from the user, we check the user have ask again the same enquire, if not the enquire store in the mongoDB database for review, and we also create an enquire id. The get_enquiry function is used in case a user want to see an enquiry that he already submitted. We ask the enquire id from the user and by using the id and the email of the user (that we took from the authentication token) check in the enquiries collection of our database and if the enquiry exist in our database we print it for the user to see. After that we ask the user if he want to update or delete his enquiry. If he wants to update his enquire we ask for the new enquiry and update it in our database under the same id, else we delete the enquiry from our database. 

<h3>App.py</h3>
The app.py is using RESTful methodology to Post, Put, Get and Delete the enquiries of the user. The app.py is calling the functions from the previous two files and routes the data in the appropriate destination.  

<h2>How the code works (Nature Voice Chat-Bot)</h2>

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
  
Before we run the code we first have to install all the dependencies. For that we run npm.

	npm install
	
We navigate to the folder where app.js is and we run the app. We are using nohub to run the app to run on background even if we close our terminal. 
  
	nohub node app.js >/dev/null 2>&1 &
  
Our app is now running. We can see it using the external IP and the port we gave to it (in our case is port 3002).
If we want to kill our operation, we first must find its id.
  
	sudo netstat -lntp | grep 3002
	kill -9 <id>
#Steps to Setup SSL on Google Cloud Platform load balancer
 
Create a website: www.c1.ccweb.uk using GCP by creating an instance in VM engine.
	
Create an instance in server software ubuntu, in the us-west-4a region with the auto generated external IP we can interact with our chatbot 34.125.212.179
Create an unmanaged instance group named bot-instance group link the created website to it.
	
Set up the HTTPS load balancer named ssl-bot-backend, ssl-bot-frontend, ssl-bot-service.
	
Ssl-bot-backend-services point it to the VM engine, create a backend service http: 80 port, Instance Group: ssl-bot-instance group, 
![WhatsApp Image 2022-04-09 at 4 05 54 PM](https://user-images.githubusercontent.com/103321549/162586447-b0fdfe96-7481-4d0b-b72e-f9b9afbb8b9f.jpeg)
![WhatsApp Image 2022-04-09 at 4 05 55 PM](https://user-images.githubusercontent.com/103321549/162586452-524372b3-6008-4f5e-b5b5-0b6d166bd48f.jpeg)
![WhatsApp Image 2022-04-09 at 4 06 04 PM](https://user-images.githubusercontent.com/103321549/162586457-7f5008a3-4e53-457b-88db-8ac0fb43163c.jpeg)
![WhatsApp Image 2022-04-09 at 4 06 01 PM](https://user-images.githubusercontent.com/103321549/162586468-4128df83-80fb-40ed-96b2-0fa67d31ac07.jpeg)

Set up a health-criteria: Check interval: 10, Timeout: 5,Healthy threshold: 2, Unhealthy threshold: 3The health check makes a curl request every 5 to 8 seconds to the external IP. If the curl runs into a 404, then the load balancer will flag it as unhealthy.
	
Host Rules and Path: Create ssl frontend configuration using Https Protocol, IP Address, IP Port
 
Create an SSL- Certificate as google managed, with the domain name: www.c1.ccweb.uk

 
The public request is set up for HTTPS: port 443 in the load balancer.
	
Cloud DNS create a zone, proxy the request to our load balancer using the public IP address, create an A record as an alias name TTL,TTL limit which is in turn sent to the VM.
	
Run $dig website url
	
Update the DNS
	
Check IP for activation status
	
Check if the website has a lock icon on the URL which indicates a successful SSL set-up.
