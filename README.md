## Pico-mixer

![keypad](https://user-images.githubusercontent.com/480131/190699453-22a69127-dc96-4311-9798-fcf46ee1cf6d.png)

This project was born after thinking that I'd really like to have something like a [Launchpad](https://novationmusic.com/en/launch/launchpad-x) to control and mix sound ambiances while DMing a Dungeons and Dragons game.

What I wanted was a way to create an immersive atmosphere at the table, by being able to start, stop, pause and resume multiple individual soundtracks, adjust their volume, and flash pretty colors.

I used a [Pimoroni Keypad](https://shop.pimoroni.com/products/pico-rgb-keypad-base?variant=32369517166675), as well as a [Raspberry Pi Pico](https://learn.pimoroni.com/article/getting-started-with-pico), for a total budget of roughly 30 euro. The black casing was 3D-printed using the `rgb_keypad_-_bottom.stl` file from this [Thingiverse model](https://www.thingiverse.com/thing:4883873/files).


### Setup

The `code.py` script runs on a Raspberry Pi Pico, running [CircuitPython](https://circuitpython.org/), itself connected onto the [Pimoroni Keypad](https://shop.pimoroni.com/products/pico-rgb-keypad-base?variant=32369517166675). The first 12 keys control what audio tracks to play/stop, and the last 4 keys allow you to control the volume of individual tracks, as well as pause the whole stream.

<img width="100%" alt="Screen Shot 2022-09-17 at 15 20 23" src="https://user-images.githubusercontent.com/480131/190859070-7c1365d8-d062-462d-a73c-69e2f6cabcc1.png">

When a key (or a combination of Volume up/down + track key) is pressed, a JSON-formatted message is sent over USB. The local web application reads these messages, updates the UI in real time, and controls the audio playback in the browser.

### Local web application

The application is composed of 3 elements:

- the keypad CircuitPython code
- a webpage in charge of displaying the soundbars and active tracks as well as actually controlling the audio tracks
- a Flask webserver receiving the keypad messages over USB and serving them to the webpage over a websocket, as well as serving the static audio files to the webpage

<img width="100%" alt="Screenshot 2022-09-18 at 17 06 35" src="https://user-images.githubusercontent.com/480131/190913995-a27c2385-ea1d-491a-8cc8-84a14d738a49.png">


As the browser is really good at streaming `<audio>` elements, the app can start immediately without having to load all audio files in memory.

<img width="100%" alt="Screenshot 2022-09-21 at 20 25 38" src="https://user-images.githubusercontent.com/480131/191582090-3d54a629-ce9f-4f26-9178-f8311c55de6d.png">

### Colors

The key colors were generated from [iwanthue](https://medialab.github.io/iwanthue/) and are stored in `pico/keypad_config.py`. Any changes to the colors will be reflected in the web UI when the keypad advertises its initialization payload.

### Event protocol

The keypad, backend, and browser communicate through JSON messages with a shared `state` field.

- Track events: `start`, `stop`, `pause`, `unpause`, `vol_up`, `vol_down`
- Global events: `switch_bank`, `pause_all`, `unpause_all`
- Init event: `init`
- Connection events from the webserver: `usb_connected`, `usb_disconnected`

Payload shape:

```json
{"state": "start", "key": 3}
{"state": "switch_bank", "key": 14}
{"state": "init", "colors": [[240, 89, 48], [237, 159, 29]]}
```

The webserver validates and normalizes incoming keypad messages before forwarding them to the browser.


### Getting started on macOS and Linux

(This guide assumes that CircuitPython has been installed on the pico. If that is not the case, follow these [instructions](https://learn.adafruit.com/welcome-to-circuitpython) first.)


Open a terminal, then run the following commands:

```console
$ cd ~/Downloads
$ curl -L https://github.com/brouberol/pico-mixer/archive/refs/heads/main.zip -o main.zip
$ unzip main.zip
$ cd pico-mixer-main
$ python3 -m pip install --user poetry
$ make install
```

Plug the keypad, and run:

```console
$ make pico-remount
$ make pico-sync
```

The keypad should light up. Unplug it.

If you are using macOS Sonoma and get write errors when copying files to the `CIRCUITPY` volume, run `make pico-remount` before `make pico-sync`. This remounts the volume with `noasync`, which helps avoid known write issues on some Sonoma versions.

Now, copy all the sounds files you would like to play (12 max) under the `pico_mixer_web/assets/sounds` folder, and replace each example `title` attribute under the `config.json` file with the name of a sound file you copied under `sounds`. Feel free to add a couple of descriptive tags under the `tags` attribute. Save the `config.json` file.

Run the following command to start the webserver:

```console
$ make webmixer
```

At that point, the webserver will start and the webpage will open. Plug the keypad in. You are now ready.


### Getting started on Windows

(This guide assumes that CircuitPython has been installed on the pico. If that is not the case, follow these [instructions](https://learn.adafruit.com/welcome-to-circuitpython) first.)

Before being able to execute this application on your Windows machine, you will need to install the Python programming language. To do this, go to the [Windows download page](https://www.python.org/downloads/windows/), click on the "Latest Python 3 Release" link, and follow the installation instructions.

Now that Python is installed, click on the green `Code` button at the top of this page, and then on `Download zip`. This will download the project as a zip file in your `Downloads` folder. Unzip it by right-clicking on the archive, and click on "Extract here".

Open the `pico-mixer-main` folder, and its subfolder, until you can see a `README.md` file. Open the `pico` folder. Plug the keypad to your computer using the USB cable. A file explorer window should open. Copy all the files in the current `pico` folder to the `CIRCUITPY` USB volume. At that point, the keypad should light up. Unplug it. Go back to the parent folder.

Double click on the `win-install` file to install all dependencies.

Now, copy all the sounds files you would like to play (12 max) under the `pico_mixer_web\assets\sounds` folder, and open the `config` file with a text editor, such as Notepad. Replace each example `title` attribute with the name of a sound file you copied under `sounds` and, feel free to add a couple of descriptive tags under the `tags` attribute. Save the file.

We can now execute the web server, by double clicking on `win-run`. This will start the app and open your internet browser on `http://localhost:8000`.

Plug the keypad in. At that point, you should see as many bars as you have sound files (12 max), with colors, and you should see the 🔌 ✅ emoji, indicating that the keypad is plugged and recognized.

Press a key, and lo and behold, a sound should play. If that is not the case, check out the output of the command you ran in the terminal. If you see some lines with `404 -`, this means that you made a typo in the `title` attribute of that track, in the `config.json` file, and that it does not match the filename of the actual sound file. Fix the typo, kill the webserver by pressing `Ctrl-C` and restart it. If nothing works, checke the Q/A at the bottom of the webpage.

> **Warning**: if you find instructions unclear or struggle to run through them, please have a look at the  **Need help❓** section in the app, and possibly this [comment](https://blog.balthazar-rouberol.com/my-diy-dungeons-and-dragons-ambiance-mixer#isso-102) first.
