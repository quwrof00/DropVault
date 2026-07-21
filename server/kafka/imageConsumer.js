import { kafka } from "./client.js";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import sharp from "sharp";

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const consumer = kafka.consumer({ groupId: 'image-processing-group' });

const BUCKET = "user-images";

export async function initImageConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'image-processing', fromBeginning: true });
  console.log('✅ Kafka Consumer connected and subscribed to "image-processing"');

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        console.log(`📥 Received Image Processing Event:`, event);
        const { pathPrefix, fileName } = event;
        const filePath = `${pathPrefix}/${fileName}`;
        const thumbPath = `${pathPrefix}/thumb_${fileName}`;

        console.log(`⏳ Processing image: ${filePath}`);

        // 1. Download original image
        const { data: fileData, error: downloadError } = await supabase.storage.from(BUCKET).download(filePath);

        if (downloadError) {
          console.error(`❌ Error downloading image ${filePath}:`, downloadError);
          return;
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 2. Resize with sharp
        const thumbBuffer = await sharp(buffer)
          .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
          .toBuffer();

        // 3. Upload thumbnail
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(thumbPath, thumbBuffer, {
          contentType: fileData.type,
          upsert: true
        });

        if (uploadError) {
          console.error(`❌ Error uploading thumbnail for ${filePath}:`, uploadError);
        } else {
          console.log(`✅ Successfully generated and uploaded thumbnail: ${thumbPath}`);
        }
      } catch (err) {
        console.error('❌ Error processing image message:', err);
      }
    },
  });
}
