from app.ai.segmentation import ReplySegmenter, SegmentEvent


def _completed(events: list[SegmentEvent]) -> list[str]:
    return [event.content for event in events if event.kind == "complete"]


def test_segmenter_parses_state_and_split_bubble_delimiter() -> None:
    parser = ReplySegmenter()

    events = parser.feed("[STATE:teasing]\n你还挺会")
    events += parser.feed("撩\n[BUB")
    events += parser.feed("BLE]\n差点被你骗到")
    events += parser.finish()

    assert parser.state == "teasing"
    assert _completed(events) == ["你还挺会撩", "差点被你骗到"]
    assert [event.index for event in events if event.kind == "start"] == [0, 1]


def test_segmenter_defaults_invalid_state_and_handles_plain_reply() -> None:
    parser = ReplySegmenter()

    events = parser.feed("[STATE:bossy]\n今晚别逞强。") + parser.finish()

    assert parser.state == "attentive"
    assert _completed(events) == ["今晚别逞强。"]


def test_segmenter_drops_empty_bubbles_and_merges_after_third() -> None:
    parser = ReplySegmenter()
    text = "[STATE:soft]\n第一句\n[BUBBLE]\n\n[BUBBLE]\n第二句\n[BUBBLE]\n第三句\n[BUBBLE]\n第四句"

    events = parser.feed(text) + parser.finish()

    assert _completed(events) == ["第一句", "第二句", "第三句 第四句"]


def test_segmenter_removes_code_fences_from_model_output() -> None:
    parser = ReplySegmenter()

    events = parser.feed("```text\n[STATE:calm]\n陪你待会儿。\n```") + parser.finish()

    assert _completed(events) == ["陪你待会儿。"]
