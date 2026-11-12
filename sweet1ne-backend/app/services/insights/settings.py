from dataclasses import dataclass


@dataclass(frozen=True)
class SettingDef:
    key: str
    label: str          # what the Settings tab shows
    help: str           # one plain line explaining it
    default: float
    minimum: float      # the form and the API both refuse anything outside
    maximum: float
    unit: str           # "percent" | "days" | "count" | "money"
    group: str          # which section of the Settings tab