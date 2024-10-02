#serverless for authentication, product and content

#Redis will be from AWS EC2, later ElasticCache

#API Gateway is public facing
Create an Validation rules: rules within that inspect the incoming request's query string, path, headers.
Rule for Specific Path: Create a rule to inspect requests to /token. Check if the request matches the path /token.
Condition to Check Query String: Add a rule that checks if the query string contains the client_id parameter. If the parameter is missing, so it can reject the request by sending a predefined response (400 Bad Request).

#Authentication = auth, type of authentication is ouath2 

#Product and Content = app
API Gateway -> Lambda -> SQS (insert message into sqs), S3 (data uploaded) -> response ID returned as API response
SQS message will be processed on EC2/ECS

#Installation
for app -> npm install mysql2 uuid ioredis
for auth -> npm install jsonwebtoken mysql2 ioredis


#Packaging

