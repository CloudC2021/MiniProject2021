from flask import Flask, jsonify, request, session
from passlib.hash import pbkdf2_sha256
from pymongo import MongoClient
import jwt


class UserMethods():

	def __init__(self):

		self.mongo_url = 'mongodb+srv://cloudgpgprj:QmulCloud00@cluster0.xddkq.mongodb.net/myFirstDatabase?retryWrites=true&w=majority'
		self.db_name = 'userdata'
		self.mongo_db = MongoClient(self.mongo_url)[self.db_name]
		self.secret_key = 'abcdt327bd'	


	def signup(self):

		req_data = request.get_json()

		# Create the user object
		user = {"email": req_data['email'], "password": req_data['password']}

		# Encrypt the password
		user['password'] = pbkdf2_sha256.encrypt(user['password'])

		# Check for existing email address
		if self.mongo_db.users.find_one({ "email": user['email'] }):
			return jsonify({ "error": "Email address already in use" }), 400

		if self.mongo_db.users.insert_one(user):
			print({ "message": "Your Signup is successful." , "user id" : user["email"] })       
			return jsonify({ "message": "Your Signup is successful." , "user id" : user["email"] }), 200

		return jsonify({ "error": "Signup failed" }), 400
  

  
	def login(self):
  
		req_data = request.get_json()

		user = self.mongo_db.users.find_one({"email": req_data['email']})

		if user and pbkdf2_sha256.verify(req_data['password'], user['password']):
			auth_token = jwt.encode({"email": user["email"]}, self.secret_key, algorithm="HS256")
			print({ "message": "Your Login is successful.", "token": auth_token , "email" : user["email"] })
			return jsonify({ "message": "Your Login is successful.", "token": auth_token , "email" : user["email"] }), 200
    
		return jsonify({ "error": "Invalid login credentials" }), 401
        
