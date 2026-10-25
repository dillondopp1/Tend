"""Pre-record the Game Show announcer (free Edge neural voice). Run: python scripts/make-announcer.py
Needs: pip install edge-tts. Clips land in public/gameshow/. Keep the lines in step with src/gameshow/rounds.ts."""
import asyncio, json, re, pathlib
import edge_tts

OUT = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'gameshow'
VOICE, RATE, PITCH = 'en-US-GuyNeural', '+8%', '+4Hz'

src = (pathlib.Path(__file__).resolve().parent.parent / 'src' / 'gameshow' / 'rounds.ts').read_text(encoding='utf-8')
rounds = re.findall(r"title: '(.*?)', setup: '(.*?)',\s*ask: '(.*?)', vote:", src)
spoken = lambda t: t.replace(chr(92) + "'", "'").replace('🙂', 'smiley face').replace('1 a.m.', 'one A M')

LINES = {
  'welcome': "Ladies and gentlemen, boys and girls, welcome to... the Gospel Game Show! Tonight, everybody plays. Everybody's answers count. And nobody has to be perfect. Let's get started!",
  'write': "Alright. Pick up your phone and type your answer. Be honest. Nobody sees your name until the reveal.",
  'vote': "Every answer is in! Now read them carefully, and vote for your favorite. You can't vote for your own.",
  'reveal': "Votes are locked! Let's see who said what.",
  'hurry': "Ten seconds left!",
  'allin': "Everyone's in! Nicely done.",
  'finale': "And that's the show! Thank you for being honest tonight. Keep thinking about these. You're the best audience in the world.",
}
for i, (t, s, a) in enumerate(rounds, 1):
    LINES[f'r{i}'] = f"Round {i}. {spoken(t)}. {spoken(s)} {spoken(a)}"

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for k, t in LINES.items():
        await edge_tts.Communicate(t, VOICE, rate=RATE, pitch=PITCH).save(str(OUT / f'{k}.mp3'))
        print(k)
asyncio.run(main())
