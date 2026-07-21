import { kafka } from "./client.js";

const producer = kafka.producer();

export async function initProducer() {
  await producer.connect();
  console.log('✅ Kafka Producer connected');
}

export async function logUserActivity(userId, action, targetName) {
  await producer.send({
    topic: 'user-activity',
    messages: [
      { value: JSON.stringify({ userId, action, targetName, timestamp: new Date().toISOString() }) }
    ],
  });
  console.log(`📤 Produced Kafka Event: [${action}] for user ${userId}`);
}

export async function publishImageProcessingEvent(userId, pathPrefix, fileName) {
  await producer.send({
    topic: 'image-processing',
    messages: [
      { value: JSON.stringify({ userId, pathPrefix, fileName, timestamp: new Date().toISOString() }) }
    ],
  });
  console.log(`📤 Produced Kafka Event: [image-processing] for file ${fileName}`);
}


