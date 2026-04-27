import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const client = new ElevenLabsClient({
  apiKey: 'sk_9155d09f1ddcb260097d653927249bddbe56ec178a2a08fe',
});

async function main() {
  try {
    const response = await client.textToSpeech.convert(
      "21m00Tcm4TlvDq8ikWAM",
      {text: "Test."}
    );
    console.log("Response prototype:", Object.prototype.toString.call(response));
    console.log("constructor name:", response.constructor.name);
  } catch(e) {
    console.error(e);
  }
}
main();
