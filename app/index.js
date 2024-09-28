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
    Implment as ALB listerner rule
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
     * Implement check for orgId as ALB listener rule
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
        //query example
        /*
        const db = await connectToDatabase();
        const [rows] = await db.query("SELECT t.name FROM tenant t left join client c on t.id=c.tenant_id where c.organization_id='"+orgId+"'");
        if (rows.length > 0) {
            const tenantName = rows[0].name; // Access the name directly
            console.log(tenantName); // Log the name to the console
        }*/


    } else {
        const body = JSON.parse(event.body);
        const jobId = uuidv1(); // Generate a job ID
    }

};

process.on('exit', () => {
    redis.disconnect();
});
