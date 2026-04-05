import math
import time

import usb_cdc
from keypad_config import (
    COLORS,
    PAUSE_ALL_KEY_INDEX,
    PAUSE_KEY_INDEX,
    TOTAL_BANKS,
    TRACK_KEY_COUNT,
    VOLUME_DOWN_KEY_INDEX,
    VOLUME_UP_KEY_INDEX,
)
from pimoroni_rgbkeypad import RGBKeypad

ACTIVATED_KEY_BRIGHTNESS = 0.6
DEACTIVATED_KEY_BRIGHTNESS = 0.2
BRIGHTNESS_FLUCTUATION_CYCLE_MS = 3000

current_bank = 1
activated_keys = {bank: {} for bank in range(1, TOTAL_BANKS + 1)}
keys_being_pressed = {}
keys_paused = set()
paused_all = False


class KeyState:
    INIT = "init"
    PAUSE = "pause"
    PAUSE_ALL = "pause_all"
    START = "start"
    STOP = "stop"
    UNPAUSE = "unpause"
    UNPAUSE_ALL = "unpause_all"
    VOL_DOWN = "vol_down"
    VOL_UP = "vol_up"
    SWITCH_BANK = "switch_bank"


def fluctuating_brightness(t, cycle):
    """Cyclic function representing the brightness fluctuation of a key over time

    See https://s.42l.fr/FsKw74vh

    """
    brightness = abs(math.cos(math.pi * t / cycle))
    return clamp(value=brightness, min_value=0.05, max_value=0.90)


def clamp(value, min_value, max_value):
    """Clamp a value between 2 boundary values"""
    if value < min_value:
        return min_value
    elif value > max_value:
        return max_value
    return value


def send_key_state(key, state):
    """Send a JSON-encoded message reflecting the state of the given argument key"""
    send_message('{"key": "%s", "state": "%s"}\n' % (str(key), state))


def send_message(message):
    """Send the arugment message over the USB port"""
    print(message)


def initialize_keys(keypad):
    """Light up each keys with their associated color"""
    for i, key in enumerate(keypad.keys):
        key.color = COLORS[i]
        key.brightness = DEACTIVATED_KEY_BRIGHTNESS


def is_track_key(key_index):
    return key_index < TRACK_KEY_COUNT


def is_modifier_key(key_index):
    return key_index in (VOLUME_DOWN_KEY_INDEX, VOLUME_UP_KEY_INDEX)


def set_track_key_brightness(keypad, key_index, start_time):
    if key_index in activated_keys[current_bank]:
        elapsed_ms = (time.monotonic() - start_time) * 1000
        keypad.keys[key_index].brightness = fluctuating_brightness(
            elapsed_ms, cycle=BRIGHTNESS_FLUCTUATION_CYCLE_MS
        )
    else:
        keypad.keys[key_index].brightness = DEACTIVATED_KEY_BRIGHTNESS


def refresh_bank_track_keys(keypad, start_time):
    for key_index in range(TRACK_KEY_COUNT):
        set_track_key_brightness(keypad, key_index, start_time)


def update_switch_bank_key(keypad):
    switch_bank_key = keypad.keys[PAUSE_KEY_INDEX]
    if current_bank == 1:
        switch_bank_key.color = [255, 0, 0]
    else:
        switch_bank_key.color = [255, 0, 255]
    switch_bank_key.brightness = DEACTIVATED_KEY_BRIGHTNESS


def advertise_keys_colors():
    """Send an init message over USB with the color of each key"""
    while not usb_cdc.console.connected:
        time.sleep(0.1)
    send_message('{"state": "%s", "colors": %s}\n' % (KeyState.INIT, str(COLORS[:12])))


def handle_keypress_combination(keys_pressed):
    """Handle key combination to allow volume up/down, key pause/unpause, etc"""
    if len([pressed for pressed in keys_pressed if pressed]) != 2:
        return

    associated_keys_index = [
        i
        for (i, pressed) in enumerate(keys_pressed)
        if pressed
        if is_track_key(i)
    ]
    if len(associated_keys_index) != 1:
        return

    associated_key_index = associated_keys_index[0]
    if not keys_being_pressed.get(associated_key_index):
        keys_being_pressed[associated_key_index] = True

        if keys_pressed[VOLUME_DOWN_KEY_INDEX] is True:
            state = KeyState.VOL_DOWN
        elif keys_pressed[VOLUME_UP_KEY_INDEX] is True:
            state = KeyState.VOL_UP
        else:
            # pause / unpause
            if associated_key_index not in keys_paused:
                keys_paused.add(associated_key_index)
                state = KeyState.PAUSE
            else:
                keys_paused.remove(associated_key_index)
                state = KeyState.UNPAUSE

        send_key_state(key=associated_key_index, state=state)

def update_global_controls(keypad, paused):
    for i in range(TRACK_KEY_COUNT, PAUSE_ALL_KEY_INDEX):
        keypad.keys[i].brightness = DEACTIVATED_KEY_BRIGHTNESS

    pause_all_key = keypad.keys[PAUSE_ALL_KEY_INDEX]
    pause_all_key.brightness = DEACTIVATED_KEY_BRIGHTNESS
    if paused:
        pause_all_key.color = [255, 255, 0]
        pause_all_key.brightness = ACTIVATED_KEY_BRIGHTNESS
    else:
        pause_all_key.color = [0, 255, 0]


def refresh_controls(keypad, start_time):
    refresh_bank_track_keys(keypad, start_time)
    update_switch_bank_key(keypad)
    update_global_controls(keypad, paused_all)


def release_key(keypad, key_index, start_time):
    if key_index in keys_being_pressed:
        keys_being_pressed.pop(key_index)
    if is_track_key(key_index):
        set_track_key_brightness(keypad, key_index, start_time)


def toggle_track_key(keypad, key_index):
    key = keypad.keys[key_index]
    if key_index in activated_keys[current_bank]:
        activated_keys[current_bank].pop(key_index)
        key.brightness = DEACTIVATED_KEY_BRIGHTNESS
        return KeyState.STOP

    activated_keys[current_bank][key_index] = True
    key.brightness = ACTIVATED_KEY_BRIGHTNESS
    return KeyState.START


def handle_bank_switch(keypad, key_index, start_time):
    global current_bank

    current_bank = (current_bank % TOTAL_BANKS) + 1
    refresh_controls(keypad, start_time)
    send_key_state(key=key_index, state=KeyState.SWITCH_BANK)


def handle_pause_all(keypad, key_index, start_time):
    global paused_all

    if paused_all:
        state = KeyState.UNPAUSE_ALL
    else:
        state = KeyState.PAUSE_ALL
    paused_all = not paused_all

    refresh_controls(keypad, start_time)
    send_key_state(key=key_index, state=state)


def handle_pressed_key(keypad, key_index, start_time):
    if is_modifier_key(key_index):
        return
    if key_index in keys_being_pressed:
        return

    keys_being_pressed[key_index] = True

    if key_index == PAUSE_KEY_INDEX:
        handle_bank_switch(keypad, key_index, start_time)
        return

    if key_index == PAUSE_ALL_KEY_INDEX:
        handle_pause_all(keypad, key_index, start_time)
        return

    state = toggle_track_key(keypad, key_index)
    send_key_state(key=key_index, state=state)


def main():
    start_time = time.monotonic()
    keypad = RGBKeypad()

    initialize_keys(keypad)
    refresh_controls(keypad, start_time)
    advertise_keys_colors()

    while True:
        keys_pressed = keypad.get_keys_pressed()
        handle_keypress_combination(keys_pressed)

        for key_index, key_pressed in enumerate(keys_pressed):
            if not key_pressed:
                release_key(keypad, key_index, start_time)
                continue

            handle_pressed_key(keypad, key_index, start_time)


if __name__ == "__main__":
    main()
