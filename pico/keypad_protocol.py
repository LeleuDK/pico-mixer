EVENT_STATE = {
    "INIT": "init",
    "PAUSE": "pause",
    "PAUSE_ALL": "pause_all",
    "START": "start",
    "STOP": "stop",
    "UNPAUSE": "unpause",
    "UNPAUSE_ALL": "unpause_all",
    "USB_CONNECTED": "usb_connected",
    "USB_DISCONNECTED": "usb_disconnected",
    "VOL_DOWN": "vol_down",
    "VOL_UP": "vol_up",
    "SWITCH_BANK": "switch_bank",
}

TRACK_EVENT_STATES = frozenset(
    (
        EVENT_STATE["PAUSE"],
        EVENT_STATE["START"],
        EVENT_STATE["STOP"],
        EVENT_STATE["UNPAUSE"],
        EVENT_STATE["VOL_DOWN"],
        EVENT_STATE["VOL_UP"],
    )
)

GLOBAL_EVENT_STATES = frozenset(
    (
        EVENT_STATE["PAUSE_ALL"],
        EVENT_STATE["UNPAUSE_ALL"],
        EVENT_STATE["SWITCH_BANK"],
    )
)

DEVICE_EVENT_STATES = frozenset(
    TRACK_EVENT_STATES
    | GLOBAL_EVENT_STATES
    | frozenset((EVENT_STATE["INIT"],))
)

WEBSOCKET_EVENT_STATES = frozenset(
    DEVICE_EVENT_STATES
    | frozenset(
        (
            EVENT_STATE["USB_CONNECTED"],
            EVENT_STATE["USB_DISCONNECTED"],
        )
    )
)
