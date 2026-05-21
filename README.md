# Calendar Card for Home Assistant

A clean, minimal Lovelace card that shows your week at a glance.

## Features

- 📅 **Day panel** — today's date, events, and optional todo tasks
- 🗓️ **Week grid** — 7-column calendar grid (Sun–Sat) with events under each day
- 🔍 **Event popups** — tap any event for full details: date, time, location, notes
- ✅ **Todo support** — tasks due today with checkboxes that sync to Google Tasks
- 🎨 **Theme aware** — uses HA CSS variables for colors and fonts
- 🌍 **Timezone safe** — all-day events display on the correct local day

![preview](preview.png)

---

## Installation

### Via HACS

1. Open HACS → Frontend
2. Three-dot menu → Custom repositories
3. Add `https://github.com/broberts2261/ha-calendar-card` as Lovelace
4. Find Calendar Card and click Download
5. Restart Home Assistant

### Manual

1. Download `calendar-card.js` from the latest release
2. Copy to `/config/www/calendar-card.js`
3. Add Lovelace resource: `/local/calendar-card.js` (JavaScript Module)
4. Hard refresh browser

---

## Configuration

```yaml
type: custom:calendar-card
calendar_entity: calendar.your_calendar
todo_entity: todo.your_tasks
```

| Option | Required | Description |
|---|---|---|
| `calendar_entity` | ✅ Yes | HA calendar entity ID |
| `todo_entity` | No | HA todo entity ID |

---

## Event Popups

Tapping any event — in either the day panel or the week grid — opens a detail popup with the full event information.

The popup shows:

| Field | Description |
|---|---|
| 📅 **Date** | Full date including weekday (e.g. Thursday, June 12) |
| 🕐 **Time** | Start and end time, or "All day" for all-day events |
| 📍 **Location** | Only shown if a location is set on the event |
| 📝 **Notes** | Event description / notes, with HTML stripped out |

Dismiss the popup by clicking the **✕** button, clicking the dark backdrop, or pressing `Escape`.

---

## Compatibility

- Home Assistant 2023.4.0+
- Any modern browser
- Any Lovelace theme

## License

MIT
