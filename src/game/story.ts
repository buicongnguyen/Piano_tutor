// The Encore story, told in short portrait dialogues. Triggers:
//   intro                – first launch
//   arrive:<island>      – first visit to an island
//   restore:<island>     – every stage on the island has a star
//   finale / ending      – before and after Canon in D
export type Speaker = "coda" | "hush" | "keeper";
export type Mood = "happy" | "wow" | "determined" | "sleepy" | "sad" | "smile";
export type Line = { who: Speaker; mood?: Mood; text: string; name?: string };

export const STORY: Record<string, Line[]> = {
  intro: [
    { who: "coda", mood: "wow", text: "Oh! Oh oh oh! You can hear me? Nobody's heard a note in ages!" },
    { who: "coda", mood: "happy", text: "I'm Coda — the last note still singing in all of Melodia. And you must be the new Keykeeper!" },
    { who: "coda", mood: "determined", text: "The Hush came one night and gathered every song into silent crystals. Stillnotes. The Sky Isles went grey." },
    { who: "coda", mood: "happy", text: "But this old piano still flies. We call her the Encore. Play the notes as they reach your keys and the music comes back!" },
    { who: "coda", mood: "determined", text: "Every star you earn lights the way to the next island. First stop: Dawn Meadow. Ready, Keykeeper?" },
  ],
  "arrive:meadow": [
    { who: "keeper", name: "Miller Juniper", text: "The windmills stopped turning the night the Hush passed. Can't grind a single grain without a tune." },
    { who: "coda", mood: "happy", text: "Watch the road! Hit each gem as it lands on its key. Perfect timing makes the biggest sparkle." },
  ],
  "restore:meadow": [
    { who: "keeper", name: "Miller Juniper", text: "Listen to them go! The sails are singing again. Take this — the meadow's first beacon is yours to light." },
    { who: "coda", mood: "wow", text: "Did you see the colour pour back in?! Next: the Snow Village. I hope they kept the cocoa warm." },
  ],
  "arrive:snow": [
    { who: "keeper", name: "Grandma Pinecone", text: "Every winter we sing to the stars. This year the stars didn't sing back." },
    { who: "coda", mood: "determined", text: "Long notes turn into ribbons on the road. Hold the key until the ribbon ends!" },
  ],
  "restore:snow": [
    { who: "keeper", name: "Grandma Pinecone", text: "Oh, my old heart. The carols are home. Every window's glowing." },
    { who: "hush", mood: "sleepy", text: "...so loud... why is it so loud again..." },
    { who: "coda", mood: "wow", text: "Did you hear that? The Hush... it sounded tired. Really, really tired." },
  ],
  "arrive:festival": [
    { who: "keeper", name: "Lantern-maker Bo", text: "A thousand lanterns and not a spark between them. Lanterns need a song to float, you know." },
    { who: "coda", mood: "happy", text: "See the golden stars on the road? Catch a whole golden phrase to fill your Encore meter — then fire it (Space, Enter in Words mode, or the gold button) and shine!" },
  ],
  "restore:festival": [
    { who: "keeper", name: "Lantern-maker Bo", text: "Look at them rise! Festival Hills hasn't glowed like this in a hundred years." },
    { who: "coda", mood: "happy", text: "Next: the Glasshouse Gardens, home of the most famous little piano pieces in the world." },
  ],
  "arrive:pier": [
    { who: "keeper", name: "Captain Fizz", text: "Ahoy! The carousel's stuck, the ferris wheel's stuck, and I'm stuck humming nothing. Help an old sailor out?" },
  ],
  "restore:pier": [
    { who: "keeper", name: "Captain Fizz", text: "THAT'S the stuff! The whole pier's swinging! Here — free popcorn for life." },
    { who: "coda", mood: "wow", text: "Just the Season Wheel left before the Hush's castle. Four seasons, twelve songs. Deep breath!" },
  ],
  "arrive:garden": [
    { who: "keeper", name: "Professor Marigold", text: "The glasshouse flowers only open for the great piano pieces. They've been clenched shut like little fists." },
    { who: "coda", mood: "happy", text: "Try Real piano keys here if you like — the road becomes a real keyboard and every note is the real one!" },
  ],
  "restore:garden": [
    { who: "keeper", name: "Professor Marigold", text: "Blooming! All of them! Beethoven, Debussy, Satie — the whole conservatory is in flower." },
    { who: "hush", mood: "sad", text: "...I only wanted one quiet night... just one..." },
    { who: "coda", mood: "determined", text: "The Hush is following us. I don't think it's angry. I think it just can't sleep." },
  ],
  "arrive:neon": [
    { who: "keeper", name: "DJ Axolotl", text: "Yo, Keykeeper! The reef runs on beats and the beats ran out. Let's turn the lights back on." },
  ],
  "restore:neon": [
    { who: "keeper", name: "DJ Axolotl", text: "The reef is LIT! Neon everywhere! You've got hands, friend." },
    { who: "hush", mood: "sad", text: "...every island glows... and I still can't close my eyes..." },
    { who: "coda", mood: "happy", text: "Ragtime Pier is next. Fair warning — their music bounces off the beat. It's called syncopation!" },
  ],
  "arrive:harbour": [
    { who: "keeper", name: "Keeper Nell", text: "The lighthouse turns by moonlight music. Without it, the ships can't find the harbour." },
    { who: "coda", mood: "determined", text: "These are some of the most beautiful pieces ever written. Slow down if you need to — Practice mode waits for you." },
  ],
  "restore:harbour": [
    { who: "keeper", name: "Keeper Nell", text: "There she turns. Ships on the horizon, lights on the water. Thank you, truly." },
    { who: "coda", mood: "happy", text: "Next stop: Neon Reef. Bring your loudest fingers!" },
  ],
  "arrive:seasons": [
    { who: "keeper", name: "The Season Sisters", text: "Spring, Summer, Autumn, Winter — our wheel turns only when Vivaldi plays. It stopped at the Hush's first yawn." },
  ],
  "restore:seasons": [
    { who: "keeper", name: "The Season Sisters", text: "The wheel turns! Blossoms, sunflowers, maple leaves and snow — all in their proper time." },
    { who: "coda", mood: "determined", text: "The Carillon Crown is open. The Hush is waiting there. Let's go gently." },
  ],
  "arrive:crown": [
    { who: "hush", mood: "sad", text: "You came all this way. Every island you lit... I heard every note. I haven't slept in a hundred years." },
    { who: "coda", mood: "determined", text: "Hush... is that why you took the songs? Because you couldn't sleep?" },
    { who: "hush", mood: "sleepy", text: "Music never stops. Never rests. So I made it stop." },
    { who: "coda", mood: "happy", text: "But music does rest! Every song has rests in it — little silences that let it breathe. Keykeeper, show the Hush." },
  ],
  finale: [
    { who: "coda", mood: "happy", text: "Everyone came! Juniper, Grandma Pinecone, Bo, the Professor, Nell, the DJ, Captain Fizz and the Sisters!" },
    { who: "coda", mood: "determined", text: "Canon in D: one melody passed from player to player, around and around. Let's play it together." },
  ],
  ending: [
    { who: "hush", mood: "smile", text: "...oh. The rests. I can hear them now. Little pillows of quiet between the notes..." },
    { who: "hush", mood: "sleepy", text: "Thank you, Keykeeper. Would you... play a lullaby at the end of each night?" },
    { who: "coda", mood: "happy", text: "Every night. We promise. Sleep well, Hush." },
    { who: "coda", mood: "wow", text: "Keykeeper — you did it. The Sky Isles are singing again. Every stage is still open: chase those three-star crowns!" },
  ],
};

export function storyFor(trigger: string): Line[] {
  return STORY[trigger] ?? [];
}
