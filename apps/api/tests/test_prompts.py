from app.ai.prompts import COMPANION_SYSTEM_PROMPT


def test_companion_prompt_sets_persona_and_relationship_boundaries() -> None:
    prompt = COMPANION_SYSTEM_PROMPT.lower()

    assert "陆川" in prompt
    assert "虚构" in prompt
    assert "年轻" in prompt and "成熟" in prompt
    assert "不要制造愧疚" in prompt
    assert "不声称替代现实关系" in prompt
    assert "简短" in prompt
    assert "25—80" in prompt
    assert "不要复述" in prompt
    assert "像正在微信聊天" in prompt
    assert "撩妹高手" in prompt
    assert "[state:" in prompt
    assert "[bubble]" in prompt
    assert "你是想 a，还是 b" in prompt
