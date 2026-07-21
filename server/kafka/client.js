import { Kafka } from "kafkajs";

// If KAFKA_BROKER is not in the .env file, fallback to localhost for development
const brokers = process.env.KAFKA_BROKER 
  ? [process.env.KAFKA_BROKER] 
  : ['localhost:9092'];

export const kafka = new Kafka({
  clientId: 'dropvault-server',
  brokers: brokers,
  ssl: !!process.env.KAFKA_BROKER, // Use SSL in production
  sasl: process.env.KAFKA_USERNAME ? {
    mechanism: 'scram-sha-256',
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  } : undefined, // No SASL in local development
  retry: {
    initialRetryTime: 300,
    retries: 10
  }
});
