from flask import Flask, request, session, redirect
from datamethods import DataMethods
from usermethods import UserMethods

obj_user_methods = UserMethods()
obj_data_methods = DataMethods()

app = Flask(__name__)



@app.route('/login', methods=['POST'])
def login():

	return obj_user_methods.login()


@app.route('/signup', methods=['POST'])
def signup():

	return obj_user_methods.signup()
    
@app.route('/add_enquiry', methods=['POST'])
def add_enquiry():

	return obj_data_methods.add_enquiry()
    
@app.route('/get_enquiry/<enqid>', methods=['GET'])
def get_enquiry(enqid):

	return obj_data_methods.get_enquiry(enqid)
    
@app.route('/update_enquiry/<enqid>', methods=['PUT'])
def update_enquiry(enqid):

	return obj_data_methods.update_enquiry(enqid)
    
@app.route('/delete_enquiry/<enqid>', methods=['DELETE'])
def delete_enquiry(enqid):

	return obj_data_methods.delete_enquiry(enqid)
    
    
   

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5001, debug=False)
    