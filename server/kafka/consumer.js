import { kafka } from "./client.js";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const consumer = kafka.consumer({ groupId: 'activity-group' });

export async function initConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'user-activity', fromBeginning: true });
  console.log('✅ Kafka Consumer connected and subscribed to "user-activity"');

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        console.log(`📥 Received Kafka Event:`, event);

        const { error } = await supabase.from('activities').insert({
          user_id: event.userId,
          action: event.action,
          target_name: event.targetName
        });

        if (error) {
          console.error('❌ Error saving activity to Supabase:', error);
        } else {
          console.log('✅ Activity saved to Supabase activities table');
        }
      } catch (err) {
        console.error('❌ Error processing Kafka message:', err);
      }
    },
  });
}
