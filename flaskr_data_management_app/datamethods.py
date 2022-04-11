from flask import Flask, jsonify, request, session
from passlib.hash import pbkdf2_sha256
from pymongo import MongoClient
import jwt


class DataMethods():

	def __init__(self):

		self.mongo_url = 'mongodb+srv://cloudgpgprj:QmulCloud00@cluster0.xddkq.mongodb.net/myFirstDatabase?retryWrites=true&w=majority'
		self.db_name = 'userdata'
		self.mongo_db = MongoClient(self.mongo_url)[self.db_name]
		self.secret_key = 'abcdt327bd'	


        
	def add_enquiry(self):
  
		req_data = request.get_json()
		headers = request.headers
		bearer = headers.get('Authorization')    # Bearer YourTokenHere
		token = None  
		if bearer.split()[0] == "bearer" :
			token = bearer.split()[1]  # YourTokenHere
		else :
			return jsonify({ "error": "Invalid token" }), 401
        
		decoded_token = jwt.decode(token, self.secret_key, algorithms=["HS256"])
		if not decoded_token :
			return jsonify({ "error": "Invalid token" }), 401
         
		user = self.mongo_db.users.find_one({"email": decoded_token["email"]}) 
		if not user:
			return jsonify({ "error": "Invalid token" }), 401
            
		enquiry = {"email": user['email'], "enquiry_id": req_data['enquiry_id'], "enquiry" : req_data['enquiry']}       

		if self.mongo_db.enquiries.find_one({"email": enquiry['email'] , "enquiry_id": req_data['enquiry_id']}):
			return jsonify({ "error": "Enquiry exists" }), 400        
            
		if self.mongo_db.enquiries.insert_one(enquiry):
			print({ "message": "Enquiry created successfully" , "id" : enquiry['enquiry_id'] })
			return jsonify({ "message": "Enquiry created successfully" , "id" : enquiry['enquiry_id'] }), 200            

    
		return jsonify({ "error": "Failed to insert enquiry" }), 400
        
	def get_enquiry(self, enqid):

		headers = request.headers
		bearer = headers.get('Authorization')    # Bearer YourTokenHere
		token = None  
		if bearer.split()[0] == "bearer" :
			token = bearer.split()[1]  # YourTokenHere
		else :
			return jsonify({ "error": "Invalid token" }), 401
            
		decoded_token = jwt.decode(token, self.secret_key, algorithms=["HS256"])
		if not decoded_token :
			return jsonify({ "error": "Invalid token" }), 401
         
		user = self.mongo_db.users.find_one({"email": decoded_token["email"]}) 
		if not user:
			return jsonify({ "error": "Invalid token" }), 401

		enquiry_found = None 
		enquiry_found = self.mongo_db.enquiries.find_one({"email": user['email'] , "enquiry_id": enqid})        
		if enquiry_found:
			print({ "message": "Your Enquiry was found and it mentions "+enquiry_found["enquiry"] })
			return jsonify({ "message": "Your Enquiry was found and it mentions "+enquiry_found["enquiry"] }), 200  

		return jsonify({ "error": "Enquiry Not Found" }), 404 
        
        
	def update_enquiry(self, enqid):
    
		req_data = request.get_json()

		headers = request.headers
		bearer = headers.get('Authorization')    # Bearer YourTokenHere
		token = None  
		if bearer.split()[0] == "bearer" :
			token = bearer.split()[1]  # YourTokenHere
		else :
			return jsonify({ "error": "Invalid token" }), 401
            
		print(req_data)
            
		decoded_token = jwt.decode(token, self.secret_key, algorithms=["HS256"])

		if not decoded_token :
			return jsonify({ "error": "Invalid token" }), 401
          
		user = self.mongo_db.users.find_one({"email": decoded_token["email"]}) 
		if not user:
			return jsonify({ "error": "Invalid token" }), 401

		my_query = {"email": user['email'] , "enquiry_id": enqid} 
		new_val = {"$set": { "enquiry": req_data['enquiry'] }} 
		        
		if self.mongo_db.enquiries.update_one(my_query, new_val):
			print({ "message": "Enquiry Updated successfully" })
			return jsonify({ "message": "Enquiry Updated successfully" }), 200  

		return jsonify({ "error": "Enquiry Update Failed" }), 400
        
        
	def delete_enquiry(self, enqid):
    
		headers = request.headers
		bearer = headers.get('Authorization')    # Bearer YourTokenHere
		token = None  
		if bearer.split()[0] == "bearer" :
			token = bearer.split()[1]  # YourTokenHere
		else :
			return jsonify({ "error": "Invalid token" }), 401
                        
		decoded_token = jwt.decode(token, self.secret_key, algorithms=["HS256"])

		if not decoded_token :
			return jsonify({ "error": "Invalid token" }), 401
         
		user = self.mongo_db.users.find_one({"email": decoded_token["email"]}) 
		if not user:
			return jsonify({ "error": "Invalid token" }), 401

		my_query = {"email": user['email'] , "enquiry_id": enqid} 

		        
		if self.mongo_db.enquiries.delete_one(my_query):
			print({ "message": "Enquiry deleted successfully" })
			return jsonify({ "message": "Enquiry deleted successfully" }), 200  

		return jsonify({ "error": "Enquiry deletion failed" }), 400

        

    
        
        