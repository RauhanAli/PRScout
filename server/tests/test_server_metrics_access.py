"""Who may read GET /metrics when the server is reachable from the internet."""

from prscout_server.metrics import metrics_allowed


def test_open_behind_a_private_network():
    assert metrics_allowed("", None, env={})


def test_closed_on_railway_without_a_key():
    assert not metrics_allowed("", None, env={"RAILWAY_ENVIRONMENT_NAME": "production"})


def test_a_key_is_required_once_set():
    railway = {"RAILWAY_ENVIRONMENT_NAME": "production"}
    assert metrics_allowed("s3cret", "Bearer s3cret", env=railway)
    assert not metrics_allowed("s3cret", "Bearer nope", env={})
    assert not metrics_allowed("s3cret", None, env={})
