## Pico-mixer

![keypad](https://user-images.githubusercontent.com/480131/190699453-22a69127-dc96-4311-9798-fcf46ee1cf6d.png)

This project was born after thinking that I'd really like to have something like a [Launchpad](https://novationmusic.com/en/launch/launchpad-x) to control and mix sound ambiances while DMing a Dungeons and Dragons game.

What I wanted was a way to start, stop, pause, resume multiple individual soundtracks, while being able to adjust their volume, to create an immersive sound ambiance for the table.

I used a [Pimoroni Keypad](https://shop.pimoroni.com/products/pico-rgb-keypad-base?variant=32369517166675), as well as a [Raspberry Pi Pico](https://learn.pimoroni.com/article/getting-started-with-pico), for a total budget of roughly 30 euro.

### Setup

The `code.py` script runs on a Raspberry Pi Pico, running [CircuitPython](https://circuitpython.org/), itself connected onto the [Pimoroni Keypad](https://shop.pimoroni.com/products/pico-rgb-keypad-base?variant=32369517166675). The first 12 keys control what audio tracks to play/stop, and the last 4 keys allow you to control the volume of individual tracks, as well as pause the whole stream.

<img width="740" alt="Screen Shot 2022-09-17 at 15 20 23" src="https://user-images.githubusercontent.com/480131/190859070-7c1365d8-d062-462d-a73c-69e2f6cabcc1.png">

When a key (or a combination of Volume up/down + track key) is pressed, a JSON-formatted message is sent over USB. This message is read by the `mixer.py` script, a curses app displaying each individual track, associated with their volume bar.

<img width="972" alt="Screen Shot 2022-09-17 at 15 15 47" src="https://user-images.githubusercontent.com/480131/190859066-77211be5-a692-450b-88c9-b99139f94216.png">

 
### Limitations

The `mixer.py` script currently uses [`pygame.mixer`](https://www.pygame.org/docs/ref/mixer.html) to play the individual track sound files over separate channels. While this works, the startup time can be excruciatingly slow, as each sound file must be fully loaded in memory before the app can start.

The python mixer code could possibly replaced by a web application relying on the following Web APIs:
- [`USB.getDevices()`](https://developer.mozilla.org/en-US/docs/Web/API/USB/getDevices) to read messages over USB (Chrome/Safari only)
- [`WebAudio`](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) to stream/mix the different sound files.
