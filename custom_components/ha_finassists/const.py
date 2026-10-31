"""Constants for the Fin Assist Home Assistant integration."""

from datetime import timedelta

DOMAIN = "ha_finassists"
NAME = "Fin Assist"
DEFAULT_BASE_URL = "http://homeassistant.local:8099/api/v1"
CONF_BASE_URL = "base_url"
CONF_SYSTEM_TOKEN = "system_token"
DEFAULT_CAPABILITIES = {"categories": True, "scheduledTransactions": True}
UPDATE_INTERVAL = timedelta(minutes=5)
PLATFORMS = ("sensor",)
