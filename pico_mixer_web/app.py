import importlib.util
import json
import os
import sys
import time
from pathlib import Path

import click
import serial.serialutil
from flask import Flask, render_template
from flask_sock import Sock
from serial import Serial
from serial.tools.list_ports import grep as list_ports

# From https://devicehunt.com/view/type/usb/vendor/239A
ADAFRUIT_HARDWARE_VENDOR_ID = "239A"

assets_dir = Path(__file__).parent / "assets"
sounds_dir = assets_dir / "sounds"

track_config_path = os.environ.get(
    "PICO_MIXER_CONFIG", Path(__file__).parent / ".." / "config.json"
)
app = Flask(
    "pico-mixer",
    static_url_path="/assets",
    static_folder=assets_dir,
)
sock = Sock(app)
keypad_config_path = Path(__file__).parent / ".." / "pico" / "keypad_config.py"
keypad_protocol_path = Path(__file__).parent / ".." / "pico" / "keypad_protocol.py"

if not sounds_dir.exists():
    click.echo(
        click.style(
            f"The {sounds_dir} folder does not exist. Creating it on the fly.",
            fg="yellow",
        )
    )
    sounds_dir.mkdir(exist_ok=True)

elif not (sounds_dir.is_dir() or sounds_dir.is_symlink()):
    click.echo(
        click.style(
            f"{sounds_dir} should be a directory and not a file. Delete it and restart the app.",
            fg="red",
        )
    )
    sys.exit(1)
elif not list(sounds_dir.iterdir()):
    click.echo(
        click.style(
            f"{sounds_dir} is empty. No sounds will be played. Put sounds file under it and "
            "update the config.json file to reflect the file names",
            fg="yellow",
        )
    )


def load_module(module_name, module_path):
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise ValueError(f"Could not load module {module_name} from {module_path}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


keypad_config = load_module("keypad_config", keypad_config_path)
keypad_protocol = load_module("keypad_protocol", keypad_protocol_path)

KEY_COLORS = keypad_config.COLORS[: keypad_config.TRACK_KEY_COUNT]
EVENT_STATE = keypad_protocol.EVENT_STATE
DEVICE_EVENT_STATES = keypad_protocol.DEVICE_EVENT_STATES
TRACK_EVENT_STATES = keypad_protocol.TRACK_EVENT_STATES


def normalize_key_event(message):
    if not isinstance(message, dict):
        return

    state = message.get("state")
    if state not in DEVICE_EVENT_STATES:
        return

    normalized_message = {"state": state}

    if state == EVENT_STATE["INIT"]:
        colors = message.get("colors")
        if not isinstance(colors, list):
            return
        normalized_message["colors"] = colors[: keypad_config.TRACK_KEY_COUNT]
        return normalized_message

    key = message.get("key")
    try:
        normalized_key = int(key)
    except (TypeError, ValueError):
        return

    normalized_message["key"] = normalized_key

    if state in TRACK_EVENT_STATES:
        if not 0 <= normalized_key < keypad_config.TRACK_KEY_COUNT:
            return
    elif not 0 <= normalized_key < keypad_config.TOTAL_KEYS:
        return

    return normalized_message


def find_usb_device():
    if not (usb_ports := list(list_ports(r".*"))):
        return
    for port in usb_ports:
        if ADAFRUIT_HARDWARE_VENDOR_ID in port.hwid:
            return Serial(port.device)


@app.get("/")
def index():
    with open(track_config_path) as track_config:
        tracks = json.load(track_config)
        return render_template("index.html.j2", tracks=tracks)


@sock.route("/key_events")
def stream_key_events(ws):
    connected, usb_device = False, None
    while True:
        if not connected:
            if not (usb_device := find_usb_device()):
                ws.send(json.dumps({"state": EVENT_STATE["USB_DISCONNECTED"]}))
                time.sleep(1)
                continue
            else:
                ws.send(json.dumps({"state": EVENT_STATE["USB_CONNECTED"]}))
                ws.send(json.dumps({"state": EVENT_STATE["INIT"], "colors": KEY_COLORS}))
                connected = True
        elif usb_device is not None:
            try:
                line = usb_device.readline().strip()
                line = line.decode("utf-8")
                if not line.startswith("{"):
                    continue
                try:
                    message = json.loads(line)
                except ValueError:
                    continue
                normalized_message = normalize_key_event(message)
                if normalized_message is not None:
                    ws.send(json.dumps(normalized_message))
            except serial.serialutil.SerialException:
                ws.send(json.dumps({"state": EVENT_STATE["USB_DISCONNECTED"]}))
                connected = False
                time.sleep(1)


if __name__ == "__main__":
    app.run(port=8000)
