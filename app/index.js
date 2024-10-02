const Redis = require('ioredis');
const mysql = require('mysql2/promise');
const AWS = require('aws-sdk');
const S3 = new AWS.S3();
const SQS = new AWS.SQS();
const { v1: uuidv1 } = require('uuid');

let connection;
const connectToDatabase = async () => {
    if (!connection) {
        connection = await mysql.createConnection({
            host: 'your-database-host',
            user: 'your-database-user',
            password: 'your-database-password',
            database: 'your-database-name'
        });
    }
    return connection;
};

// Create the Redis connection outside the handler
const redis = new Redis({
    host: 'your-redis-endpoint', // e.g., "my-redis-cluster.abc123.def456.0001.usw2.cache.amazonaws.com"
    port: 6379, // Default Redis port
    password: 'your-redis-password', // If applicable
    // Uncomment if you're using TLS
    // tls: {} 
});


exports.handler = async (event) => {
    const authHeader = event.headers && event.headers.Authorization; // Assuming the token is passed in the Authorization header
    /*
    Implment as API Gateway validation rule
    if (!authHeader) {
        return {
            statusCode: 401,
            body: JSON.stringify({ message: 'Authorization is missing' }),
        };
    }
    */

    // Extract Bearer token (if Bearer token is used)
    const tokenParts = authHeader.split(' ')[1]; // Assuming format is "Bearer <token>"
    if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: "Invalid authorization header format. Expected 'Bearer <token>'." }),
        };
    }

    // Retrieve orgId from custom header
    const orgId = event.headers && event.headers.orgId;
    /**
     * Implement check for orgId as API Gateway validation rule
     */

    const jobId = event.pathParameters ? event.pathParameters.jobid : null;
    if (jobId && event.httpMethod !== 'GET') {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'Invalid request: jobId should only be provided for GET requests.',
            }),
        };
    }

    // If jobId is not present, it must be a POST request
    if (!jobId && event.httpMethod !== 'POST') {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'Invalid request: POST request is required if jobId is not provided.',
            }),
        };
    }

    const path = event.path; // Get the full request path
    let type = '';
    if (path.includes('content')) {
        type = 'content';
    } else if (path.includes('product')) {
        type = 'product';
    }
    /*
    * Implement as ALB listener rule 
    else {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Invalid path: must contain either "content" or "product".' })
        };
    }
    */

    const accessToken = tokenParts[1];
    // Read a key from Redis
    const key = orgId+':tok';
    const redisToken = await redis.get(key);
    if (redisToken === null || redisToken != accessToken) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Invalid token' })
        };
    }

    if (jobId) {
        const db = await connectToDatabase();
        const [rows] = await db.query("SELECT t.name FROM tenant t left join client c on t.id=c.tenant_id where c.organization_id='"+orgId+"'");
        if (rows.length > 0) {
            const tenantdbName = "xcl_" + rows[0].name;
            const [rowsD] = await db.query("SELECT process_state FROM "+tenantdbName+"."+type+" where job_id='"+jobID+"' limit 1");
            if (rowsD.length > 0) {
                return {
                    statusCode: 200,
                    body: JSON.stringify({ status: rowsD[0].process_state })
                };
            } else {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ message: 'Invalid JobID' })
                };
            }
        } else {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Invalid Organization' })
            };
        }
    } else {
        const body = JSON.parse(event.body);
        const jobId = uuidv1(); // Generate a job ID
        // Upload the JSON data to S3
        const s3Params = {
            Bucket: process.env.BUCKET_NAME, // Your S3 bucket name , configure as Lamda Environment Variables
            Key: `data/${jobId}_${type}.json`, // Unique key for the file
            Body: JSON.stringify(body),
            ContentType: 'application/json'
        };
        const s3Response = await S3.putObject(s3Params).promise();

        // Enqueue the job in SQS with the S3 URL and save jobId in db,  use orgId in sqs consumer to find db
        const params = {
            MessageBody: JSON.stringify({ "jobId" : jobId, "s3Path": `/data/${jobId}.json`, "orgId": orgId }),
            QueueUrl: process.env.QUEUE_URL, // configure as Lamda Environment Variables
        };

        await SQS.sendMessage(params).promise();
    }

};

process.on('exit', () => {
    redis.disconnect();
});
