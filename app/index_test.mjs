import ioredis from 'ioredis';
import mysql from 'mysql2/promise';
import AWS from 'aws-sdk';
import formidable from 'formidable';
import { v1 as uuidv1 } from 'uuid';

const S3 = new AWS.S3();
const SQS = new AWS.SQS();

/*let connection;
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
*/

export const handler = async (event) => {
    const response = {
      statusCode: 200,
      body: JSON.stringify(event),
    };
    return response;   
    
};
