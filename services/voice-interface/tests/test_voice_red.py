"""TDD red-phase test for voice-interface (P1, S2-07).

The placeholder ``transcribe()`` raises NotImplementedError. The red test
expects a non-empty string. xfail-strict bridges the gap until S2-07
wires faster-whisper.
"""

from __future__ import annotations

import pytest


@pytest.mark.xfail(
    strict=True,
    reason="voice-interface ASR not yet wired — Sprint 2 task S2-07 (P1)",
)
def test_transcribe_returns_non_empty_string_for_valid_audio() -> None:
    from voice_interface import transcribe

    audio_stub = b"\x00\x00\x00\x00"
    text = transcribe(audio_stub)
    assert isinstance(text, str)
    assert text != ""
