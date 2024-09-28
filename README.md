#serverless for authentication, product and content

#Redis will be from AWS ElasticCache

#ALB is public facing
Create an ALB Listener Rule: rules within the listener that inspect the incoming request's query string, path, headers.
Rule for Specific Path: Create a rule to inspect requests to /token. The ALB will check if the request matches the path /token.
Condition to Check Query String: Add a rule that checks if the query string contains the client_id parameter. If the parameter is missing, the ALB can reject the request by sending a predefined response (400 Bad Request).

#Authentication = ouath2 

#Product and Content = app
ALB -> Lambda -> SQS (insert message into sqs), S3 (data uploaded) -> response ID returned as API response
SQS message will be processed on EC2/ECS

#Installation first time
npm install mysql2
npm install uuid
npm install ioredis


#Packaging

