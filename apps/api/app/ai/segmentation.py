from dataclasses import dataclass
from typing import Literal

from app.models import CompanionState

ALLOWED_STATES: tuple[CompanionState, ...] = (
    "approaching",
    "attentive",
    "teasing",
    "soft",
    "proud",
    "jealous",
    "thinking",
    "calm",
)
STATE_PREFIX = "[STATE:"
# Accept the canonical marker as well as occurrences without surrounding newlines.
BUBBLE_MARKER = "[BUBBLE]"


@dataclass(frozen=True)
class SegmentEvent:
    kind: Literal["state", "start", "delta", "complete"]
    index: int | None = None
    content: str = ""
    state: CompanionState | None = None


class ReplySegmenter:
    def __init__(self) -> None:
        self.state: CompanionState = "attentive"
        self._state_resolved = False
        self._buffer = ""
        self._index = 0
        self._started = False
        self._current_text = ""

    @staticmethod
    def _strip_fences(value: str) -> str:
        return value.replace("```text", "").replace("```", "")

    def _resolve_state(self, *, final: bool = False) -> list[SegmentEvent]:
        if self._state_resolved:
            return []
        while True:
            newline = self._buffer.find("\n")
            if newline < 0:
                if not final and len(self._buffer) < 64:
                    return []
                line, remainder = self._buffer, ""
            else:
                line, remainder = self._buffer[:newline], self._buffer[newline + 1 :]
            line = self._strip_fences(line).strip()
            if not line and newline >= 0:
                self._buffer = remainder
                continue
            if line.startswith(STATE_PREFIX) and line.endswith("]"):
                candidate = line[len(STATE_PREFIX) : -1]
                if candidate in ALLOWED_STATES:
                    self.state = candidate  # type: ignore[assignment]
                self._buffer = remainder
            else:
                self._buffer = line + (("\n" + remainder) if newline >= 0 else "")
            self._state_resolved = True
            return [SegmentEvent(kind="state", state=self.state)]

    @staticmethod
    def _marker_suffix_length(value: str) -> int:
        upper = min(len(value), len(BUBBLE_MARKER) - 1)
        for length in range(upper, 0, -1):
            if BUBBLE_MARKER.startswith(value[-length:]):
                return length
        return 0

    def _emit_text(self, value: str) -> list[SegmentEvent]:
        value = self._strip_fences(value)
        if not self._current_text:
            value = value.lstrip()
        if not value:
            return []
        events: list[SegmentEvent] = []
        if not self._started:
            self._started = True
            events.append(SegmentEvent(kind="start", index=self._index))
        self._current_text += value
        events.append(SegmentEvent(kind="delta", index=self._index, content=value))
        return events

    def _complete(self) -> list[SegmentEvent]:
        content = self._current_text.strip()
        if not content:
            return []
        event = SegmentEvent(kind="complete", index=self._index, content=content)
        self._current_text = ""
        self._started = False
        return [event]

    def _drain(self, *, final: bool = False) -> list[SegmentEvent]:
        events: list[SegmentEvent] = []
        while True:
            # Find the next occurrence of the marker regardless of surrounding newlines/spaces.
            marker_at = self._buffer.find(BUBBLE_MARKER)
            if marker_at < 0:
                if final:
                    events.extend(self._emit_text(self._buffer))
                    self._buffer = ""
                    events.extend(self._complete())
                else:
                    # If a partial marker is present at the end, keep it in buffer.
                    suffix_length = self._marker_suffix_length(self._buffer)
                    safe_end = len(self._buffer) - suffix_length
                    events.extend(self._emit_text(self._buffer[:safe_end]))
                    self._buffer = self._buffer[safe_end:]
                return events

            # Extract text before the marker and advance buffer past the marker.
            before = self._buffer[:marker_at]
            self._buffer = self._buffer[marker_at + len(BUBBLE_MARKER) :]

            # Trim stray surrounding whitespace/newlines around the marker boundaries.
            before = before.rstrip('\n')
            self._buffer = self._buffer.lstrip('\n')

            events.extend(self._emit_text(before))
            if self._index >= 2:
                # Already reached max bubbles: merge remainder into current bubble
                events.extend(self._emit_text(" "))
                continue
            completed = self._complete()
            if completed:
                events.extend(completed)
                self._index += 1

    def feed(self, chunk: str) -> list[SegmentEvent]:
        if not chunk:
            return []
        self._buffer += chunk
        events = self._resolve_state()
        if self._state_resolved:
            events.extend(self._drain())
        return events

    def finish(self) -> list[SegmentEvent]:
        events = self._resolve_state(final=True)
        events.extend(self._drain(final=True))
        return events
